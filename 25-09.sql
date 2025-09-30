-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               8.0.30 - MySQL Community Server - GPL
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table db_fad.area
CREATE TABLE IF NOT EXISTS `area` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Area_name_key` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table db_fad.area: ~2 rows (approximately)
INSERT INTO `area` (`id`, `name`) VALUES
	(4, 'TPS A'),
	(5, 'TPS B');

-- Dumping structure for table db_fad.comparisongroup
CREATE TABLE IF NOT EXISTS `comparisongroup` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(191) DEFAULT NULL,
  `areaId` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` datetime(3) DEFAULT NULL,
  `description` varchar(500) DEFAULT NULL,
  `keterangan` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_comparisongroup_area` (`areaId`),
  CONSTRAINT `ComparisonGroup_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `area` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Dumping data for table db_fad.comparisongroup: ~2 rows (approximately)
INSERT INTO `comparisongroup` (`id`, `title`, `areaId`, `createdAt`, `updatedAt`, `description`, `keterangan`) VALUES
	(3, 'LALA (2025-W39)', 4, '2025-09-24 07:46:49.348', NULL, NULL, NULL),
	(4, 'Area Ban (2025-W39)', 5, '2025-09-24 07:59:58.318', NULL, 'sudah di kerjakan', 'sudah di kerjakan');

