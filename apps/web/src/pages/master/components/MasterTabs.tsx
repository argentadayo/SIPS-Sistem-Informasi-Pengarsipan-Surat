import type { MasterTab } from "../types";

type Props = {
  tab: MasterTab;
  canManageStruktur: boolean;
  onChange: (tab: MasterTab) => void;
};

const tabClass = (active: boolean) =>
  `min-h-10 flex-1 rounded-full px-4 py-2 text-sm font-semibold transition sm:flex-none sm:px-5 ${
    active ? "bg-brand text-on-brand shadow-sm" : "text-muted hover:text-ink"
  }`;

export function MasterTabs({ tab, canManageStruktur, onChange }: Props) {
  return (
    <div className="mb-4 flex w-full flex-wrap rounded-full border border-line bg-surface p-1 shadow-sm sm:mb-5 sm:inline-flex sm:w-auto">
      <button type="button" onClick={() => onChange("bidang")} className={tabClass(tab === "bidang")}>
        Bidang
      </button>
      <button type="button" onClick={() => onChange("kode")} className={tabClass(tab === "kode")}>
        Kode Klasifikasi
      </button>
      {canManageStruktur && (
        <button
          type="button"
          onClick={() => onChange("struktur")}
          className={tabClass(tab === "struktur")}
        >
          Kategori & Kelompok
        </button>
      )}
    </div>
  );
}
