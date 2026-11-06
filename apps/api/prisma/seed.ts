import { PrismaClient } from "@prisma/client";
import { PERMISSIONS, ROLES } from "@arsip/shared";
import { readFileSync } from "fs";
import { join } from "path";

const db = new PrismaClient();

async function hashPassword(password: string) {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 12 });
}

function sqlStatusToBool(s: string): boolean {
  return s.replace(/'/g, "").trim() !== "Nonaktif";
}

function unquote(s: string): string {
  let t = s.trim();
  if (t.startsWith("'") && t.endsWith("'")) {
    t = t.slice(1, -1);
  }
  return t.replace(/''/g, "'");
}

/** Split SQL value tuple content by commas, respecting quoted strings */
function splitSqlValues(body: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "'" && body[i + 1] === "'") {
      cur += "''";
      i++;
      continue;
    }
    if (ch === "'") {
      inQuote = !inQuote;
      cur += ch;
      continue;
    }
    if (ch === "," && !inQuote) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function extractTuples(sql: string, table: string): string[][] {
  const headerRe = new RegExp(
    `INSERT INTO ${table}\\s*\\([^)]+\\)\\s*VALUES\\s*`,
    "gi",
  );
  const tuples: string[][] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(sql)) !== null) {
    // Ambil blok VALUES sampai ; di luar string
    let i = m.index + m[0].length;
    let inQuote = false;
    const start = i;
    while (i < sql.length) {
      const ch = sql[i]!;
      if (ch === "'" && sql[i + 1] === "'") {
        i += 2;
        continue;
      }
      if (ch === "'") {
        inQuote = !inQuote;
        i++;
        continue;
      }
      if (ch === ";" && !inQuote) break;
      i++;
    }
    const block = sql.slice(start, i);
    let j = 0;
    while (j < block.length) {
      while (j < block.length && /\s|,/.test(block[j]!)) j++;
      if (j >= block.length) break;
      if (block[j] !== "(") {
        j++;
        continue;
      }
      j++; // skip (
      let depth = 1;
      let q = false;
      const tStart = j;
      while (j < block.length && depth > 0) {
        const ch = block[j]!;
        if (ch === "'" && block[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (ch === "'") {
          q = !q;
          j++;
          continue;
        }
        if (!q) {
          if (ch === "(") depth++;
          else if (ch === ")") depth--;
        }
        if (depth > 0) j++;
      }
      const body = block.slice(tStart, j);
      j++; // skip )
      tuples.push(splitSqlValues(body));
    }
  }
  return tuples;
}

async function seedKlasifikasi() {
  const sqlPath = join(import.meta.dir, "data", "klasifikasi_arsip.sql");
  const sql = readFileSync(sqlPath, "utf8");

  const existingKat = await db.masterKategori.count();
  if (existingKat > 0) {
    console.log("  Klasifikasi sudah ada, skip import SQL.");
    return;
  }

  console.log("  Import master_kategori / master_kode / master_indeks ...");

  const kategoriRows = extractTuples(sql, "master_kategori");
  for (const cols of kategoriRows) {
    // kategori_id, kode_awal, nama_kategori, status, created_at, updated_at
    await db.masterKategori.create({
      data: {
        id: Number(cols[0]),
        kodeAwal: unquote(cols[1]!),
        namaKategori: unquote(cols[2]!),
        status: sqlStatusToBool(cols[3]!),
      },
    });
  }

  const kodeRows = extractTuples(sql, "master_kode");
  const kodeBatch: {
    id: number;
    kategoriId: number;
    kode: string;
    namaKelompok: string;
    hasSubKode: boolean;
    status: boolean;
  }[] = [];
  for (const cols of kodeRows) {
    // kode_id, kategori_id, kode, nama_kelompok, has_sub_kode, status, ...
    kodeBatch.push({
      id: Number(cols[0]),
      kategoriId: Number(cols[1]),
      kode: unquote(cols[2]!),
      namaKelompok: unquote(cols[3]!),
      hasSubKode: Number(cols[4]) === 1,
      status: sqlStatusToBool(cols[5]!),
    });
  }
  const KODE_CHUNK = 100;
  for (let i = 0; i < kodeBatch.length; i += KODE_CHUNK) {
    await db.masterKode.createMany({ data: kodeBatch.slice(i, i + KODE_CHUNK) });
  }

  const indeksRows = extractTuples(sql, "master_indeks");
  const indeksBatch: {
    kodeId: number;
    namaIndeks: string;
    urutanIndeks: number;
    status: boolean;
  }[] = [];
  for (const cols of indeksRows) {
    // kode_id, nama_indeks, urutan_indeks, status, ...
    indeksBatch.push({
      kodeId: Number(cols[0]),
      namaIndeks: unquote(cols[1]!),
      urutanIndeks: Number(cols[2]),
      status: sqlStatusToBool(cols[3]!),
    });
  }
  const IDX_CHUNK = 200;
  for (let i = 0; i < indeksBatch.length; i += IDX_CHUNK) {
    await db.masterIndeks.createMany({ data: indeksBatch.slice(i, i + IDX_CHUNK) });
  }

  console.log(
    `  Imported: ${kategoriRows.length} kategori, ${kodeBatch.length} kode, ${indeksBatch.length} indeks`,
  );
}

async function main() {
  console.log("Seeding...");

  // Permissions
  const permNames = Object.values(PERMISSIONS);
  for (const name of permNames) {
    await db.permission.upsert({
      where: { name },
      create: { name, deskripsi: name },
      update: {},
    });
  }

  const allPerms = await db.permission.findMany();
  // Admin Bidang = hampir sama Super Admin, bedanya tidak bisa manage pengguna
  const adminBidangPerms = allPerms.filter((p) => p.name !== PERMISSIONS.USER_MANAGE);

  // Roles
  const superAdmin = await db.role.upsert({
    where: { name: ROLES.SUPER_ADMIN },
    create: {
      name: ROLES.SUPER_ADMIN,
      deskripsi: "Akses penuh sistem arsip termasuk manajemen pengguna",
      status: true,
    },
    update: {
      deskripsi: "Akses penuh sistem arsip termasuk manajemen pengguna",
    },
  });

  const adminBidang = await db.role.upsert({
    where: { name: ROLES.ADMIN_BIDANG },
    create: {
      name: ROLES.ADMIN_BIDANG,
      deskripsi: "Akses arsip & master data; tanpa manajemen pengguna",
      status: true,
    },
    update: {
      deskripsi: "Akses arsip & master data; tanpa manajemen pengguna",
    },
  });

  for (const p of allPerms) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdmin.id, permissionId: p.id } },
      create: { roleId: superAdmin.id, permissionId: p.id },
      update: {},
    });
  }

  // Sync Admin Bidang: pastikan punya semua perm kecuali user.manage
  for (const p of adminBidangPerms) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminBidang.id, permissionId: p.id } },
      create: { roleId: adminBidang.id, permissionId: p.id },
      update: {},
    });
  }
  // Hapus user.manage dari Admin Bidang jika pernah ter-assign
  const userManage = allPerms.find((p) => p.name === PERMISSIONS.USER_MANAGE);
  if (userManage) {
    await db.rolePermission.deleteMany({
      where: { roleId: adminBidang.id, permissionId: userManage.id },
    });
  }

  // Bidang
  const bidangData = [
    { namaBidang: "Sekretariat", singkatan: "SEKRET" },
    { namaBidang: "Bidang Perencanaan", singkatan: "REN" },
    { namaBidang: "Bidang Keuangan", singkatan: "KEU" },
    { namaBidang: "Bidang Umum", singkatan: "UMUM" },
  ];
  const bidangIds: number[] = [];
  for (const b of bidangData) {
    const existing = await db.bidang.findFirst({ where: { singkatan: b.singkatan } });
    if (existing) {
      bidangIds.push(existing.id);
    } else {
      const created = await db.bidang.create({ data: { ...b, status: true } });
      bidangIds.push(created.id);
    }
  }

  // Klasifikasi arsip (dari klasifikasi_arsip.sql)
  await seedKlasifikasi();

  // Users
  const adminPass = await hashPassword("Admin@12345");
  const bidangPass = await hashPassword("Bidang@12345");

  await db.user.upsert({
    where: { username: "superadmin" },
    create: {
      nama: "Super Admin",
      username: "superadmin",
      email: "admin@arsip.local",
      password: adminPass,
      roleId: superAdmin.id,
      bidangId: null,
      status: true,
    },
    update: {
      password: adminPass,
      roleId: superAdmin.id,
      status: true,
    },
  });

  await db.user.upsert({
    where: { username: "admin.keuangan" },
    create: {
      nama: "Admin Bidang Keuangan",
      username: "admin.keuangan",
      email: "keuangan@arsip.local",
      password: bidangPass,
      roleId: adminBidang.id,
      bidangId: bidangIds[2],
      status: true,
    },
    update: {
      password: bidangPass,
      roleId: adminBidang.id,
      bidangId: bidangIds[2],
      status: true,
    },
  });

  // Sample surat (opsional) — pakai kode 000.1.2 (ada indeks)
  const kode = await db.masterKode.findFirst({ where: { kode: "000.1.2" } });
  const indeks = kode
    ? await db.masterIndeks.findFirst({
        where: { kodeId: kode.id },
        orderBy: { urutanIndeks: "asc" },
      })
    : null;
  const admin = await db.user.findUnique({ where: { username: "superadmin" } });

  if (kode && indeks && admin && bidangIds[0]) {
    const count = await db.suratMasuk.count();
    if (count === 0) {
      await db.suratMasuk.create({
        data: {
          noUrut: 1,
          tanggalMasukSurat: new Date("2026-01-10"),
          asalSurat: "Dinas Komunikasi dan Informatika",
          tanggalSurat: new Date("2026-01-08"),
          nomorSurat: "005/DISKOMINFO/I/2026",
          kodeId: kode.id,
          indeksId: indeks.id,
          perihal: "Undangan Rapat Koordinasi",
          bidangId: bidangIds[0],
          tanggalDisposisi: new Date("2026-01-11"),
          keterangan: "Contoh data seed",
          createdBy: admin.id,
        },
      });
      await db.suratKeluar.create({
        data: {
          noUrut: 1,
          tanggalSurat: new Date("2026-01-15"),
          nomorSurat: "001/SEKRET/I/2026",
          kodeId: kode.id,
          indeksId: indeks.id,
          perihal: "Surat Keterangan",
          ditujukanKepada: "Kepala Dinas Pendidikan",
          bidangId: bidangIds[0],
          keterangan: "Contoh data seed",
          createdBy: admin.id,
        },
      });
    }
  }

  console.log("Seed selesai.");
  console.log("  Super Admin : superadmin / Admin@12345");
  console.log("  Admin Bidang: admin.keuangan / Bidang@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
