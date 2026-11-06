-- Align master klasifikasi with klasifikasi_arsip.sql hierarchy:
-- master_kategori -> master_kode -> master_indeks

-- Drop FKs that reference master_kode / master_indeks
ALTER TABLE `surat_masuk` DROP FOREIGN KEY `surat_masuk_kode_id_fkey`;
ALTER TABLE `surat_masuk` DROP FOREIGN KEY `surat_masuk_indeks_id_fkey`;
ALTER TABLE `surat_keluar` DROP FOREIGN KEY `surat_keluar_kode_id_fkey`;
ALTER TABLE `surat_keluar` DROP FOREIGN KEY `surat_keluar_indeks_id_fkey`;
ALTER TABLE `master_indeks` DROP FOREIGN KEY `master_indeks_kode_id_fkey`;

-- Clear dependent rows (klasifikasi master diganti total)
DELETE FROM `surat_masuk`;
DELETE FROM `surat_keluar`;
DELETE FROM `master_indeks`;
DELETE FROM `master_kode`;

-- Create master_kategori
CREATE TABLE `master_kategori` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_awal` VARCHAR(5) NOT NULL,
    `nama_kategori` VARCHAR(150) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `master_kategori_kode_awal_key`(`kode_awal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Alter master_kode
ALTER TABLE `master_kode`
  DROP COLUMN `keterangan`,
  ADD COLUMN `kategori_id` INTEGER NOT NULL,
  ADD COLUMN `has_sub_kode` BOOLEAN NOT NULL DEFAULT false,
  MODIFY `nama_kelompok` TEXT NOT NULL;

CREATE INDEX `master_kode_kategori_id_idx` ON `master_kode`(`kategori_id`);
CREATE INDEX `master_kode_status_idx` ON `master_kode`(`status`);

-- Alter master_indeks
ALTER TABLE `master_indeks`
  MODIFY `nama_indeks` VARCHAR(1000) NOT NULL,
  MODIFY `urutan_indeks` INTEGER NOT NULL;

CREATE UNIQUE INDEX `master_indeks_kode_id_urutan_indeks_key` ON `master_indeks`(`kode_id`, `urutan_indeks`);

-- Indeks opsional (kode tanpa sub-kode tidak punya indeks)
ALTER TABLE `surat_masuk` MODIFY `indeks_id` INTEGER NULL;
ALTER TABLE `surat_keluar` MODIFY `indeks_id` INTEGER NULL;

-- Restore FKs
ALTER TABLE `master_kode`
  ADD CONSTRAINT `master_kode_kategori_id_fkey`
  FOREIGN KEY (`kategori_id`) REFERENCES `master_kategori`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `master_indeks`
  ADD CONSTRAINT `master_indeks_kode_id_fkey`
  FOREIGN KEY (`kode_id`) REFERENCES `master_kode`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `surat_masuk`
  ADD CONSTRAINT `surat_masuk_kode_id_fkey`
  FOREIGN KEY (`kode_id`) REFERENCES `master_kode`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `surat_masuk`
  ADD CONSTRAINT `surat_masuk_indeks_id_fkey`
  FOREIGN KEY (`indeks_id`) REFERENCES `master_indeks`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `surat_keluar`
  ADD CONSTRAINT `surat_keluar_kode_id_fkey`
  FOREIGN KEY (`kode_id`) REFERENCES `master_kode`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `surat_keluar`
  ADD CONSTRAINT `surat_keluar_indeks_id_fkey`
  FOREIGN KEY (`indeks_id`) REFERENCES `master_indeks`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
