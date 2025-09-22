-- Migration: add_comparison_group_and_category
-- Adds ComparisonGroup table and category + comparisonGroupId to Photo

START TRANSACTION;

-- Create comparison_group table
CREATE TABLE IF NOT EXISTS `ComparisonGroup` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NULL,
  `areaId` INT NULL,
  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` DATETIME NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_comparisongroup_area` (`areaId`)
) ENGINE=InnoDB;

-- Add category enum column to Photo
ALTER TABLE `Photo`
  ADD COLUMN `category` ENUM('BEFORE','ACTION','AFTER') NULL AFTER `takenAt`;

-- Add comparisonGroupId to Photo
ALTER TABLE `Photo`
  ADD COLUMN `comparisonGroupId` INT NULL AFTER `category`,
  ADD INDEX `idx_photo_comparison_group` (`comparisonGroupId`);

-- Add FK from Photo(comparisonGroupId) to ComparisonGroup(id)
ALTER TABLE `Photo`
  ADD CONSTRAINT `fk_photo_comparison_group` FOREIGN KEY (`comparisonGroupId`) REFERENCES `ComparisonGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Add FK from ComparisonGroup(areaId) to Area(id)
ALTER TABLE `ComparisonGroup`
  ADD CONSTRAINT `fk_comparisongroup_area` FOREIGN KEY (`areaId`) REFERENCES `Area`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
