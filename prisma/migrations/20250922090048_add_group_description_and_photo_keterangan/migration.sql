/*
  Warnings:

  - You are about to alter the column `title` on the `comparisongroup` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(191)`.

*/
-- DropForeignKey
ALTER TABLE `comparisongroup` DROP FOREIGN KEY `fk_comparisongroup_area`;

-- DropForeignKey
ALTER TABLE `photo` DROP FOREIGN KEY `fk_photo_comparison_group`;

-- AlterTable
ALTER TABLE `comparisongroup` ADD COLUMN `description` VARCHAR(500) NULL,
    MODIFY `title` VARCHAR(191) NULL,
    MODIFY `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updatedAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `photo` ADD COLUMN `keterangan` VARCHAR(500) NULL;

-- AddForeignKey
ALTER TABLE `ComparisonGroup` ADD CONSTRAINT `ComparisonGroup_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_comparisonGroupId_fkey` FOREIGN KEY (`comparisonGroupId`) REFERENCES `ComparisonGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