-- Dumping structure for table db_fad.photo
CREATE TABLE IF NOT EXISTS `photo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `areaId` int NOT NULL,
  `filename` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `originalName` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `size` int NOT NULL,
  `url` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `takenAt` datetime(3) DEFAULT NULL,
  `category` enum('BEFORE','ACTION','AFTER') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `comparisonGroupId` int DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `thumbFilename` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumbUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `keterangan` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Photo_areaId_createdAt_idx` (`areaId`,`createdAt`),
  KEY `Photo_createdAt_idx` (`createdAt`),
  KEY `idx_photo_comparison_group` (`comparisonGroupId`),
  CONSTRAINT `Photo_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `area` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `Photo_comparisonGroupId_fkey` FOREIGN KEY (`comparisonGroupId`) REFERENCES `comparisongroup` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table db_fad.photo: ~6 rows (approximately)
INSERT INTO `photo` (`id`, `areaId`, `filename`, `originalName`, `mime`, `size`, `url`, `takenAt`, `category`, `comparisonGroupId`, `createdAt`, `thumbFilename`, `thumbUrl`, `keterangan`) VALUES
	(5, 4, 'a4886b81a04777177e7c607c4745dee7.jpg', 'IMG_5415.JPG', 'image/jpeg', 3479970, 'http://localhost:5001/uploads/a4886b81a04777177e7c607c4745dee7.jpg', '2025-09-24 00:46:00.000', 'BEFORE', 3, '2025-09-24 07:46:49.640', 'a4886b81a04777177e7c607c4745dee7_thumb.jpg', 'http://localhost:5001/uploads/a4886b81a04777177e7c607c4745dee7_thumb.jpg', NULL),
	(6, 5, '35623e1a902cee516f006f20028a5825.jpg', 'IMG_5378.JPG', 'image/jpeg', 3920614, 'http://localhost:5001/uploads/35623e1a902cee516f006f20028a5825.jpg', '2025-09-24 00:59:00.000', 'BEFORE', 4, '2025-09-24 07:59:58.907', '35623e1a902cee516f006f20028a5825_thumb.jpg', 'http://localhost:5001/uploads/35623e1a902cee516f006f20028a5825_thumb.jpg', NULL),
	(7, 5, '305d6f0db08a03605d8f8b827ea8c47b.jpg', 'IMG_5418.JPG', 'image/jpeg', 3304844, 'http://localhost:5001/uploads/305d6f0db08a03605d8f8b827ea8c47b.jpg', '2025-09-24 00:59:00.000', 'ACTION', 4, '2025-09-24 07:59:58.907', '305d6f0db08a03605d8f8b827ea8c47b_thumb.jpg', 'http://localhost:5001/uploads/305d6f0db08a03605d8f8b827ea8c47b_thumb.jpg', NULL),
	(8, 5, '283be33b8768da13613d71d551bcfba1.jpg', 'IMG_5421.JPG', 'image/jpeg', 3025900, 'http://localhost:5001/uploads/283be33b8768da13613d71d551bcfba1.jpg', '2025-09-24 00:59:00.000', 'AFTER', 4, '2025-09-24 07:59:58.907', '283be33b8768da13613d71d551bcfba1_thumb.jpg', 'http://localhost:5001/uploads/283be33b8768da13613d71d551bcfba1_thumb.jpg', NULL),
	(9, 4, '7423e95300ed5b8e07317dcab9d0efdf.jpg', 'IMG_5419.JPG', 'image/jpeg', 2973782, 'http://localhost:5001/uploads/7423e95300ed5b8e07317dcab9d0efdf.jpg', '2025-09-24 02:34:00.000', 'ACTION', 3, '2025-09-24 09:34:28.671', '7423e95300ed5b8e07317dcab9d0efdf_thumb.jpg', 'http://localhost:5001/uploads/7423e95300ed5b8e07317dcab9d0efdf_thumb.jpg', NULL),
	(10, 4, '53e0a7d8e1db7efcce807389258a88ad.jpg', 'IMG_5421.JPG', 'image/jpeg', 3025900, 'http://localhost:5001/uploads/53e0a7d8e1db7efcce807389258a88ad.jpg', '2025-09-24 02:34:00.000', 'AFTER', 3, '2025-09-24 09:34:28.671', '53e0a7d8e1db7efcce807389258a88ad_thumb.jpg', 'http://localhost:5001/uploads/53e0a7d8e1db7efcce807389258a88ad_thumb.jpg', NULL);

-- Dumping structure for table db_fad._prisma_migrations
CREATE TABLE IF NOT EXISTS `_prisma_migrations` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `checksum` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logs` text COLLATE utf8mb4_unicode_ci,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_steps_count` int unsigned NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table db_fad._prisma_migrations: ~14 rows (approximately)
INSERT INTO `_prisma_migrations` (`id`, `checksum`, `finished_at`, `migration_name`, `logs`, `rolled_back_at`, `started_at`, `applied_steps_count`) VALUES
	('07e15b68-3c55-4753-bbb8-aa1185ac312f', '4fdcde02b2ce77de0400c343f0062c0f3206f3993a5997071663a65528ba4382', '2025-09-23 06:52:24.022', '20250922090048_add_group_description_and_photo_keterangan', NULL, NULL, '2025-09-23 06:52:23.675', 1),
	('0a779def-7ee1-44e9-a643-ba5c14cf0857', '2c48ceadafd8b7ec0fa78713be257dd0b6c20c73de5a9ec19ec9973cbe5c2981', '2025-09-23 06:52:22.955', '20250818073402_add_attr_active_vendor', NULL, NULL, '2025-09-23 06:52:22.933', 1),
	('0ddc2425-9f2c-4151-a8f4-8e7fc7ce097a', '714a586d2d4464937d6dcd9a3273ecec6f0a5a1194f5cfb46283d1e7df910458', '2025-09-23 06:52:23.034', '20250820084812_add', NULL, NULL, '2025-09-23 06:52:22.956', 1),
	('17082e5f-19ed-4d58-bde7-fa3d7f28b6d5', '918adb0c49b32c49557693fbbe90528ab0a98852b4907ee98b7840181ec787f5', '2025-09-23 07:05:55.132', '20250923070555_add_user_email', NULL, NULL, '2025-09-23 07:05:55.103', 1),
	('6f9c05cf-55bb-4e76-9804-92a8e98b7cfa', '23f8b1f02772e3aecb6739b056fc829e7f5662c2ad91b1cca221b12b91cb4de2', '2025-09-23 06:52:22.931', '20250818065632_init', NULL, NULL, '2025-09-23 06:52:22.767', 1),
	('7e039f2b-3b84-4fa1-8563-050ca3726241', '7079ed7ec20ef9378ffaf4a4c9aaadf46a15fdcdd9c697e2d358214c227c3a3f', '2025-09-23 06:52:23.376', '20250917163930_add_monitor_area', NULL, NULL, '2025-09-23 06:52:23.222', 1),
	('7f152c24-5579-4561-988e-35d0405aa720', '854fa442c1be07edbccfaf2380855ff397912817bbe4d693dc01672a0472c564', '2025-09-23 07:03:58.521', '20250923070358_update_roles', NULL, NULL, '2025-09-23 07:03:58.411', 1),
	('c87e7845-f26d-4ad8-8e86-f5bf91248b3c', '8cca75bc731e5a48cf6a6e890eac314f1cf2e30b6f5c0da1285c4a71b5f01b1a', '2025-09-23 06:52:23.085', '20250821040618_alter_table_user_nullable_update_at', NULL, NULL, '2025-09-23 06:52:23.036', 1),
	('d26019ac-d060-490e-b26b-64f7c0acaa1d', 'ab9a173ed6647b65c704bd963cd6dd25ae85dac8368757b011ed14ebc24185fc', '2025-09-23 06:52:23.193', '20250825045507_init_mysql_stucture', NULL, NULL, '2025-09-23 06:52:23.106', 1),
	('e09f3e77-0765-4682-b49d-110042b127b4', 'bb8f3f5cb7ed358186fd5adc908212c396dbcc95dbf8933bda539670a7480cda', '2025-09-23 06:52:23.206', '20250826032717_set_limit_deskripsi_and_keterangan_fad', NULL, NULL, '2025-09-23 06:52:23.194', 1),
	('e92a72c8-d154-44c1-bf4c-98a2ef7d968b', 'eebad36b2850e0f7b3c39580662a5a4ee8a021c913f440281f22931cea98994d', '2025-09-23 06:52:23.673', '20250922000000_add_comparison_group', NULL, NULL, '2025-09-23 06:52:23.399', 1),
	('effe581e-a800-4d00-bbb2-19d6f7222d6a', 'e7e4e5a4a6d1bc83cb30c5f45ab2c448e00b7ba2d54fdfb7ad1f44404117425c', '2025-09-23 06:52:23.398', '20250918022355_add_field_photos', NULL, NULL, '2025-09-23 06:52:23.379', 1),
	('f192a03f-791c-4a66-b360-26821e3b33a0', '192f98dea6bc617b49af6de0e2a85a5366cd46440967ea32297d033cc6707338', '2025-09-23 06:52:23.221', '20250827032028_add_created_at_fad_model', NULL, NULL, '2025-09-23 06:52:23.207', 1),
	('f559c74d-3f2f-46d4-b62f-ffd536f32a18', '8454a950c6140fd5dcf61042fce42f8bc22a18359bf75c2119d60cdc4cc48916', '2025-09-23 06:52:23.104', '20250821084254_add_attr_status_model_user', NULL, NULL, '2025-09-23 06:52:23.086', 1);

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
