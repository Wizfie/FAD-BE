/*
  Warnings:

  - You are about to alter the column `role` on the `user` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(0))` to `Enum(EnumId(0))`.

*/
-- AlterTable
ALTER TABLE `comparisongroup` ADD COLUMN `keterangan` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `role` ENUM('EXTERNAL', 'ADMIN', 'INTERNAL') NOT NULL DEFAULT 'EXTERNAL';
