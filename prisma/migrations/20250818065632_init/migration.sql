-- CreateTable
CREATE TABLE `Fad` (
    `id` VARCHAR(191) NOT NULL,
    `noFad` VARCHAR(191) NULL,
    `item` VARCHAR(191) NULL,
    `plant` VARCHAR(191) NULL,
    `terimaFad` DATETIME(3) NULL,
    `terimaBbm` DATETIME(3) NULL,
    `vendor` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `deskripsi` VARCHAR(191) NULL,
    `keterangan` VARCHAR(191) NULL,
    `bast` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vendor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Vendor_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Fad` ADD CONSTRAINT `Fad_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
