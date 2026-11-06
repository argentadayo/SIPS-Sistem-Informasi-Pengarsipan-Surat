export type Bidang = {
  id: number;
  namaBidang: string;
  singkatan: string;
  status: boolean;
};

export type Kategori = {
  id: number;
  kodeAwal: string;
  namaKategori: string;
  status: boolean;
};

export type Indeks = {
  id: number;
  namaIndeks: string;
  urutanIndeks: number;
  status: boolean;
};

export type Kode = {
  id: number;
  kategoriId: number;
  kode: string;
  namaKelompok: string;
  hasSubKode: boolean;
  status: boolean;
  kategori?: { id: number; kodeAwal: string; namaKategori: string };
  kelompok?: { id: number; kode: string; namaKelompok: string } | null;
  _count?: { indeks: number };
};

export type MasterTab = "bidang" | "kode" | "struktur";
export type StrukturSub = "kategori" | "kelompok";

export type PageMeta = {
  page: number;
  totalPages: number;
  total: number;
};
