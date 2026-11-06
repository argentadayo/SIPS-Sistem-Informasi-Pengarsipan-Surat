import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, can } from "../lib/api";
import { useAuth } from "../lib/auth";
import { splitNomorPerBaris } from "../lib/text-format";
import { FieldRow, MobileCard } from "../components/ui";

type BidangStat = {
  bidangId: number;
  nama: string;
  masuk: number;
  keluar: number;
  total: number;
};

type Monthly = {
  month: number;
  label: React.ReactNode;
  masuk: number;
  keluar: number;
};

type MonthlyBidang = {
  bidangId: number;
  nama: string;
  months: number[];
};

type RecentMasuk = {
  id: number;
  noUrut: number;
  tanggalMasukSurat: string | null;
  asalSurat: string;
  tanggalSurat: string | null;
  nomorSurat: string;
  kodeKlasifikasi: string;
  indeks: string | null;
  perihal: string;
  disposisi: string;
  tanggalDisposisi: string | null;
  keterangan: string | null;
  hasFile: boolean;
};

type RecentKeluar = {
  id: number;
  noUrut: number;
  tanggalSurat: string | null;
  nomorSurat: string;
  kodeKlasifikasi: string;
  indeks: string | null;
  perihal: string;
  ditujukanKepada: string;
  pembuat: string;
  keterangan: string | null;
  hasFile: boolean;
};

type Stats = {
  totalMasuk: number;
  totalKeluar: number;
  masukBulanIni: number;
  keluarBulanIni: number;
  masukTahunIni: number;
  keluarTahunIni: number;
  year: number;
  monthly: Monthly[];
  monthlyByBidang: MonthlyBidang[];
  monthLabels?: string[];
  bidangStats: BidangStat[];
  recentMasuk: RecentMasuk[];
  recentKeluar: RecentKeluar[];
};

const BIDANG_COLORS = ["#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#f472b6", "#38bdf8", "#4ade80"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function formatNum(n: number) {
  return new Intl.NumberFormat("id-ID").format(n);
}

function formatIdDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") ? iso : `${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function SoftCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden rounded-2xl bg-surface p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)] ring-1 ring-line sm:p-6 dark:shadow-[0_12px_30px_rgba(0,0,0,0.25)] ${className}`}
    >
      {children}
    </div>
  );
}

