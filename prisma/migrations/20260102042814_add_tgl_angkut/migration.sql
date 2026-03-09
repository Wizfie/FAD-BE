/*
  Warnings:

  - You are about to alter the column `role` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.
  - You are about to drop the `changelog` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `fad` ADD COLUMN `tglAngkut` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `programinfoimage` ADD COLUMN `title` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `modules` JSON NULL,
    MODIFY `role` ENUM('USER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE `changelog`;

-- CreateTable
CREATE TABLE `auditlog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `entity` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `operation` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `changes` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditlog_entity_operation_idx`(`entity`, `operation`),
    INDEX `auditlog_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `ProgramInfoImage_displayOrder_idx` ON `ProgramInfoImage`(`displayOrder`);

-- RenameIndex
ALTER TABLE `user` RENAME INDEX `User_username_key` TO `user_username_key`;
