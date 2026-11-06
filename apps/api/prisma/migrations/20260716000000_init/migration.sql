-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `guard_name` VARCHAR(50) NOT NULL DEFAULT 'web',
    `deskripsi` VARCHAR(255) NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `guard_name` VARCHAR(50) NOT NULL DEFAULT 'web',
    `deskripsi` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `permissions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_has_permissions` (
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bidang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_bidang` VARCHAR(150) NOT NULL,
    `singkatan` VARCHAR(20) NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(150) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role_id` INTEGER NOT NULL,
    `bidang_id` INTEGER NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_role_id_idx`(`role_id`),
    INDEX `users_bidang_id_idx`(`bidang_id`),
    INDEX `users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(64) NOT NULL,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(128) NOT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_kode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(20) NOT NULL,
    `nama_kelompok` VARCHAR(150) NOT NULL,
    `keterangan` TEXT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `master_kode_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `master_indeks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode_id` INTEGER NOT NULL,
    `nama_indeks` VARCHAR(150) NOT NULL,
    `urutan_indeks` INTEGER NOT NULL DEFAULT 0,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `master_indeks_kode_id_idx`(`kode_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `surat_masuk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no_urut` INTEGER NOT NULL,
    `tanggal_masuk_surat` DATE NOT NULL,
    `asal_surat` VARCHAR(255) NOT NULL,
    `tanggal_surat` DATE NOT NULL,
    `nomor_surat` VARCHAR(100) NOT NULL,
    `kode_id` INTEGER NOT NULL,
    `indeks_id` INTEGER NOT NULL,
    `perihal` VARCHAR(500) NOT NULL,
    `bidang_id` INTEGER NOT NULL,
    `tanggal_disposisi` DATE NULL,
    `keterangan` TEXT NULL,
    `file_path` VARCHAR(255) NULL,
    `file_original_name` VARCHAR(255) NULL,
    `file_mime` VARCHAR(100) NULL,
    `file_size` INTEGER NULL,
    `ocr_text` LONGTEXT NULL,
    `created_by` INTEGER NOT NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `surat_masuk_no_urut_key`(`no_urut`),
    INDEX `surat_masuk_tanggal_masuk_surat_idx`(`tanggal_masuk_surat`),
    INDEX `surat_masuk_nomor_surat_idx`(`nomor_surat`),
    INDEX `surat_masuk_bidang_id_idx`(`bidang_id`),
    INDEX `surat_masuk_kode_id_idx`(`kode_id`),
    INDEX `surat_masuk_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `surat_keluar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `no_urut` INTEGER NOT NULL,
    `tanggal_surat` DATE NOT NULL,
    `nomor_surat` VARCHAR(100) NOT NULL,
    `kode_id` INTEGER NOT NULL,
    `indeks_id` INTEGER NOT NULL,
    `perihal` VARCHAR(500) NOT NULL,
    `ditujukan_kepada` VARCHAR(255) NOT NULL,
    `bidang_id` INTEGER NOT NULL,
    `keterangan` TEXT NULL,
    `file_path` VARCHAR(255) NULL,
    `file_original_name` VARCHAR(255) NULL,
    `file_mime` VARCHAR(100) NULL,
    `file_size` INTEGER NULL,
    `ocr_text` LONGTEXT NULL,
    `created_by` INTEGER NOT NULL,
    `updated_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `surat_keluar_no_urut_key`(`no_urut`),
    INDEX `surat_keluar_tanggal_surat_idx`(`tanggal_surat`),
    INDEX `surat_keluar_nomor_surat_idx`(`nomor_surat`),
    INDEX `surat_keluar_bidang_id_idx`(`bidang_id`),
    INDEX `surat_keluar_kode_id_idx`(`kode_id`),
    INDEX `surat_keluar_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `action` VARCHAR(50) NOT NULL,
    `entity` VARCHAR(50) NOT NULL,
    `entity_id` INTEGER NULL,
    `detail` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_user_id_idx`(`user_id`),
    INDEX `audit_logs_entity_entity_id_idx`(`entity`, `entity_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `role_has_permissions` ADD CONSTRAINT `role_has_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `role_has_permissions` ADD CONSTRAINT `role_has_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `users` ADD CONSTRAINT `users_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `master_indeks` ADD CONSTRAINT `master_indeks_kode_id_fkey` FOREIGN KEY (`kode_id`) REFERENCES `master_kode`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `surat_masuk` ADD CONSTRAINT `surat_masuk_kode_id_fkey` FOREIGN KEY (`kode_id`) REFERENCES `master_kode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_masuk` ADD CONSTRAINT `surat_masuk_indeks_id_fkey` FOREIGN KEY (`indeks_id`) REFERENCES `master_indeks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_masuk` ADD CONSTRAINT `surat_masuk_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_masuk` ADD CONSTRAINT `surat_masuk_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_masuk` ADD CONSTRAINT `surat_masuk_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `surat_keluar` ADD CONSTRAINT `surat_keluar_kode_id_fkey` FOREIGN KEY (`kode_id`) REFERENCES `master_kode`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_keluar` ADD CONSTRAINT `surat_keluar_indeks_id_fkey` FOREIGN KEY (`indeks_id`) REFERENCES `master_indeks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_keluar` ADD CONSTRAINT `surat_keluar_bidang_id_fkey` FOREIGN KEY (`bidang_id`) REFERENCES `bidang`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_keluar` ADD CONSTRAINT `surat_keluar_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `surat_keluar` ADD CONSTRAINT `surat_keluar_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
