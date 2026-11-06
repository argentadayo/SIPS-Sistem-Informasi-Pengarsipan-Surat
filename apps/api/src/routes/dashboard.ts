import { Hono } from "hono";
import { db } from "../lib/db";
import { requireAuth, requirePermission } from "../middleware/auth";
import { PERMISSIONS, LABELS } from "@arsip/shared";
import { formatDate } from "../validators/common";
import type { AppVariables } from "../types/context";

export const dashboardRoutes = new Hono<{ Variables: AppVariables }>();

dashboardRoutes.use("*", requireAuth, requirePermission(PERMISSIONS.DASHBOARD_VIEW));

dashboardRoutes.get("/stats", async (c) => {
  // Overview global — tidak difilter per role/bidang
  const yearParam = Number(c.req.query("year"));
  const now = new Date();
  const year = Number.isFinite(yearParam) && yearParam >= 2000 && yearParam <= 2100
    ? yearParam
    : now.getFullYear();

  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startYear = new Date(Date.UTC(year, 0, 1));
  const endYear = new Date(Date.UTC(year + 1, 0, 1));

  const [
    totalMasuk,
    totalKeluar,
    masukBulanIni,
    keluarBulanIni,
    masukTahunIni,
    keluarTahunIni,
    byBidangMasuk,
    byBidangKeluar,
    recentMasukRaw,
    recentKeluarRaw,
    masukYearRows,
    keluarYearRows,
  ] = await Promise.all([
    db.suratMasuk.count(),
    db.suratKeluar.count(),
    db.suratMasuk.count({
      where: { tanggalMasukSurat: { gte: startMonth } },
    }),
    db.suratKeluar.count({
      where: { tanggalSurat: { gte: startMonth } },
    }),
    db.suratMasuk.count({
      where: {
        tanggalMasukSurat: { gte: startYear, lt: endYear },
      },
    }),
    db.suratKeluar.count({
      where: {
        tanggalSurat: { gte: startYear, lt: endYear },
      },
    }),
    db.suratMasuk.groupBy({
      by: ["bidangId"],
      _count: { id: true },
    }),
    db.suratKeluar.groupBy({
      by: ["bidangId"],
      _count: { id: true },
    }),
    db.suratMasuk.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        kode: true,
        indeks: true,
        bidang: true,
      },
    }),
    db.suratKeluar.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        kode: true,
        indeks: true,
        bidang: true,
        creator: { select: { nama: true } },
      },
    }),
    db.suratMasuk.findMany({
      where: {
        tanggalMasukSurat: { gte: startYear, lt: endYear },
      },
      select: { tanggalMasukSurat: true, bidangId: true },
    }),
    db.suratKeluar.findMany({
      where: {
        tanggalSurat: { gte: startYear, lt: endYear },
      },
      select: { tanggalSurat: true, bidangId: true },
    }),
  ]);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: monthLabels[i],
    masuk: 0,
    keluar: 0,
  }));

  /** total surat (masuk+keluar) per bidang per bulan 0–11 */
  const monthlyByBidangMap = new Map<number, number[]>();
  function bumpBidangMonth(bidangId: number, monthIdx: number) {
    let arr = monthlyByBidangMap.get(bidangId);
    if (!arr) {
      arr = Array.from({ length: 12 }, () => 0);
      monthlyByBidangMap.set(bidangId, arr);
    }
    arr[monthIdx] += 1;
  }

  for (const r of masukYearRows) {
    const m = r.tanggalMasukSurat.getUTCMonth();
    monthly[m].masuk += 1;
    bumpBidangMonth(r.bidangId, m);
  }
  for (const r of keluarYearRows) {
    const m = r.tanggalSurat.getUTCMonth();
    monthly[m].keluar += 1;
    bumpBidangMonth(r.bidangId, m);
  }

  const bidangList = await db.bidang.findMany({ where: { status: true } });
  const map = new Map(bidangList.map((b) => [b.id, b.namaBidang]));
  const ids = new Set([
    ...byBidangMasuk.map((x) => x.bidangId),
    ...byBidangKeluar.map((x) => x.bidangId),
    ...bidangList.map((b) => b.id),
  ]);
  const bidangStats = [...ids].map((id) => {
    const masuk = byBidangMasuk.find((x) => x.bidangId === id)?._count.id ?? 0;
    const keluar = byBidangKeluar.find((x) => x.bidangId === id)?._count.id ?? 0;
    return {
      bidangId: id,
      nama: map.get(id) ?? `Bidang #${id}`,
      masuk,
      keluar,
      total: masuk + keluar,
    };
  }).filter((b) => b.total > 0 || bidangList.some((x) => x.id === b.bidangId));

  // Series grafik: urutan sama donut (total desc), warna FE pakai index yang sama
  const monthlyByBidang = [...bidangStats]
    .filter((b) => b.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((b) => ({
      bidangId: b.bidangId,
      nama: b.nama,
      months: monthlyByBidangMap.get(b.bidangId) ?? Array.from({ length: 12 }, () => 0),
    }));

  const recentMasuk = recentMasukRaw.map((r) => ({
    id: r.id,
    noUrut: r.noUrut,
    tanggalMasukSurat: formatDate(r.tanggalMasukSurat),
    asalSurat: r.asalSurat,
    tanggalSurat: formatDate(r.tanggalSurat),
    nomorSurat: r.nomorSurat,
    kodeKlasifikasi: r.kode.kode,
    indeks: r.indeks?.namaIndeks ?? null,
    perihal: r.perihal,
    disposisi: r.bidang.namaBidang,
    tanggalDisposisi: formatDate(r.tanggalDisposisi),
    keterangan: r.keterangan,
    hasFile: Boolean(r.filePath),
    labels: LABELS.suratMasuk,
  }));

  const recentKeluar = recentKeluarRaw.map((r) => ({
    id: r.id,
    noUrut: r.noUrut,
    tanggalSurat: formatDate(r.tanggalSurat),
    nomorSurat: r.nomorSurat,
    kodeKlasifikasi: r.kode.kode,
    indeks: r.indeks?.namaIndeks ?? null,
    perihal: r.perihal,
    ditujukanKepada: r.ditujukanKepada,
    pembuat: r.creator.nama,
    keterangan: r.keterangan,
    hasFile: Boolean(r.filePath),
    labels: LABELS.suratKeluar,
  }));

  return c.json({
    success: true,
    data: {
      totalMasuk,
      totalKeluar,
      masukBulanIni,
      keluarBulanIni,
      masukTahunIni,
      keluarTahunIni,
      year,
      monthly,
      monthlyByBidang,
      monthLabels,
      bidangStats,
      recentMasuk,
      recentKeluar,
    },
  });
});
