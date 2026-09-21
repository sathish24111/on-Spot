-- ==============================================================================
-- TECHRAGA '26 EVENT SPOT REGISTRATION & ADMIN COORDINATOR SYSTEM
-- DATABASE SCHEMA & INITIAL SEED CONFIGURATION
-- Engine: MySQL 8.0+ / MariaDB 10.5+ (Compatible with InnoDB & utf8mb4)
-- ==============================================================================

-- 1. Create Database if not exists
CREATE DATABASE IF NOT EXISTS `event_spot_registration`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `event_spot_registration`;

-- Disable foreign key checks during initialization
SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- TABLE 1: events
-- Master catalog of all Day 1 and Day 2 events with participant rules
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `events` (
  `id` VARCHAR(50) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `day` VARCHAR(20) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `is_standalone` TINYINT(1) NOT NULL DEFAULT 0,
  `min_participants` INT NOT NULL DEFAULT 1,
  `max_participants` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 2: students
-- Master participant records for Spot & Online registrations
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `students` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `reg_code` VARCHAR(100) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL DEFAULT '',
  `college` VARCHAR(255) NOT NULL,
  `day_selection` VARCHAR(50) NOT NULL,
  `total_fee` INT NOT NULL,
  `registration_type` VARCHAR(50) NOT NULL DEFAULT 'ONLINE',
  `food_given` TINYINT(1) NOT NULL DEFAULT 0,
  `tag_given` TINYINT(1) NOT NULL DEFAULT 0,
  `food_d2_given` TINYINT(1) NOT NULL DEFAULT 0,
  `tag_d2_given` TINYINT(1) NOT NULL DEFAULT 0,
  `counter_name` VARCHAR(100) DEFAULT NULL,
  `faculty_name` VARCHAR(255) DEFAULT NULL,
  `registered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_students_reg_code` (`reg_code`),
  INDEX `idx_students_reg_type` (`registration_type`),
  INDEX `idx_students_phone` (`phone`),
  INDEX `idx_students_name` (`name`),
  INDEX `idx_students_day_sel` (`day_selection`),
  INDEX `idx_students_counter` (`counter_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 3: student_events
-- Junction table mapping participants to registered events
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `student_events` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `student_id` INT NOT NULL,
  `event_id` VARCHAR(50) NOT NULL,
  `event_day` VARCHAR(20) NOT NULL,
  `verified_status` TINYINT(1) NOT NULL DEFAULT 0,
  `event_status` VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
  `completed_at` DATETIME DEFAULT NULL,
  `hackathon_theme` VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_se_event_id` (`event_id`),
  INDEX `idx_se_student_id` (`student_id`),
  CONSTRAINT `fk_se_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_se_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 4: freefire_teams
-- Esports tournament team registrations
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `freefire_teams` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `team_code` VARCHAR(100) NOT NULL,
  `team_name` VARCHAR(255) NOT NULL,
  `registration_source` VARCHAR(100) NOT NULL,
  `counter_name` VARCHAR(100) DEFAULT NULL,
  `faculty_name` VARCHAR(255) DEFAULT NULL,
  `registered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fft_code` (`team_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 5: freefire_players
-- Esports tournament player rosters (Solo / Team players & Captains)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `freefire_players` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `team_id` INT DEFAULT NULL,
  `name` VARCHAR(255) NOT NULL,
  `phone` VARCHAR(50) NOT NULL,
  `email` VARCHAR(255) NOT NULL DEFAULT '',
  `college` VARCHAR(255) NOT NULL,
  `registration_type` VARCHAR(50) NOT NULL,
  `is_captain` TINYINT(1) NOT NULL DEFAULT 0,
  `counter_name` VARCHAR(100) DEFAULT NULL,
  `faculty_name` VARCHAR(255) DEFAULT NULL,
  `registered_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_ff_team_id` (`team_id`),
  CONSTRAINT `fk_ff_team` FOREIGN KEY (`team_id`) REFERENCES `freefire_teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 6: edit_requests
-- Participant detail change requests submitted by coordinators for Admin approval
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `edit_requests` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `student_id` INT NOT NULL,
  `coordinator_name` VARCHAR(255) NOT NULL DEFAULT 'Coordinator',
  `event_name` VARCHAR(255) DEFAULT '',
  `old_data` TEXT NOT NULL,
  `new_data` TEXT NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `admin_name` VARCHAR(255) DEFAULT 'Admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_er_student_id` (`student_id`),
  INDEX `idx_er_status` (`status`),
  CONSTRAINT `fk_er_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 7: event_change_requests
-- Event swap / addition / removal requests submitted for Admin approval
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `event_change_requests` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `student_id` INT NOT NULL,
  `coordinator_name` VARCHAR(255) NOT NULL DEFAULT 'Coordinator',
  `event_name` VARCHAR(255) DEFAULT '',
  `old_events` TEXT NOT NULL,
  `new_events` TEXT NOT NULL,
  `reason` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `admin_name` VARCHAR(255) DEFAULT 'Admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `approved_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_ecr_student_id` (`student_id`),
  INDEX `idx_ecr_status` (`status`),
  CONSTRAINT `fk_ecr_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 8: event_teams
-- Dynamic event teams formed by Event Coordinators on desk
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `event_teams` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `team_code` VARCHAR(100) NOT NULL,
  `team_name` VARCHAR(255) NOT NULL,
  `event_id` VARCHAR(50) NOT NULL,
  `event_name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Formed',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_et_code` (`team_code`),
  INDEX `idx_et_event_id` (`event_id`),
  CONSTRAINT `fk_et_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 9: event_team_members
-- Junction table mapping participant students to event teams
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `event_team_members` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `team_id` INT NOT NULL,
  `student_id` INT NOT NULL,
  `event_id` VARCHAR(50) NOT NULL,
  `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_event_student` (`event_id`, `student_id`),
  INDEX `idx_etm_team_id` (`team_id`),
  CONSTRAINT `fk_etm_team` FOREIGN KEY (`team_id`) REFERENCES `event_teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_etm_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_etm_event` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 10: counters
-- Registration counter allocations and active faculty mapping
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `counters` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `counter_name` VARCHAR(100) NOT NULL,
  `faculty_name` VARCHAR(255) DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_counter_name` (`counter_name`),
  INDEX `idx_counters_name` (`counter_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 11: faculty_members
-- Faculty directory available for counter assignments
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `faculty_members` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `department` VARCHAR(100) NOT NULL DEFAULT 'Academics',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_faculty_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==============================================================================
-- TABLE 12: portal_credentials
-- Module-level authentication credentials for Desks, Portals & Event Desks
-- ==============================================================================
CREATE TABLE IF NOT EXISTS `portal_credentials` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `module_key` VARCHAR(100) NOT NULL,
  `module_name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'PORTAL',
  `username` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_creds_key` (`module_key`),
  INDEX `idx_creds_key` (`module_key`),
  INDEX `idx_creds_user` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- INITIAL SEED DATA
-- ==============================================================================

-- 1. Seed 21 Standard Events
INSERT INTO `events` (`id`, `name`, `day`, `category`, `is_standalone`, `min_participants`, `max_participants`) VALUES
  ('d1_adzap', 'Adzap', 'day1', 'Creative & Marketing', 0, 5, 5),
  ('d1_sharktank', 'Business Plan Presentation – Shark Tank', 'day1', 'Business & Entrepreneurship', 0, 3, 5),
  ('d1_quiz', 'Quiz', 'day1', 'Academic & Technical', 0, 2, 2),
  ('d1_designer', 'Designer Contest', 'day1', 'Design & Arts', 0, 1, 1),
  ('d1_fashion', 'Fashion Show', 'day1', 'Cultural & Performing Arts', 0, 5, 12),
  ('d1_nailart', 'Nail Art', 'day1', 'Arts & Craft', 0, 1, 2),
  ('d1_mehandi', 'Mehandi', 'day1', 'Arts & Craft', 0, 2, 2),
  ('d1_facepainting', 'Face Painting', 'day1', 'Arts & Craft', 0, 2, 2),
  ('d1_hackathon', 'Hackathon', 'day1', 'Coding & Hackathon', 0, 3, 5),
  ('d1_freefire', 'Free Fire Tournament', 'day1', 'Gaming', 1, 4, 4),
  ('d2_fixbug', 'Fix The Bug', 'day2', 'Technical & Coding', 0, 1, 1),
  ('d2_webforge', 'Webforge', 'day2', 'Technical & Web', 0, 1, 1),
  ('d2_paperspark', 'Paperspark', 'day2', 'Paper Presentation', 0, 1, 2),
  ('d2_prompting', 'Prompting The Wars', 'day2', 'AI & Tech', 0, 1, 1),
  ('d2_connection', 'Connection', 'day2', 'Fun & Strategy', 0, 2, 2),
  ('d2_solodance', 'Solo Dance', 'day2', 'Cultural & Performing Arts', 0, 1, 1),
  ('d2_groupdance', 'Group Dance', 'day2', 'Cultural & Performing Arts', 0, 8, 12),
  ('d2_solosinging', 'Solo Singing', 'day2', 'Music & Singing', 0, 1, 1),
  ('d2_photography', 'Photography Competition', 'day2', 'Media & Photography', 0, 1, 1),
  ('d2_shortfilm', 'Short Film Competition', 'day2', 'Media & Film', 0, 3, 5),
  ('d2_reels', 'Reels Creation', 'day2', 'Media & Social', 0, 3, 5)
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `day` = VALUES(`day`),
  `category` = VALUES(`category`),
  `is_standalone` = VALUES(`is_standalone`),
  `min_participants` = VALUES(`min_participants`),
  `max_participants` = VALUES(`max_participants`);

-- 2. Seed 10 Registration Counters
INSERT IGNORE INTO `counters` (`counter_name`, `faculty_name`, `status`) VALUES
  ('Counter 1', NULL, 'ACTIVE'),
  ('Counter 2', NULL, 'ACTIVE'),
  ('Counter 3', NULL, 'ACTIVE'),
  ('Counter 4', NULL, 'ACTIVE'),
  ('Counter 5', NULL, 'ACTIVE'),
  ('Counter 6', NULL, 'ACTIVE'),
  ('Counter 7', NULL, 'ACTIVE'),
  ('Counter 8', NULL, 'ACTIVE'),
  ('Counter 9', NULL, 'ACTIVE'),
  ('Counter 10', NULL, 'ACTIVE');

-- 3. Seed Faculty Members
INSERT IGNORE INTO `faculty_members` (`name`, `department`) VALUES
  ('Dr. Kumar', 'Academics'),
  ('Mrs. Priya', 'Academics'),
  ('Mr. Arun', 'Academics'),
  ('Dr. Ramesh', 'Academics'),
  ('Prof. Anita', 'Academics'),
  ('Dr. Suresh', 'Academics'),
  ('Mrs. Deepa', 'Academics'),
  ('Mr. Karthik', 'Academics'),
  ('Dr. Meenakshi', 'Academics'),
  ('Prof. Rajesh', 'Academics'),
  ('Dr. Saravanan', 'Academics'),
  ('Mrs. Lakshmi', 'Academics'),
  ('Mr. Balaji', 'Academics'),
  ('Prof. Anitha', 'Academics'),
  ('Dr. Venkatesh', 'Academics'),
  ('Mrs. Gayathri', 'Academics');

-- 4. Seed Portal & Event Desk Access Credentials
INSERT IGNORE INTO `portal_credentials` (`module_key`, `module_name`, `category`, `username`, `password`) VALUES
  -- Core Desks & Portals
  ('spot_registration', 'Spot Registration Desk', 'PORTAL', 'spot', 'spot123'),
  ('event_issue', 'Event Issue Management Desk', 'PORTAL', 'issue', 'issue123'),
  ('day2_gate', 'Day 2 Gate Search Desk', 'PORTAL', 'gate', 'gate123'),
  ('coordinator_portal', 'Coordinator Portal (Master)', 'PORTAL', 'coordinator', 'coord123'),
  ('admin_master', 'Admin Master Portal', 'PORTAL', 'admin', 'admin123'),

  -- Day 1 Event Desks
  ('d1_adzap', 'Adzap Desk', 'EVENT', 'adzap', 'adzap123'),
  ('d1_sharktank', 'Shark Tank Desk', 'EVENT', 'sharktank', 'shark123'),
  ('d1_quiz', 'Quiz Desk', 'EVENT', 'quiz', 'quiz123'),
  ('d1_designer', 'Designer Contest Desk', 'EVENT', 'designer', 'design123'),
  ('d1_fashion', 'Fashion Show Desk', 'EVENT', 'fashion', 'fashion123'),
  ('d1_nailart', 'Nail Art Desk', 'EVENT', 'nailart', 'nail123'),
  ('d1_mehandi', 'Mehandi Desk', 'EVENT', 'mehandi', 'mehandi123'),
  ('d1_facepainting', 'Face Painting Desk', 'EVENT', 'facepainting', 'face123'),
  ('d1_hackathon', 'Hackathon Desk', 'EVENT', 'hackathon', 'hack123'),
  ('d1_freefire', 'Free Fire Esports Desk', 'EVENT', 'freefire', 'ff123'),

  -- Day 2 Event Desks
  ('d2_fixthebug', 'Fix The Bug Desk', 'EVENT', 'fixthebug', 'bug123'),
  ('d2_webforge', 'Webforge Desk', 'EVENT', 'webforge', 'web123'),
  ('d2_paperspark', 'Paperspark Desk', 'EVENT', 'paperspark', 'paper123'),
  ('d2_prompting', 'Prompting The Wars Desk', 'EVENT', 'prompting', 'prompt123'),
  ('d2_connection', 'Connection Desk', 'EVENT', 'connection', 'connect123'),
  ('d2_solodance', 'Solo Dance Desk', 'EVENT', 'solodance', 'dance123'),
  ('d2_groupdance', 'Group Dance Desk', 'EVENT', 'groupdance', 'group123'),
  ('d2_solosinging', 'Solo Singing Desk', 'EVENT', 'solosinging', 'sing123'),
  ('d2_photography', 'Photography Desk', 'EVENT', 'photography', 'photo123'),
  ('d2_shortfilm', 'Short Film Desk', 'EVENT', 'shortfilm', 'film123'),
  ('d2_reels', 'Reels Creation Desk', 'EVENT', 'reels', 'reels123');
