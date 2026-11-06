import { useEffect, useState } from "react";
import { Button, Input, Modal } from "./ui";

export type PrintScope = "page" | "all" | "range";

export type PrintConfig = {
  scope: PrintScope;
  noUrutFrom: string;
  noUrutTo: string;
};

const PRINT_MAX = 1000;

export function PrintConfigModal({
  open,
  onClose,
  onConfirm,
  page,
  perPage,
  total,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (cfg: PrintConfig) => void;
  page: number;
  perPage: number;
  total: number;
  loading?: boolean;
}) {
  const [scope, setScope] = useState<PrintScope>("page");
  const [noUrutFrom, setNoUrutFrom] = useState("");
  const [noUrutTo, setNoUrutTo] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setScope("page");
      setNoUrutFrom("");
      setNoUrutTo("");
      setErr(null);
    }
  }, [open]);

  const pageCount = Math.min(perPage, total);
  const allCount = Math.min(total, PRINT_MAX);

  function submit() {
    setErr(null);
    if (scope === "range") {
      const from = noUrutFrom.trim() ? Number(noUrutFrom) : NaN;
      const to = noUrutTo.trim() ? Number(noUrutTo) : NaN;
      if (!Number.isFinite(from) && !Number.isFinite(to)) {
        setErr("Isi no urut dari dan/atau sampai");
        return;
      }
      if (Number.isFinite(from) && Number.isFinite(to) && from > to) {
        setErr("No urut dari tidak boleh lebih besar dari sampai");
        return;
      }
    }
    onConfirm({ scope, noUrutFrom, noUrutTo });
  }

  const options: { value: PrintScope; title: string; desc: string }[] = [
    {
      value: "page",
      title: "Halaman ini",
      desc: `Hanya data yang tampil di tabel sekarang (hal. ${page}, ~${pageCount} baris)`,
    },
    {
      value: "all",
      title: "Semua hasil filter",
      desc: `Semua data sesuai filter aktif (maks ${PRINT_MAX} baris${
        total > PRINT_MAX ? `, dari ${total} terfilter` : total ? `, ${allCount} data` : ""
      })`,
    },
    {
      value: "range",
      title: "Rentang no urut",
      desc: "Cetak no urut tertentu (filter lanjutan tetap berlaku)",
    },
  ];

  return (
    <Modal
      open={open}
      title="Print Dokumen"
      subtitle="Atur data yang akan dicetak. Filter lanjutan tetap dipakai."
      onClose={() => !loading && onClose()}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" disabled={loading} onClick={onClose}>
            Batal
          </Button>
          <Button type="button" loading={loading} onClick={submit}>
            Preview Cetak
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-canvas px-3.5 py-3 text-xs text-muted">
          <p>
            Hasil filter saat ini:{" "}
            <strong className="text-ink">{total}</strong> data · Halaman tabel{" "}
            <strong className="text-ink">{page}</strong> · {perPage}/halaman
          </p>
          <p className="mt-1">
            Maksimal <strong className="text-ink">{PRINT_MAX}</strong> baris per cetak (preview HTML).
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-[13px] font-semibold text-slate-700 dark:text-slate-200">
            Cakupan cetak
          </legend>
          {options.map((o) => (
            <label
              key={o.value}
              className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition ${
                scope === o.value
                  ? "border-brand bg-brand-soft/40"
                  : "border-line bg-surface hover:border-brand/40"
              }`}
            >
              <input
                type="radio"
                name="print-scope"
                className="mt-1"
                checked={scope === o.value}
                onChange={() => setScope(o.value)}
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{o.title}</span>
                <span className="mt-0.5 block text-xs text-muted">{o.desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {scope === "range" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="No urut dari"
              type="number"
              min={1}
              value={noUrutFrom}
              onChange={(e) => setNoUrutFrom(e.target.value)}
              placeholder="contoh: 1"
            />
            <Input
              label="No urut sampai"
              type="number"
              min={1}
              value={noUrutTo}
              onChange={(e) => setNoUrutTo(e.target.value)}
              placeholder="contoh: 50"
            />
          </div>
        )}

        {err && <p className="text-sm font-medium text-danger">{err}</p>}
      </div>
    </Modal>
  );
}

export { PRINT_MAX };
