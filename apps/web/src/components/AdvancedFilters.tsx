import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { api } from "../lib/api";
import {
  AsyncSearchableSelect,
  Button,
  Input,
  SearchableSelect,
  type SearchableSelectOption,
} from "./ui";

export type DatePreset = "" | "today" | "week" | "month" | "custom";

export type DateFieldMasuk = "tanggalMasukSurat" | "tanggalSurat" | "tanggalDisposisi";
export type DateFieldKeluar = "tanggalSurat";
export type DateField = DateFieldMasuk | DateFieldKeluar;

export type SuratFilterValues = {
  search: string;
  dateField: DateField;
  datePreset: DatePreset;
  dari: string;
  sampai: string;
  kodeId: string;
  indeksId: string;
  party: string;
  bidangId: string;
};

export const emptySuratFiltersMasuk: SuratFilterValues = {
  search: "",
  dateField: "tanggalMasukSurat",
  datePreset: "",
  dari: "",
  sampai: "",
  kodeId: "",
  indeksId: "",
  party: "",
  bidangId: "",
};

export const emptySuratFiltersKeluar: SuratFilterValues = {
  search: "",
  dateField: "tanggalSurat",
  datePreset: "",
  dari: "",
  sampai: "",
  kodeId: "",
  indeksId: "",
  party: "",
  bidangId: "",
};

/** @deprecated pakai emptySuratFiltersMasuk / emptySuratFiltersKeluar */
export const emptySuratFilters = emptySuratFiltersMasuk;

type Bidang = { id: number; namaBidang: string };

type DateFieldOption = { value: DateField; label: string };