function OverviewCard({
  label,
  value,
  iconBg,
  icon,
}: {
  label: React.ReactNode;
  value: number;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <SoftCard className="!p-4 sm:!p-6">
      <div className="flex min-h-[88px] items-start justify-between gap-3 sm:min-h-[118px] sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-line text-sm font-semibold leading-snug text-muted sm:text-base">
            {label}
          </p>
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-ink tabular-nums sm:mt-5 sm:text-[2.25rem]">
            {formatNum(value)}
          </p>
        </div>
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl sm:h-16 sm:w-16 sm:rounded-[1.35rem] ${iconBg}`}
        >
          {icon}
        </span>
      </div>
    </SoftCard>
  );
}

function LineChart({
  series,
  labels = MONTH_LABELS,
}: {
  series: MonthlyBidang[];
  labels?: string[];
}) {
  const w = 960;
  const h = 320;
  const pad = { t: 28, r: 20, b: 48, l: 48 };
  const monthCount = 12;
  const maxRaw = Math.max(0, ...series.flatMap((s) => s.months));
  // Max sumbu Y bilangan bulat, minimal 1 biar skala tetap kebaca
  const max = Math.max(1, maxRaw);
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  function x(i: number) {
    return pad.l + (i / Math.max(1, monthCount - 1)) * plotW;
  }
  function y(v: number) {
    return pad.t + plotH - (v / max) * plotH;
  }

  function pathFor(months: number[]) {
    return months
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
  }

  // Peak: nilai tertinggi di antara semua bidang/bulan
  let peak = { v: 0, cx: x(0), cy: y(0), color: BIDANG_COLORS[0] };
  series.forEach((s, si) => {
    s.months.forEach((v, mi) => {
      if (v > peak.v) {
        peak = {
          v,
          cx: x(mi),
          cy: y(v),
          color: BIDANG_COLORS[si % BIDANG_COLORS.length]!,
        };
      }
    });
  });

  // Tick Y: bilangan bulat unik (hindari 0,1,1,2,2)
  const tickCount = Math.min(5, max + 1);
  const yTicks: number[] = [];
  if (max <= 4) {
    for (let i = 0; i <= max; i++) yTicks.push(i);
  } else {
    for (let i = 0; i < tickCount; i++) {
      const val = Math.round((max * i) / (tickCount - 1));
      if (!yTicks.includes(val)) yTicks.push(val);
    }
    if (yTicks[yTicks.length - 1] !== max) yTicks.push(max);
  }

  return (
    <div className="w-full min-w-0 max-w-full">
      {series.length > 0 && (
        <div className="mb-3 flex max-w-full flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-semibold text-muted sm:text-xs">
          {series.map((s, i) => (
            <span key={s.bidangId} className="inline-flex min-w-0 max-w-full items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: BIDANG_COLORS[i % BIDANG_COLORS.length] }}
              />
              <span className="truncate">{s.nama}</span>
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[240px] w-full max-w-full sm:h-[320px]"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Grafik surat per bidang"
      >
        {yTicks.map((val) => {
          const yy = y(val);
          return (
            <g key={val}>
              <line
                x1={pad.l}
                y1={yy}
                x2={w - pad.r}
                y2={yy}
                stroke="var(--color-line)"
                strokeWidth="1"
              />
              <text
                x={pad.l - 8}
                y={yy + 4}
                textAnchor="end"
                fill="var(--color-muted)"
                fontSize="12"
                fontWeight="600"
              >
                {formatNum(val)}
              </text>
            </g>
          );
        })}

        {series.length === 0 && (
          <text
            x={w / 2}
            y={h / 2}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize="13"
            fontWeight="600"
          >
            Belum ada data per bidang
          </text>
        )}

        {series.map((s, si) => {
          const color = BIDANG_COLORS[si % BIDANG_COLORS.length]!;
          return (
            <g key={s.bidangId}>
              <path
                d={pathFor(s.months)}
                fill="none"
                stroke={color}
                strokeWidth="2.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.months.map((v, mi) => (
                <circle
                  key={mi}
                  cx={x(mi)}
                  cy={y(v)}
                  r="4.2"
                  fill={color}
                  stroke="var(--color-surface)"
                  strokeWidth="2"
                />
              ))}
            </g>
          );
        })}

        {labels.map((label, i) => (
          <text
            key={i}
            x={x(i)}
            y={h - 14}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize="12"
            fontWeight="600"
          >
            {label}
          </text>
        ))}

        {peak.v > 0 && (
          <g>
            <rect
              x={Math.min(Math.max(peak.cx - 28, pad.l), w - pad.r - 56)}
              y={Math.max(peak.cy - 32, 4)}
              width="56"
              height="22"
              rx="7"
              fill={peak.color}
            />
            <text
              x={Math.min(Math.max(peak.cx, pad.l + 28), w - pad.r - 28)}
              y={Math.max(peak.cy - 16, 19)}
              textAnchor="middle"
              fill="#fff"
              fontSize="12"
              fontWeight="700"
            >
              {formatNum(peak.v)}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

function DonutChart({ items }: { items: BidangStat[] }) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const total = sorted.reduce((s, b) => s + b.total, 0) || 1;
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const slices = sorted.map((b, i) => {
    const pct = b.total / total;
    const len = pct * c;
    const slice = {
      ...b,
      pct,
      color: BIDANG_COLORS[i % BIDANG_COLORS.length],
      dash: `${len} ${c - len}`,
      offset,
    };
    offset += len;
    return slice;
  });

  return (
    <div className="flex w-full min-w-0 max-w-full flex-col items-center gap-4 sm:gap-5">
      <svg
        viewBox="0 0 150 150"
        className="h-36 w-36 max-w-full shrink-0 sm:h-[168px] sm:w-[168px]"
        aria-hidden
      >
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--color-line)" strokeWidth="22" />
        {slices.map((s) => (
          <circle
            key={s.bidangId}
            cx="75"
            cy="75"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="22"
            strokeDasharray={s.dash}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
            transform="rotate(-90 75 75)"
          />
        ))}
      </svg>
      <ul className="w-full min-w-0 max-w-full space-y-2.5 text-sm">
        {slices.length === 0 && (
          <li className="text-center text-muted">Belum ada data distribusi.</li>
        )}
        {slices.map((s) => (
          <li key={s.bidangId} className="flex min-w-0 items-center justify-between gap-2">
            <span className="inline-flex min-w-0 flex-1 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="min-w-0 break-words font-medium leading-snug text-ink/80">
                {s.nama}
              </span>
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-ink/80">
              {(s.pct * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableShell({
  title,
  to,
  canView,
  mobile,
  children,
}: {
  title: string;
  to: string;
  canView: boolean;
  mobile?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SoftCard className="!p-0 overflow-hidden">
      <div className="flex min-w-0 max-w-full items-center justify-between gap-2 px-3 py-4 sm:gap-4 sm:px-8 sm:py-5 sm:pt-7">
        <h2 className="min-w-0 flex-1 break-words text-base font-extrabold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
        {canView && (
          <Link
            to={to}
            className="shrink-0 rounded-lg border border-ink/20 bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-canvas sm:px-5 sm:py-2 sm:text-sm"
          >
            Lihat Semua
          </Link>
        )}
      </div>
      {mobile && (
        <div className="cards-mobile-only min-w-0 max-w-full space-y-3 px-3 pb-4">
          {mobile}
        </div>
      )}
      <div
        className={`min-w-0 max-w-full overflow-x-auto overscroll-x-contain px-3 pb-4 sm:px-8 sm:pb-6 [-webkit-overflow-scrolling:touch] ${
          mobile ? "table-desktop-only" : ""
        }`}
      >
        {children}
      </div>
    </SoftCard>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const years = useMemo(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2];
  }, []);

  useEffect(() => {
    setLoading(true);
    api.get<Stats>(`/api/dashboard/stats?year=${year}`).then((res) => {
      if (res.success && res.data) setStats(res.data);
      setLoading(false);
    });
  }, [year]);

  return (
    <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden sm:space-y-7">
      <h1 className="break-words text-xl font-extrabold tracking-tight text-ink sm:text-4xl sm:text-[2.6rem]">
        Dashboard&apos;s Overview
      </h1>

      {loading && !stats ? (
        <div className="flex justify-center py-16">
          <div className="spinner" />
        </div>
      ) : (
        <>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            <OverviewCard
              label={<>Surat Masuk<br />Tahun Ini</>}
              value={stats?.masukTahunIni ?? 0}
              iconBg="bg-ok-soft"
              icon={
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3M8 11l4-4 4 4M12 7v10"
                    stroke="var(--color-ok)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            <OverviewCard
              label={<>Surat Keluar<br />Tahun Ini</>}
              value={stats?.keluarTahunIni ?? 0}
              iconBg="bg-ok-soft"
              icon={
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M16 13l-4 4-4-4M12 17V7"
                    stroke="var(--color-ok)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            <OverviewCard
              label={<>Total Surat<br />Masuk</>}
              value={stats?.totalMasuk ?? 0}
              iconBg="bg-accent-soft"
              icon={
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="9" cy="8" r="3" stroke="var(--color-accent)" strokeWidth="1.8" />
                  <circle cx="16" cy="9" r="2.5" stroke="var(--color-accent)" strokeWidth="1.8" />
                  <path
                    d="M3.5 18.5c.9-2.8 3-4.2 5.5-4.2s4.6 1.4 5.5 4.2"
                    stroke="var(--color-accent)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 14.5c1.6 0 3 .8 3.8 2.2"
                    stroke="var(--color-accent)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
            <OverviewCard
              label={<>Total Surat<br />Keluar</>}
              value={stats?.totalKeluar ?? 0}
              iconBg="bg-warn-soft"
              icon={
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 3 4.5 7v5.2c0 4.3 3.1 8.3 7.5 9.5 4.4-1.2 7.5-5.2 7.5-9.5V7L12 3Z"
                    stroke="var(--color-warn)"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.5 12h5M12 9.5v5"
                    stroke="var(--color-warn)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              }
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-5">
            <SoftCard className="min-w-0 !p-4 sm:!p-6">
              <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:mb-5 sm:gap-3">
                <h2 className="min-w-0 flex-1 break-words text-base font-extrabold text-ink sm:text-xl">
                  Grafik Surat Masuk dan Surat Keluar
                </h2>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink outline-none focus:border-brand sm:px-4 sm:py-2"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <LineChart
                series={stats?.monthlyByBidang ?? []}
                labels={stats?.monthLabels ?? MONTH_LABELS}
              />
            </SoftCard>

            <SoftCard className="min-w-0 !p-4 sm:!p-6 xl:max-w-[280px]">
              <h2 className="mb-4 break-words text-base font-extrabold leading-snug text-ink sm:mb-5 sm:text-lg">
                Distribusi Arsip Berdasarkan Bidang
              </h2>
              <DonutChart items={stats?.bidangStats ?? []} />
            </SoftCard>
          </div>

          <TableShell
            title="Arsip Surat Masuk Terbaru"
            to="/surat-masuk"
            canView={can(user, "surat-masuk.view")}
            mobile={
              (stats?.recentMasuk ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Belum ada data surat masuk.</p>
              ) : (
                stats!.recentMasuk.map((r) => (
                  <MobileCard
                    key={r.id}
                    title={r.nomorSurat}
                    subtitle={r.perihal}
                    meta={
                      <span className="tabular-nums text-[11px] font-semibold text-muted">
                        #{r.noUrut}
                      </span>
                    }
                    actions={
                      can(user, "surat-masuk.view") ? (
                        <Link
                          to="/surat-masuk"
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        >
                          Buka daftar
                        </Link>
                      ) : undefined
                    }
                  >
                    <FieldRow label="Tgl masuk" value={formatIdDate(r.tanggalMasukSurat)} />
                    <FieldRow label="Asal surat" value={r.asalSurat} />
                    <FieldRow label="Tgl surat" value={formatIdDate(r.tanggalSurat)} />
                    <FieldRow label="Kode" value={r.kodeKlasifikasi} />
                    <FieldRow label="Sub indeks" value={r.indeks || "—"} />
                    <FieldRow label="Disposisi" value={r.disposisi} />
                    <FieldRow label="Tgl disposisi" value={formatIdDate(r.tanggalDisposisi)} />
                    <FieldRow label="Keterangan" value={r.keterangan || "—"} />
                    <FieldRow label="File" value={r.hasFile ? "Ada" : "Tidak ada"} />
                  </MobileCard>
                ))
              )
            }
          >
            <table className="min-w-[1180px] w-full text-left text-sm">
              <thead>
                <tr className="bg-canvas text-ink">
                  {[
                    "No. Urut",
                    "Tanggal Masuk Surat",
                    "Asal Surat",
                    "Tanggal Surat",
                    "No. Surat",
                    "Kode Klasifikasi",
                    "Sub Indeks",
                    "Perihal",
                    "Disposisi",
                    "Tanggal Disposisi",
                    "Keterangan",
                    "Bukti Surat",
                  ].map((h, i, arr) => (
                    <th
                      key={h}
                      className={`px-4 py-3.5 font-bold leading-tight whitespace-normal first:pl-5 last:pr-5 ${
                        i === 0 ? "rounded-l-xl" : ""
                      } ${i === arr.length - 1 ? "rounded-r-xl" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats?.recentMasuk ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-10 text-center text-muted">
                      Belum ada data surat masuk.
                    </td>
                  </tr>
                ) : (
                  stats!.recentMasuk.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                       <td className="px-4 py-4 first:pl-5 tabular-nums font-semibold text-ink">{r.noUrut}</td>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-ink">
                        {formatIdDate(r.tanggalMasukSurat)}
                      </td>
                      <td className="max-w-[170px] px-4 py-4 font-semibold leading-snug text-ink whitespace-normal break-words">
                        {r.asalSurat}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-ink/80">
                        {formatIdDate(r.tanggalSurat)}
                      </td>
                      <td className="px-4 py-4 font-semibold text-ink">{r.nomorSurat}</td>
                      <td className="px-4 py-4 tabular-nums text-ink/80">{r.kodeKlasifikasi}</td>
                      <td className="max-w-[200px] px-4 py-4 leading-snug text-ink/80 whitespace-normal break-words">
                        {r.indeks || "—"}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 font-semibold leading-snug text-ink whitespace-normal break-words">
                        {r.perihal}
                      </td>
                      <td className="px-4 py-4 text-ink/80">{r.disposisi}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-ink/80">
                        {formatIdDate(r.tanggalDisposisi)}
                      </td>
                      <td className="max-w-[160px] px-4 py-4 leading-snug text-ink/80 whitespace-normal break-words">
                        {r.keterangan || "—"}
                      </td>
                      <td className="px-4 py-4 last:pr-5">
                        {r.hasFile && can(user, "surat-masuk.view") ? (
                          <Link to="/surat-masuk" className="font-semibold text-brand hover:underline">
                            Lihat
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>

          <TableShell
            title="Arsip Surat Keluar Terbaru"
            to="/surat-keluar"
            canView={can(user, "surat-keluar.view")}
            mobile={
              (stats?.recentKeluar ?? []).length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Belum ada data surat keluar.</p>
              ) : (
                stats!.recentKeluar.map((r) => (
                  <MobileCard
                    key={r.id}
                    title={r.nomorSurat}
                    subtitle={r.perihal}
                    meta={
                      <span className="tabular-nums text-[11px] font-semibold text-muted">
                        #{r.noUrut}
                      </span>
                    }
                    actions={
                      can(user, "surat-keluar.view") ? (
                        <Link
                          to="/surat-keluar"
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                        >
                          Buka daftar
                        </Link>
                      ) : undefined
                    }
                  >
                    <FieldRow label="Tgl surat" value={formatIdDate(r.tanggalSurat)} />
                    <FieldRow label="Kode" value={r.kodeKlasifikasi} />
                    <FieldRow label="Sub indeks" value={r.indeks || "—"} />
                    <FieldRow
                      label="Ditujukan"
                      value={
                        <span className="whitespace-pre-line">
                          {splitNomorPerBaris(r.ditujukanKepada)}
                        </span>
                      }
                    />
                    <FieldRow label="Pembuat" value={r.pembuat} />
                    <FieldRow label="Keterangan" value={r.keterangan || "—"} />
                    <FieldRow label="File" value={r.hasFile ? "Ada" : "Tidak ada"} />
                  </MobileCard>
                ))
              )
            }
          >
            <table className="min-w-[1060px] w-full text-left text-sm">
              <thead>
                <tr className="bg-canvas text-ink">
                  {[
                    "No. Urut",
                    "Tanggal Surat",
                    "No. Surat",
                    "Kode Klasifikasi",
                    "Sub Indeks",
                    "Perihal",
                    "Ditunjukkan Kepada",
                    "Pembuat Surat",
                    "Keterangan",
                    "Bukti Surat",
                  ].map((h, i, arr) => (
                    <th
                      key={h}
                      className={`px-4 py-3.5 font-bold leading-tight whitespace-normal first:pl-5 last:pr-5 ${
                        i === 0 ? "rounded-l-xl" : ""
                      } ${i === arr.length - 1 ? "rounded-r-xl" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(stats?.recentKeluar ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-muted">
                      Belum ada data surat keluar.
                    </td>
                  </tr>
                ) : (
                  stats!.recentKeluar.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0">
                       <td className="px-4 py-4 first:pl-5 tabular-nums font-semibold text-ink">{r.noUrut}</td>
                      <td className="px-4 py-4 whitespace-nowrap font-semibold text-ink">
                        {formatIdDate(r.tanggalSurat)}
                      </td>
                      <td className="px-4 py-4 font-semibold text-ink">{r.nomorSurat}</td>
                      <td className="px-4 py-4 tabular-nums text-ink/80">{r.kodeKlasifikasi}</td>
                      <td className="max-w-[200px] px-4 py-4 leading-snug text-ink/80 whitespace-normal break-words">
                        {r.indeks || "—"}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 font-semibold leading-snug text-ink whitespace-normal break-words">
                        {r.perihal}
                      </td>
                      <td className="max-w-[170px] px-4 py-4 font-semibold leading-snug text-ink whitespace-pre-line break-words">
                        {splitNomorPerBaris(r.ditujukanKepada)}
                      </td>
                      <td className="px-4 py-4 text-ink/80">{r.pembuat}</td>
                      <td className="max-w-[160px] px-4 py-4 leading-snug text-ink/80 whitespace-normal break-words">
                        {r.keterangan || "—"}
                      </td>
                      <td className="px-4 py-4 last:pr-5">
                        {r.hasFile && can(user, "surat-keluar.view") ? (
                          <Link to="/surat-keluar" className="font-semibold text-brand hover:underline">
                            Lihat
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableShell>
        </>
      )}
    </div>
  );
}
