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

-- Dumping data for table db_fad.area: ~4 rows (approximately)
INSERT INTO `area` (`id`, `name`) VALUES
	(3, 'TPS A'),
	(2, 'TPS B'),
	(4, 'TPS C'),
	(5, 'TPS D');

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
  `createdAt` datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `thumbFilename` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `thumbUrl` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `Photo_areaId_createdAt_idx` (`areaId`,`createdAt`),
  KEY `Photo_createdAt_idx` (`createdAt`),
  CONSTRAINT `Photo_areaId_fkey` FOREIGN KEY (`areaId`) REFERENCES `area` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table db_fad.photo: ~6 rows (approximately)
INSERT INTO `photo` (`id`, `areaId`, `filename`, `originalName`, `mime`, `size`, `url`, `takenAt`, `createdAt`, `thumbFilename`, `thumbUrl`) VALUES
	(8, 3, '1a26bfab58ec17981e8107854ecf6c32.jpg', 'WhatsApp Image 2025-05-10 at 09.03.13_881c9945.jpg', 'image/jpeg', 67369, 'http://localhost:5001/uploads/1a26bfab58ec17981e8107854ecf6c32.jpg', NULL, '2025-09-19 03:08:56.331', '1a26bfab58ec17981e8107854ecf6c32_thumb.jpg', 'http://localhost:5001/uploads/1a26bfab58ec17981e8107854ecf6c32_thumb.jpg'),
	(10, 2, '620efebb32de2c590b2ff485839f6838.jpg', 'IMG_6766.JPG', 'image/jpeg', 3559198, 'http://localhost:5001/uploads/620efebb32de2c590b2ff485839f6838.jpg', NULL, '2025-09-19 04:06:52.151', '620efebb32de2c590b2ff485839f6838_thumb.jpg', 'http://localhost:5001/uploads/620efebb32de2c590b2ff485839f6838_thumb.jpg'),
	(11, 4, '23cde0a4014caf45ac6cfff9eafb4163.jpg', 'IMG_5380.JPG', 'image/jpeg', 4174055, 'http://localhost:5001/uploads/23cde0a4014caf45ac6cfff9eafb4163.jpg', NULL, '2025-09-12 04:07:00.966', '23cde0a4014caf45ac6cfff9eafb4163_thumb.jpg', 'http://localhost:5001/uploads/23cde0a4014caf45ac6cfff9eafb4163_thumb.jpg'),
	(12, 4, '72bd9c025df63a3825301c72c8b6a778.jpg', 'IMG_5447.JPG', 'image/jpeg', 4001721, 'http://localhost:5001/uploads/72bd9c025df63a3825301c72c8b6a778.jpg', NULL, '2025-09-18 04:09:00.266', '72bd9c025df63a3825301c72c8b6a778_thumb.jpg', 'http://localhost:5001/uploads/72bd9c025df63a3825301c72c8b6a778_thumb.jpg'),
	(13, 5, '1a1f67481ebbcf822b8350efbcc75b8b.jpg', 'IMG_6779.JPG', 'image/jpeg', 2822895, 'http://localhost:5001/uploads/1a1f67481ebbcf822b8350efbcc75b8b.jpg', NULL, '2025-09-19 04:09:41.688', '1a1f67481ebbcf822b8350efbcc75b8b_thumb.jpg', 'http://localhost:5001/uploads/1a1f67481ebbcf822b8350efbcc75b8b_thumb.jpg');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