type Props = {
  values: SuratFilterValues;
  onChange: (next: SuratFilterValues) => void;
  onSubmit: () => void;
  onReset: () => void;
  bidangList: Bidang[];
  showBidang: boolean;
  partyLabel: string;
  partyPlaceholder?: string;
  searchPlaceholder?: string;
  dateFieldOptions: DateFieldOption[];
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function resolveDateRange(preset: DatePreset, dari: string, sampai: string) {
  if (preset === "custom" || !preset) {
    return { dari: dari || undefined, sampai: sampai || undefined };
  }
  const now = new Date();
  const today = toYmd(now);
  if (preset === "today") return { dari: today, sampai: today };
  if (preset === "week") {
    // Senin–Minggu minggu berjalan (bukan hanya s/d hari ini)
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { dari: toYmd(start), sampai: toYmd(end) };
  }
  if (preset === "month") {
    // Tanggal 1 s/d akhir bulan berjalan (bukan hanya s/d hari ini)
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { dari: toYmd(start), sampai: toYmd(end) };
  }
  return { dari: undefined, sampai: undefined };
}

export function buildSuratQuery(
  values: SuratFilterValues,
  opts: { partyParam: "asalSurat" | "ditujukanKepada"; page?: number; perPage?: number },
) {
  const params = new URLSearchParams();
  params.set("page", String(opts.page ?? 1));
  params.set("perPage", String(opts.perPage ?? 15));
  const search = (values?.search ?? "").trim();
  if (search) params.set("search", search);
  const range = resolveDateRange(values?.datePreset ?? "", values?.dari ?? "", values?.sampai ?? "");
  if (range.dari) params.set("dari", range.dari);
  if (range.sampai) params.set("sampai", range.sampai);
  if ((range.dari || range.sampai) && values?.dateField) {
    params.set("dateField", values.dateField);
  }
  if (values?.kodeId) params.set("kodeId", values.kodeId);
  if (values?.indeksId) params.set("indeksId", values.indeksId);
  const party = (values?.party ?? "").trim();
  if (party) params.set(opts.partyParam, party);
  if (values?.bidangId) params.set("bidangId", values.bidangId);
  return params.toString();
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-brand bg-brand-soft text-brand-dark"
          : "border-line bg-surface text-muted hover:border-brand-mid hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function AdvancedFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  bidangList,
  showBidang,
  partyLabel,
  partyPlaceholder,
  searchPlaceholder = "Cari nomor surat, perihal…",
  dateFieldOptions,
}: Props) {
  const [open, setOpen] = useState(false);
  const [kodeLabel, setKodeLabel] = useState("");
  const [indeksOptions, setIndeksOptions] = useState<SearchableSelectOption[]>([]);

  const searchKode = useCallback(async (q: string): Promise<SearchableSelectOption[]> => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", "30");
    params.set("active", "1");
    params.set("forSurat", "1");
    const res = await api.get<{ id: number; kode: string; namaKelompok: string }[]>(
      `/api/master/kode/search?${params}`,
    );
    return (res.data ?? []).map((k) => ({
      value: String(k.id),
      label: `${k.kode} - ${k.namaKelompok}`,
    }));
  }, []);

  useEffect(() => {
    if (!values.kodeId) {
      setIndeksOptions([]);
      setKodeLabel("");
      return;
    }
    let cancelled = false;
    void (async () => {
      const [kodeRes, indeksRes] = await Promise.all([
        api.get<{ kode: string; namaKelompok: string }>(`/api/master/kode/${values.kodeId}`),
        api.get<{ id: number; namaIndeks: string }[]>(
          `/api/master/indeks?kodeId=${values.kodeId}&active=1`,
        ),
      ]);
      if (cancelled) return;
      if (kodeRes.data) {
        setKodeLabel(`${kodeRes.data.kode} - ${kodeRes.data.namaKelompok}`);
      }
      setIndeksOptions(
        (indeksRes.data ?? []).map((i) => ({
          value: String(i.id),
          label: i.namaIndeks,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [values.kodeId]);

  const defaultDateField = dateFieldOptions[0]?.value;
  const hasActive =
    Boolean(values.datePreset) ||
    Boolean(values.kodeId) ||
    Boolean(values.indeksId) ||
    Boolean((values.party ?? "").trim()) ||
    Boolean(values.bidangId) ||
    Boolean(values.dari) ||
    Boolean(values.sampai) ||
    (Boolean(defaultDateField) && values.dateField !== defaultDateField);

  function setPreset(preset: DatePreset) {
    if (preset === values.datePreset && preset !== "custom") {
      onChange({ ...values, datePreset: "", dari: "", sampai: "" });
      return;
    }
    if (preset === "custom") {
      onChange({ ...values, datePreset: "custom" });
      return;
    }
    onChange({ ...values, datePreset: preset, dari: "", sampai: "" });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink/90">
              <span className="text-muted">⌕</span> Search
            </span>
            <input
              className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition focus:border-brand-mid focus:ring-4 focus:ring-brand-soft"
              placeholder={searchPlaceholder}
              value={values.search}
              onChange={(e) => onChange({ ...values, search: e.target.value })}
            />
          </label>
        </div>
        {!open && (
          <Button type="submit" variant="secondary" className="shrink-0">
            Cari
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-ink"
        >
          <span className={`text-xs leading-none transition ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
          Advanced Filters
          {hasActive && (
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-dark">
              aktif
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            onReset();
            setKodeLabel("");
            setIndeksOptions([]);
            setOpen(false);
          }}
          className="text-sm font-semibold text-muted transition hover:text-ink"
        >
          Reset
        </button>
      </div>

      {open && (
        <div className="space-y-4 border-t border-line pt-4">
          <div className="space-y-2">
            <span className="text-[13px] font-semibold text-ink/90">Filter tanggal berdasarkan</span>
            <div className="flex flex-wrap gap-2">
              {dateFieldOptions.map((opt) => (
                <Chip
                  key={opt.value}
                  active={values.dateField === opt.value}
                  onClick={() => onChange({ ...values, dateField: opt.value })}
                >
                  {opt.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[13px] font-semibold text-ink/90">Rentang waktu</span>
            <div className="flex flex-wrap gap-2">
              <Chip active={values.datePreset === "today"} onClick={() => setPreset("today")}>
                Hari ini
              </Chip>
              <Chip active={values.datePreset === "week"} onClick={() => setPreset("week")}>
                Minggu ini
              </Chip>
              <Chip active={values.datePreset === "month"} onClick={() => setPreset("month")}>
                Bulan ini
              </Chip>
              <Chip active={values.datePreset === "custom"} onClick={() => setPreset("custom")}>
                Pilih Tanggal
              </Chip>
            </div>
            {values.datePreset === "custom" && (
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end">
                <Input
                  label="Tanggal Awal"
                  type="date"
                  value={values.dari}
                  onChange={(e) => onChange({ ...values, dari: e.target.value })}
                />
                <span className="hidden pb-2.5 text-muted sm:inline">–</span>
                <Input
                  label="Tanggal Akhir"
                  type="date"
                  value={values.sampai}
                  onChange={(e) => onChange({ ...values, sampai: e.target.value })}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <AsyncSearchableSelect
              label="Kode Klasifikasi"
              value={values.kodeId}
              selectedLabel={kodeLabel}
              placeholder="Semua kode"
              emptyLabel="Semua kode"
              searchPlaceholder="Cari kode atau indeks…"
              onSearch={searchKode}
              onChange={(kodeId, opt) => {
                setKodeLabel(opt?.label ?? "");
                onChange({ ...values, kodeId, indeksId: "" });
              }}
            />

            {values.kodeId ? (
              <SearchableSelect
                label="Sub Indeks"
                value={values.indeksId}
                placeholder="Semua sub indeks"
                emptyLabel="Semua sub indeks"
                searchPlaceholder="Cari sub indeks…"
                options={indeksOptions}
                onChange={(indeksId) => onChange({ ...values, indeksId })}
              />
            ) : (
              <div className="hidden sm:block" />
            )}

            <Input
              label={partyLabel}
              placeholder={partyPlaceholder}
              value={values.party}
              onChange={(e) => onChange({ ...values, party: e.target.value })}
            />

            {showBidang ? (
              <SearchableSelect
                label="Bidang"
                value={values.bidangId}
                placeholder="Semua bidang"
                emptyLabel="Semua bidang"
                searchPlaceholder="Cari bidang…"
                options={bidangList.map((b) => ({
                  value: String(b.id),
                  label: b.namaBidang,
                }))}
                onChange={(bidangId) => onChange({ ...values, bidangId })}
              />
            ) : (
              <div className="hidden sm:block" />
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="submit">Terapkan filter</Button>
          </div>
        </div>
      )}
    </form>
  );
}
