import { ROLES } from "@arsip/shared";
import { db } from "../lib/db";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { isTelegramEnabled, sendTelegramMessage } from "./telegram.service";

export type NotifyType =
  | "surat_masuk_created"
  | "surat_keluar_created"
  | "disposisi_changed";

export type NotifyEntity = "surat_masuk" | "surat_keluar";

async function findBidangAdmins(bidangId: number) {
  return db.user.findMany({
    where: {
      status: true,
      bidangId,
      role: { name: ROLES.ADMIN_BIDANG },
    },
    select: {
      id: true,
      nama: true,
      telegramChatId: true,
    },
  });
}

async function findSuperAdmins() {
  return db.user.findMany({
    where: {
      status: true,
      role: { name: ROLES.SUPER_ADMIN },
    },
    select: { id: true, nama: true },
  });
}

function webLink(entity: NotifyEntity) {
  const base = env.WEB_URL.replace(/\/$/, "");
  if (entity === "surat_masuk") return `${base}/surat-masuk`;
  if (entity === "surat_keluar") return `${base}/surat-keluar`;
  return base;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtDate(d?: Date | string | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toISOString().slice(0, 10);
}

function line(label: string, value: string | number | null | undefined) {
  const v = value == null || value === "" ? "—" : String(value);
  return `• <b>${escapeHtml(label)}:</b> ${escapeHtml(v)}`;
}

function buildTelegramMessage(params: {
  title: string;
  lines: string[];
  link: string;
}) {
  return [
    `📬 <b>${escapeHtml(params.title)}</b>`,
    "",
    ...params.lines,
    "",
    `🔗 <a href="${params.link}">Buka di aplikasi</a>`,
  ].join("\n");
}

function inAppBody(parts: string[]) {
  return parts.filter(Boolean).join(" · ").slice(0, 1000);
}

/** Notifikasi ke Admin Bidang terkait (in-app + Telegram) + Super Admin (in-app saja, semua bidang). */
export async function notifyBidangAdmins(params: {
  bidangId: number;
  type: NotifyType;
  title: string;
  body: string;
  entity: NotifyEntity;
  entityId: number;
  telegramText?: string;
}) {
  try {
    const admins = await findBidangAdmins(params.bidangId);
    const superAdmins = await findSuperAdmins();
    const seen = new Set(admins.map((u) => u.id));
    const targets = [...admins, ...superAdmins.filter((u) => !seen.has(u.id))];
    if (targets.length === 0) {
      logger.warn("notify_no_recipients", {
        bidangId: params.bidangId,
        type: params.type,
      });
      return;
    }

    await db.notification.createMany({
      data: targets.map((u) => ({
        userId: u.id,
        type: params.type,
        title: params.title.slice(0, 200),
        body: params.body.slice(0, 1000),
        entity: params.entity,
        entityId: params.entityId,
        bidangId: params.bidangId,
      })),
    });

    if (isTelegramEnabled()) {
      const link = webLink(params.entity);
      const text =
        params.telegramText ??
        buildTelegramMessage({
          title: params.title,
          lines: [escapeHtml(params.body)],
          link,
        });
      await Promise.allSettled(
        admins
          .filter((u) => u.telegramChatId)
          .map((u) => sendTelegramMessage(u.telegramChatId!, text)),
      );
    } else {
      logger.warn("notify_telegram_disabled", { type: params.type });
    }
  } catch (e) {
    logger.error("notify_bidang_failed", {
      error: String(e),
      bidangId: params.bidangId,
      type: params.type,
    });
  }
}

export function notifySuratMasukCreated(row: {
  id: number;
  noUrut?: number;
  nomorSurat: string;
  perihal: string;
  asalSurat?: string;
  tanggalSurat?: Date | string | null;
  tanggalMasukSurat?: Date | string | null;
  tanggalDisposisi?: Date | string | null;
  bidangId: number;
  bidang?: { namaBidang: string } | null;
  kode?: { kode: string; namaKelompok?: string } | null;
  indeks?: { namaIndeks: string } | null;
  creator?: { nama: string } | null;
  keterangan?: string | null;
}) {
  const bidangName = row.bidang?.namaBidang ?? "—";
  const kodeLabel = row.kode
    ? `${row.kode.kode}${row.kode.namaKelompok ? ` - ${row.kode.namaKelompok}` : ""}`
    : "—";
  const title = "Surat masuk baru";
  const body = inAppBody([
    row.nomorSurat,
    row.perihal,
    `Disposisi: ${bidangName}`,
    row.asalSurat ? `Dari: ${row.asalSurat}` : "",
  ]);
  const telegramText = buildTelegramMessage({
    title,
    lines: [
      line("No. urut", row.noUrut),
      line("No. surat", row.nomorSurat),
      line("Perihal", row.perihal),
      line("Asal surat", row.asalSurat),
      line("Tgl. surat", fmtDate(row.tanggalSurat)),
      line("Tgl. masuk", fmtDate(row.tanggalMasukSurat)),
      line("Kode klasifikasi", kodeLabel),
      line("Sub indeks", row.indeks?.namaIndeks),
      line("Disposisi", bidangName),
      line("Tgl. disposisi", fmtDate(row.tanggalDisposisi)),
      line("Dicatat oleh", row.creator?.nama),
      line("Keterangan", row.keterangan),
    ],
    link: webLink("surat_masuk"),
  });
  return notifyBidangAdmins({
    bidangId: row.bidangId,
    type: "surat_masuk_created",
    title,
    body,
    entity: "surat_masuk",
    entityId: row.id,
    telegramText,
  });
}

export function notifySuratKeluarCreated(row: {
  id: number;
  noUrut?: number;
  nomorSurat: string;
  perihal: string;
  ditujukanKepada?: string;
  tanggalSurat?: Date | string | null;
  bidangId: number;
  bidang?: { namaBidang: string } | null;
  kode?: { kode: string; namaKelompok?: string } | null;
  indeks?: { namaIndeks: string } | null;
  creator?: { nama: string } | null;
  keterangan?: string | null;
}) {
  const bidangName = row.bidang?.namaBidang ?? "—";
  const kodeLabel = row.kode
    ? `${row.kode.kode}${row.kode.namaKelompok ? ` - ${row.kode.namaKelompok}` : ""}`
    : "—";
  const title = "Surat keluar baru";
  const body = inAppBody([
    row.nomorSurat,
    row.perihal,
    `Bidang: ${bidangName}`,
    row.ditujukanKepada ? `Kepada: ${row.ditujukanKepada}` : "",
  ]);
  const telegramText = buildTelegramMessage({
    title,
    lines: [
      line("No. urut", row.noUrut),
      line("No. surat", row.nomorSurat),
      line("Perihal", row.perihal),
      line("Ditujukan kepada", row.ditujukanKepada),
      line("Tgl. surat", fmtDate(row.tanggalSurat)),
      line("Kode klasifikasi", kodeLabel),
      line("Sub indeks", row.indeks?.namaIndeks),
      line("Pembuat (bidang)", bidangName),
      line("Dicatat oleh", row.creator?.nama),
      line("Keterangan", row.keterangan),
    ],
    link: webLink("surat_keluar"),
  });
  return notifyBidangAdmins({
    bidangId: row.bidangId,
    type: "surat_keluar_created",
    title,
    body,
    entity: "surat_keluar",
    entityId: row.id,
    telegramText,
  });
}

export function notifyDisposisiChanged(row: {
  id: number;
  noUrut?: number;
  nomorSurat: string;
  perihal: string;
  asalSurat?: string;
  bidangId: number;
  bidang?: { namaBidang: string } | null;
  previousBidang?: string | null;
  kode?: { kode: string; namaKelompok?: string } | null;
  updater?: { nama: string } | null;
}) {
  const bidangName = row.bidang?.namaBidang ?? "—";
  const kodeLabel = row.kode
    ? `${row.kode.kode}${row.kode.namaKelompok ? ` - ${row.kode.namaKelompok}` : ""}`
    : "—";
  const title = "Disposisi surat masuk diubah";
  const body = inAppBody([
    row.nomorSurat,
    row.perihal,
    row.previousBidang
      ? `${row.previousBidang} → ${bidangName}`
      : `Dialihkan ke ${bidangName}`,
  ]);
  const telegramText = buildTelegramMessage({
    title,
    lines: [
      line("No. urut", row.noUrut),
      line("No. surat", row.nomorSurat),
      line("Perihal", row.perihal),
      line("Asal surat", row.asalSurat),
      line("Kode klasifikasi", kodeLabel),
      line("Disposisi sebelumnya", row.previousBidang),
      line("Disposisi baru", bidangName),
      line("Diubah oleh", row.updater?.nama),
    ],
    link: webLink("surat_masuk"),
  });
  return notifyBidangAdmins({
    bidangId: row.bidangId,
    type: "disposisi_changed",
    title,
    body,
    entity: "surat_masuk",
    entityId: row.id,
    telegramText,
  });
}
