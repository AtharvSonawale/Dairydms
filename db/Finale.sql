CREATE TABLE `admins` (
   `admin_id` int NOT NULL AUTO_INCREMENT,
   `centre_id` int NOT NULL,
   `name` varchar(100) NOT NULL,
   `email` varchar(100) NOT NULL,
   `password_hash` varchar(255) NOT NULL,
   `mobile` varchar(15) DEFAULT NULL,
   `is_active` tinyint(1) DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`admin_id`),
   UNIQUE KEY `email` (`email`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `admins_ibfk_1` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `app_settings` (
   `id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `setting_key` varchar(50) NOT NULL,
   `setting_value` varchar(100) NOT NULL,
   PRIMARY KEY (`id`),
   UNIQUE KEY `unique_op_key` (`operator_id`,`setting_key`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `app_settings_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`) ON DELETE CASCADE,
   CONSTRAINT `app_settings_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `bill_cash_advance_snapshot` (
   `id` bigint NOT NULL AUTO_INCREMENT,
   `bill_id` bigint NOT NULL,
   `centre_id` int NOT NULL,
   `advance_before` decimal(12,2) DEFAULT NULL,
   `installment_cut` decimal(12,2) DEFAULT NULL,
   `advance_after` decimal(12,2) DEFAULT NULL,
   PRIMARY KEY (`id`),
   KEY `bill_id` (`bill_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bill_cash_advance_snapshot_ibfk_1` FOREIGN KEY (`bill_id`) REFERENCES `bill_master` (`bill_id`) ON DELETE CASCADE,
   CONSTRAINT `bill_cash_advance_snapshot_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `bill_deposit_snapshot` (
   `id` bigint NOT NULL AUTO_INCREMENT,
   `bill_id` bigint NOT NULL,
   `centre_id` int NOT NULL,
   `deposit_per_litre` decimal(8,2) DEFAULT NULL,
   `total_milk_qty` decimal(10,2) DEFAULT NULL,
   `deposit_amount` decimal(10,2) DEFAULT NULL,
   `deposit_balance_before` decimal(10,2) DEFAULT NULL,
   `deposit_balance_after` decimal(10,2) DEFAULT NULL,
   PRIMARY KEY (`id`),
   KEY `idx_bill_deposit_snapshot_bill_id` (`bill_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bill_deposit_snapshot_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`),
   CONSTRAINT `fk_bill_deposit_snapshot_bill` FOREIGN KEY (`bill_id`) REFERENCES `bill_master` (`bill_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `bill_master` (
   `bill_id` bigint NOT NULL AUTO_INCREMENT,
   `bill_no` varchar(50) NOT NULL,
   `seller_id` int NOT NULL,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `seller_code` varchar(30) DEFAULT NULL,
   `seller_name` varchar(150) DEFAULT NULL,
   `from_date` date NOT NULL,
   `to_date` date NOT NULL,
   `milk_amount` decimal(12,2) DEFAULT '0.00',
   `advance_balance` decimal(12,2) DEFAULT '0.00',
   `installment_cut` decimal(12,2) DEFAULT '0.00',
   `deposit_amount` decimal(12,2) DEFAULT '0.00',
   `product_deduction` decimal(12,2) DEFAULT '0.00',
   `walkin_deduction` decimal(12,2) DEFAULT '0.00',
   `tds_amount` decimal(12,2) DEFAULT '0.00',
   `final_payable` decimal(12,2) DEFAULT '0.00',
   `cash_paid` decimal(12,2) DEFAULT '0.00',
   `total_qty` decimal(12,2) DEFAULT '0.00',
   `total_entries` int DEFAULT '0',
   `paid_at` datetime NOT NULL,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`bill_id`),
   UNIQUE KEY `bill_no` (`bill_no`),
   KEY `idx_bill_no` (`bill_no`),
   KEY `idx_seller` (`seller_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bill_master_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `bill_milk_entries` (
   `id` bigint NOT NULL AUTO_INCREMENT,
   `bill_id` bigint NOT NULL,
   `centre_id` int NOT NULL,
   `original_entry_id` int DEFAULT NULL,
   `entry_date` date DEFAULT NULL,
   `shift` enum('morning','evening') DEFAULT NULL,
   `milk_type` enum('cow','buffalo') DEFAULT NULL,
   `quantity` decimal(10,2) DEFAULT NULL,
   `fat` decimal(5,2) DEFAULT NULL,
   `snf` decimal(5,2) DEFAULT NULL,
   `water` decimal(5,2) DEFAULT NULL,
   `clr` decimal(5,2) DEFAULT NULL,
   `rate_applied` decimal(10,2) DEFAULT NULL,
   `is_premium` tinyint(1) DEFAULT '0',
   `total_amount` decimal(12,2) DEFAULT NULL,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `bill_id` (`bill_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bill_milk_entries_ibfk_1` FOREIGN KEY (`bill_id`) REFERENCES `bill_master` (`bill_id`) ON DELETE CASCADE,
   CONSTRAINT `bill_milk_entries_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `bill_product_sales` (
   `id` bigint NOT NULL AUTO_INCREMENT,
   `bill_id` bigint NOT NULL,
   `centre_id` int NOT NULL,
   `sale_id` int DEFAULT NULL,
   `product_name` varchar(200) DEFAULT NULL,
   `quantity` decimal(10,2) DEFAULT NULL,
   `rate` decimal(10,2) DEFAULT NULL,
   `total_amount` decimal(12,2) DEFAULT NULL,
   PRIMARY KEY (`id`),
   KEY `bill_id` (`bill_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bill_product_sales_ibfk_1` FOREIGN KEY (`bill_id`) REFERENCES `bill_master` (`bill_id`) ON DELETE CASCADE,
   CONSTRAINT `bill_product_sales_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `bill_walkin_sales` (
   `id` bigint NOT NULL AUTO_INCREMENT,
   `bill_id` bigint NOT NULL,
   `centre_id` int NOT NULL,
   `sale_id` int DEFAULT NULL,
   `buyer_name` varchar(100) DEFAULT NULL,
   `milk_type` enum('cow','buffalo') DEFAULT NULL,
   `quantity` decimal(8,2) DEFAULT NULL,
   `mrp` decimal(8,2) DEFAULT NULL,
   `total_amount` decimal(10,2) DEFAULT NULL,
   `payment_mode` enum('cash','upi','credit') DEFAULT NULL,
   `shift` enum('morning','evening') DEFAULT NULL,
   `sale_date` date DEFAULT NULL,
   PRIMARY KEY (`id`),
   KEY `idx_bill_walkin_sales_bill_id` (`bill_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bill_walkin_sales_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`),
   CONSTRAINT `fk_bill_walkin_sales_bill` FOREIGN KEY (`bill_id`) REFERENCES `bill_master` (`bill_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `bonus_events` (
   `event_id` int NOT NULL AUTO_INCREMENT,
   `centre_id` int NOT NULL,
   `event_name` varchar(150) NOT NULL,
   `occasion` enum('diwali','holi','eid','custom') NOT NULL DEFAULT 'diwali',
   `from_date` date NOT NULL,
   `to_date` date NOT NULL,
   `is_active` tinyint(1) NOT NULL DEFAULT '1',
   `created_by` int DEFAULT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`event_id`),
   KEY `created_by` (`created_by`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bonus_events_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `bonus_events_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `bonus_payments` (
   `payment_id` int NOT NULL AUTO_INCREMENT,
   `event_id` int NOT NULL,
   `seller_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `total_qty` decimal(10,2) NOT NULL DEFAULT '0.00',
   `total_bonus` decimal(12,2) NOT NULL DEFAULT '0.00',
   `is_paid` tinyint(1) NOT NULL DEFAULT '0',
   `paid_at` datetime DEFAULT NULL,
   `paid_by` int DEFAULT NULL,
   `remarks` text,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`payment_id`),
   UNIQUE KEY `uq_bonus_payment` (`event_id`,`seller_id`),
   KEY `seller_id` (`seller_id`),
   KEY `paid_by` (`paid_by`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bonus_payments_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `bonus_events` (`event_id`) ON DELETE CASCADE,
   CONSTRAINT `bonus_payments_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `bonus_payments_ibfk_3` FOREIGN KEY (`paid_by`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `bonus_payments_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `bonus_register` (
   `id` int NOT NULL AUTO_INCREMENT,
   `event_id` int NOT NULL,
   `seller_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `slab_id` int NOT NULL,
   `total_qty` decimal(10,2) NOT NULL DEFAULT '0.00',
   `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
   `computed_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   UNIQUE KEY `uq_register` (`event_id`,`seller_id`,`slab_id`),
   KEY `seller_id` (`seller_id`),
   KEY `slab_id` (`slab_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bonus_register_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `bonus_events` (`event_id`) ON DELETE CASCADE,
   CONSTRAINT `bonus_register_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `bonus_register_ibfk_3` FOREIGN KEY (`slab_id`) REFERENCES `bonus_slabs` (`slab_id`),
   CONSTRAINT `bonus_register_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `bonus_slabs` (
   `slab_id` int NOT NULL AUTO_INCREMENT,
   `event_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `fat_min` decimal(5,2) NOT NULL,
   `fat_max` decimal(5,2) NOT NULL,
   `bonus` decimal(8,2) NOT NULL DEFAULT '0.00',
   `vahatuk` decimal(8,2) NOT NULL DEFAULT '1.00',
   `rate` decimal(8,2) NOT NULL,
   `sort_order` int NOT NULL DEFAULT '0',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`slab_id`),
   UNIQUE KEY `uq_event_fat` (`event_id`,`fat_min`,`fat_max`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `bonus_slabs_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `bonus_events` (`event_id`) ON DELETE CASCADE,
   CONSTRAINT `bonus_slabs_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `buffalo_milk_rates` (
   `rate_id` int NOT NULL AUTO_INCREMENT,
   `centre_id` int DEFAULT NULL,
   `fat` decimal(4,2) NOT NULL,
   `snf` decimal(4,2) NOT NULL,
   `rate` decimal(8,2) NOT NULL,
   `mrp` decimal(8,2) DEFAULT NULL,
   `effective_from` date NOT NULL,
   `effective_to` date DEFAULT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`rate_id`),
   UNIQUE KEY `uq_buf_centre_fat_snf_date` (`centre_id`,`fat`,`snf`,`effective_from`),
   KEY `idx_centre_id` (`centre_id`),
   CONSTRAINT `buffalo_milk_rates_ibfk_1` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `cash_advance` (
   `id` int NOT NULL AUTO_INCREMENT,
   `seller_id` int NOT NULL,
   `operator_id` int DEFAULT NULL,
   `centre_id` int NOT NULL,
   `type` enum('given','received') NOT NULL,
   `amount` decimal(10,2) NOT NULL,
   `transaction_date` date NOT NULL,
   `remarks` text,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `seller_id` (`seller_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `cash_advance_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `cash_advance_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `cash_advance_ibfk_3` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `centres` (
   `centre_id` int NOT NULL AUTO_INCREMENT,
   `dairy_id` int NOT NULL,
   `centre_name` varchar(150) NOT NULL,
   `centre_code` varchar(20) NOT NULL,
   `address` text,
   `contact_number` varchar(15) DEFAULT NULL,
   `is_active` tinyint(1) NOT NULL DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`centre_id`),
   UNIQUE KEY `centre_code` (`centre_code`),
   KEY `dairy_id` (`dairy_id`),
   CONSTRAINT `centres_ibfk_1` FOREIGN KEY (`dairy_id`) REFERENCES `dairies` (`dairy_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `cow_milk_rates` (
   `rate_id` int NOT NULL AUTO_INCREMENT,
   `centre_id` int DEFAULT NULL,
   `fat` decimal(4,2) NOT NULL,
   `snf` decimal(4,2) NOT NULL,
   `rate` decimal(8,2) NOT NULL,
   `mrp` decimal(8,2) DEFAULT NULL,
   `effective_from` date NOT NULL,
   `effective_to` date DEFAULT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`rate_id`),
   UNIQUE KEY `uq_cow_centre_fat_snf_date` (`centre_id`,`fat`,`snf`,`effective_from`),
   KEY `idx_centre_id` (`centre_id`),
   CONSTRAINT `cow_milk_rates_ibfk_1` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `dairies` (
   `dairy_id` int NOT NULL AUTO_INCREMENT,
   `dairy_name` varchar(150) NOT NULL,
   `dairy_code` varchar(20) NOT NULL,
   `address` text,
   `contact_number` varchar(15) DEFAULT NULL,
   `is_active` tinyint(1) NOT NULL DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`dairy_id`),
   UNIQUE KEY `dairy_code` (`dairy_code`)
 ) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `excel_export_config` (
   `id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `plant_code` varchar(50) NOT NULL DEFAULT 'DAIRYCMS',
   `code` varchar(50) NOT NULL DEFAULT 'RPAY',
   `payment_mode` varchar(50) NOT NULL DEFAULT 'NEFT',
   `dairy_acc_no` varchar(50) NOT NULL DEFAULT '1111111111',
   `code2` varchar(10) NOT NULL DEFAULT 'M',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `fk_eec_centre` (`centre_id`),
   KEY `excel_export_config_ibfk_1` (`operator_id`),
   CONSTRAINT `excel_export_config_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`) ON DELETE CASCADE,
   CONSTRAINT `fk_eec_centre` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `gavali_bonus_events` (
   `event_id` int NOT NULL AUTO_INCREMENT,
   `centre_id` int NOT NULL,
   `event_name` varchar(150) NOT NULL,
   `occasion` enum('diwali','holi','eid','custom') NOT NULL DEFAULT 'diwali',
   `from_date` date NOT NULL,
   `to_date` date NOT NULL,
   `cow_bonus` decimal(8,2) NOT NULL DEFAULT '0.25',
   `buffalo_bonus` decimal(8,2) NOT NULL DEFAULT '0.50',
   `is_active` tinyint(1) NOT NULL DEFAULT '1',
   `created_by` int DEFAULT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`event_id`),
   KEY `created_by` (`created_by`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `gavali_bonus_events_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `gavali_bonus_events_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `gavali_bonus_payments` (
   `payment_id` int NOT NULL AUTO_INCREMENT,
   `event_id` int NOT NULL,
   `seller_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `cow_qty` decimal(10,2) NOT NULL DEFAULT '0.00',
   `buffalo_qty` decimal(10,2) NOT NULL DEFAULT '0.00',
   `total_qty` decimal(10,2) NOT NULL DEFAULT '0.00',
   `total_bonus` decimal(12,2) NOT NULL DEFAULT '0.00',
   `is_paid` tinyint(1) NOT NULL DEFAULT '0',
   `paid_at` datetime DEFAULT NULL,
   `paid_by` int DEFAULT NULL,
   `remarks` text,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`payment_id`),
   UNIQUE KEY `uq_gavali_bonus_payment` (`event_id`,`seller_id`),
   KEY `seller_id` (`seller_id`),
   KEY `paid_by` (`paid_by`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `gavali_bonus_payments_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `gavali_bonus_events` (`event_id`),
   CONSTRAINT `gavali_bonus_payments_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `gavali_bonus_payments_ibfk_3` FOREIGN KEY (`paid_by`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `gavali_bonus_payments_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `generated_rates` (
   `id` int NOT NULL AUTO_INCREMENT,
   `milk_type` enum('cow','buffalo') NOT NULL,
   `fat` decimal(4,2) NOT NULL,
   `snf` decimal(4,2) NOT NULL,
   `rate` decimal(8,2) NOT NULL,
   `mrp` decimal(8,2) DEFAULT NULL,
   `rate_date` date NOT NULL,
   `generated_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `operator_id` int DEFAULT NULL,
   `centre_id` int NOT NULL,
   PRIMARY KEY (`id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `generated_rates_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `generated_rates_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `global_settings` (
   `id` int NOT NULL AUTO_INCREMENT,
   `dairy_id` int DEFAULT NULL,
   `setting_key` varchar(50) NOT NULL,
   `setting_value` text NOT NULL,
   `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   UNIQUE KEY `uq_dairy_setting` (`dairy_id`,`setting_key`),
   KEY `idx_dairy_id` (`dairy_id`),
   CONSTRAINT `global_settings_ibfk_1` FOREIGN KEY (`dairy_id`) REFERENCES `dairies` (`dairy_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `milk_entries` (
   `entry_id` int NOT NULL AUTO_INCREMENT,
   `seller_id` int NOT NULL,
   `operator_id` int DEFAULT NULL,
   `centre_id` int NOT NULL,
   `created_by_admin_id` int DEFAULT NULL,
   `seller_type` enum('Utpadak','Gavali') NOT NULL DEFAULT 'Utpadak',
   `entry_date` date NOT NULL,
   `shift` enum('morning','evening') NOT NULL,
   `milk_type` enum('cow','buffalo') NOT NULL,
   `quantity` decimal(8,2) NOT NULL,
   `fat` decimal(5,2) NOT NULL,
   `snf` decimal(5,2) NOT NULL,
   `water` decimal(5,2) DEFAULT '0.00',
   `rate_applied` decimal(8,2) NOT NULL,
   `is_premium` tinyint(1) DEFAULT '0',
   `total_amount` decimal(10,2) NOT NULL,
   `entry_time` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`entry_id`),
   KEY `fk_milk_operator_idx` (`operator_id`),
   KEY `fk_milk_seller_idx` (`seller_id`),
   KEY `created_by_admin_id` (`created_by_admin_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `fk_milk_admin` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT `fk_milk_operator` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`) ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT `fk_milk_seller` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`) ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT `milk_entries_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `operator_permissions` (
   `id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `page_key` varchar(50) NOT NULL,
   `can_create` tinyint(1) DEFAULT '0',
   `can_read` tinyint(1) DEFAULT '0',
   `can_update` tinyint(1) DEFAULT '0',
   `can_delete` tinyint(1) DEFAULT '0',
   PRIMARY KEY (`id`),
   UNIQUE KEY `unique_op_page` (`operator_id`,`page_key`),
   CONSTRAINT `operator_permissions_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=298 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `operators` (
   `operator_id` int NOT NULL AUTO_INCREMENT,
   `admin_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `name` varchar(100) NOT NULL,
   `email` varchar(100) NOT NULL,
   `password_hash` varchar(255) NOT NULL,
   `mobile` varchar(15) DEFAULT NULL,
   `is_active` tinyint(1) DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`operator_id`),
   UNIQUE KEY `email` (`email`),
   KEY `admin_id` (`admin_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `operators_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`admin_id`),
   CONSTRAINT `operators_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `owner_usage` (
   `usage_id` int NOT NULL AUTO_INCREMENT,
   `usage_date` date NOT NULL,
   `shift` enum('morning','evening') NOT NULL,
   `milk_type` enum('cow','buffalo') NOT NULL,
   `quantity` decimal(8,2) NOT NULL,
   `purpose` varchar(200) DEFAULT 'Personal use',
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`usage_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `owner_usage_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `owner_usage_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

 CREATE TABLE `password_reset_otps` (
   `id` int NOT NULL AUTO_INCREMENT,
   `email` varchar(100) NOT NULL,
   `otp` varchar(10) NOT NULL,
   `used` tinyint(1) DEFAULT '0',
   `expires_at` datetime NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `idx_email` (`email`),
   KEY `idx_otp` (`otp`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `payment_cycle_config` (
   `id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `seed_from` date NOT NULL,
   `days_per_cycle` int NOT NULL DEFAULT '10',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   UNIQUE KEY `unique_centre` (`centre_id`),
   KEY `operator_id` (`operator_id`),
   CONSTRAINT `payment_cycle_config_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`) ON DELETE CASCADE,
   CONSTRAINT `payment_cycle_config_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `premium_rates` (
   `id` int NOT NULL AUTO_INCREMENT,
   `seller_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `milk_type` enum('cow','buffalo') NOT NULL,
   `rate_per_liter` decimal(8,2) NOT NULL,
   `reason` text,
   `effective_from` date NOT NULL,
   `effective_to` date DEFAULT NULL,
   `is_active` tinyint(1) DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `seller_id` (`seller_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `premium_rates_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `premium_rates_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `product_purchases` (
   `purchase_id` int NOT NULL AUTO_INCREMENT,
   `product_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `product_name` varchar(255) DEFAULT NULL,
   `operator_id` int NOT NULL,
   `supplier_name` varchar(150) NOT NULL,
   `quantity` decimal(10,2) NOT NULL,
   `rate` decimal(8,2) NOT NULL,
   `mrp_rate` decimal(10,2) DEFAULT '0.00',
   `total_amount` decimal(12,2) NOT NULL,
   `purchase_date` date NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`purchase_id`),
   KEY `product_id` (`product_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `product_purchases_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
   CONSTRAINT `product_purchases_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `product_purchases_ibfk_3` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `product_sales` (
   `sale_id` int NOT NULL AUTO_INCREMENT,
   `transaction_id` varchar(30) DEFAULT NULL,
   `seller_id` int NOT NULL,
   `product_id` int NOT NULL,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `quantity` decimal(10,2) NOT NULL,
   `rate` decimal(8,2) NOT NULL,
   `total_amount` decimal(12,2) NOT NULL,
   `sale_date` date NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`sale_id`),
   KEY `seller_id` (`seller_id`),
   KEY `product_id` (`product_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   KEY `idx_transaction_id` (`transaction_id`),
   CONSTRAINT `product_sales_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `product_sales_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`),
   CONSTRAINT `product_sales_ibfk_3` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `product_sales_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `products` (
   `product_id` int NOT NULL AUTO_INCREMENT,
   `centre_id` int NOT NULL,
   `product_name` varchar(255) NOT NULL,
   `unit` varchar(20) NOT NULL,
   `current_stock` decimal(10,2) NOT NULL DEFAULT '0.00',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `rate` decimal(10,2) NOT NULL DEFAULT '0.00',
   `mrp_rate` decimal(10,2) NOT NULL DEFAULT '0.00',
   `supplier_name` varchar(150) NOT NULL DEFAULT '',
   PRIMARY KEY (`product_id`),
   UNIQUE KEY `product_name_centre` (`product_name`,`centre_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `products_ibfk_1` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `seller_deposits` (
   `id` int NOT NULL AUTO_INCREMENT,
   `seller_id` int NOT NULL,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `type` enum('credit','debit') NOT NULL,
   `amount` decimal(10,2) NOT NULL,
   `remarks` text,
   `transaction_date` date NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   KEY `seller_id` (`seller_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `seller_deposits_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `seller_deposits_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `seller_deposits_ibfk_3` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `seller_payments` (
   `id` int NOT NULL AUTO_INCREMENT,
   `bill_no` varchar(30) DEFAULT NULL,
   `seller_id` int NOT NULL,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `from_date` date NOT NULL,
   `to_date` date NOT NULL,
   `milk_amount` decimal(10,2) NOT NULL,
   `advance_given` decimal(10,2) DEFAULT '0.00',
   `installment_cut` decimal(10,2) DEFAULT '0.00',
   `deposit_amount` decimal(10,2) DEFAULT '0.00',
   `product_deduction` decimal(10,2) DEFAULT '0.00',
   `walkin_deduction` decimal(10,2) DEFAULT '0.00',
   `tds_amount` decimal(10,2) DEFAULT '0.00',
   `final_payable` decimal(10,2) DEFAULT '0.00',
   `cash_paid` decimal(10,2) NOT NULL,
   `paid_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   UNIQUE KEY `unique_cycle_payment` (`seller_id`,`from_date`,`to_date`),
   UNIQUE KEY `bill_no` (`bill_no`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `seller_payments_ibfk_1` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `seller_payments_ibfk_2` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `seller_payments_ibfk_3` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci


CREATE TABLE `sellers` (
   `seller_id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `seller_code` varchar(20) NOT NULL,
   `name` varchar(100) NOT NULL,
   `mobile` varchar(15) NOT NULL,
   `aadhaar` varchar(20) DEFAULT NULL,
   `jamin` text,
   `address` text,
   `seller_type` enum('Utpadak','Gavali') NOT NULL DEFAULT 'Utpadak',
   `milk_type` enum('cow','buffalo','mixed') NOT NULL DEFAULT 'mixed',
   `bank_account` varchar(30) DEFAULT NULL,
   `bank_name` varchar(100) DEFAULT NULL,
   `ifsc_code` varchar(15) DEFAULT NULL,
   `is_active` tinyint(1) DEFAULT '1',
   `advance_enabled` tinyint(1) NOT NULL DEFAULT '1',
   `advance_deduction` decimal(10,2) DEFAULT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `deposit_enabled` tinyint(1) NOT NULL DEFAULT '0',
   `deposit_per_litre` decimal(8,2) DEFAULT NULL,
   `product_sale_enabled` tinyint(1) NOT NULL DEFAULT '0',
   PRIMARY KEY (`seller_id`),
   UNIQUE KEY `seller_code` (`seller_code`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `sellers_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `sellers_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `speed_products` (
   `id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int DEFAULT NULL,
   `created_by_admin_id` int DEFAULT NULL,
   `centre_id` int NOT NULL,
   `product_id` int NOT NULL,
   `display_name` varchar(200) DEFAULT NULL,
   `image_url` varchar(500) DEFAULT NULL,
   `sort_order` int NOT NULL DEFAULT '0',
   `is_active` tinyint(1) NOT NULL DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`),
   UNIQUE KEY `uq_operator_product` (`operator_id`,`product_id`),
   KEY `idx_operator_id` (`operator_id`),
   KEY `idx_centre_id` (`centre_id`),
   KEY `idx_product_id` (`product_id`),
   KEY `idx_sort_order` (`sort_order`),
   KEY `idx_is_active` (`is_active`),
   KEY `idx_centre_active` (`centre_id`,`is_active`),
   KEY `idx_operator_active` (`operator_id`,`is_active`),
   KEY `idx_centre_sort` (`centre_id`,`sort_order`),
   KEY `idx_created_by_admin_id` (`created_by_admin_id`),
   CONSTRAINT `speed_products_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`) ON DELETE CASCADE,
   CONSTRAINT `speed_products_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`) ON DELETE CASCADE,
   CONSTRAINT `speed_products_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`) ON DELETE CASCADE,
   CONSTRAINT `speed_products_ibfk_4` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `tank_dispatch` (
   `dispatch_id` int NOT NULL AUTO_INCREMENT,
   `dispatch_date` date NOT NULL,
   `milk_type` enum('cow','buffalo','mixed') NOT NULL DEFAULT 'mixed',
   `shift` enum('morning','evening') DEFAULT 'morning',
   `cow_liters` decimal(10,2) DEFAULT '0.00',
   `buffalo_liters` decimal(10,2) DEFAULT '0.00',
   `total_liters` decimal(10,2) NOT NULL,
   `avg_fat` decimal(5,2) DEFAULT NULL,
   `avg_snf` decimal(5,2) DEFAULT NULL,
   `avg_fat_cow` decimal(5,2) DEFAULT NULL,
   `avg_snf_cow` decimal(5,2) DEFAULT NULL,
   `avg_fat_buffalo` decimal(5,2) DEFAULT NULL,
   `avg_snf_buffalo` decimal(5,2) DEFAULT NULL,
   `factory_name` varchar(150) DEFAULT NULL,
   `vehicle_no` varchar(20) DEFAULT NULL,
   `driver_name` varchar(100) DEFAULT NULL,
   `factory_rate` decimal(8,2) DEFAULT NULL,
   `total_amount` decimal(12,2) DEFAULT NULL,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `remarks` text,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`dispatch_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `tank_dispatch_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `tank_dispatch_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `walkin_bill_master` (
   `bill_id` int NOT NULL AUTO_INCREMENT,
   `bill_no` varchar(50) NOT NULL,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `buyer_id` int DEFAULT NULL,
   `seller_id` int DEFAULT NULL,
   `buyer_type` enum('named','seller') NOT NULL,
   `buyer_name` varchar(150) DEFAULT NULL,
   `from_date` date NOT NULL,
   `to_date` date NOT NULL,
   `total_sales_amount` decimal(12,2) DEFAULT '0.00',
   `amount_paid` decimal(12,2) DEFAULT '0.00',
   `previous_balance` decimal(12,2) DEFAULT '0.00',
   `remaining_balance` decimal(12,2) DEFAULT '0.00',
   `paid_at` datetime DEFAULT CURRENT_TIMESTAMP,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`bill_id`),
   UNIQUE KEY `bill_no` (`bill_no`),
   KEY `operator_id` (`operator_id`),
   KEY `buyer_id` (`buyer_id`),
   KEY `seller_id` (`seller_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `walkin_bill_master_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `walkin_bill_master_ibfk_2` FOREIGN KEY (`buyer_id`) REFERENCES `walkin_named_buyers` (`buyer_id`),
   CONSTRAINT `walkin_bill_master_ibfk_3` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`),
   CONSTRAINT `walkin_bill_master_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `walkin_bill_sales_snapshot` (
   `id` bigint NOT NULL AUTO_INCREMENT,
   `bill_id` int NOT NULL,
   `sale_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `sale_date` date DEFAULT NULL,
   `shift` enum('morning','evening') DEFAULT NULL,
   `milk_type` enum('cow','buffalo') DEFAULT NULL,
   `quantity` decimal(10,2) DEFAULT NULL,
   `mrp` decimal(10,2) DEFAULT NULL,
   `total_amount` decimal(12,2) DEFAULT NULL,
   PRIMARY KEY (`id`),
   KEY `bill_id` (`bill_id`),
   KEY `sale_id` (`sale_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `walkin_bill_sales_snapshot_ibfk_1` FOREIGN KEY (`bill_id`) REFERENCES `walkin_bill_master` (`bill_id`) ON DELETE CASCADE,
   CONSTRAINT `walkin_bill_sales_snapshot_ibfk_2` FOREIGN KEY (`sale_id`) REFERENCES `walkin_sales` (`sale_id`),
   CONSTRAINT `walkin_bill_sales_snapshot_ibfk_3` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `walkin_named_buyers` (
   `buyer_id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `name` varchar(100) NOT NULL,
   `mobile` varchar(15) DEFAULT NULL,
   `address` text,
   `is_active` tinyint(1) DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`buyer_id`),
   KEY `operator_id` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `walkin_named_buyers_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `walkin_named_buyers_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `walkin_payments` (
   `payment_id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `buyer_id` int NOT NULL,
   `seller_id` int DEFAULT NULL,
   `amount` decimal(10,2) NOT NULL,
   `payment_mode` enum('cash','upi','credit') NOT NULL DEFAULT 'cash',
   `remarks` text,
   `payment_date` date NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`payment_id`),
   KEY `operator_id` (`operator_id`),
   KEY `buyer_id` (`buyer_id`),
   KEY `seller_id` (`seller_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `walkin_payments_ibfk_4` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `walkin_product_types` (
   `product_type_id` int NOT NULL AUTO_INCREMENT,
   `operator_id` int NOT NULL,
   `centre_id` int NOT NULL,
   `name` varchar(100) NOT NULL,
   `milk_type` enum('cow','buffalo','both') NOT NULL DEFAULT 'both',
   `type` enum('loose','packaged') NOT NULL DEFAULT 'loose',
   `extra_rate` decimal(8,2) NOT NULL DEFAULT '0.00',
   `is_active` tinyint(1) NOT NULL DEFAULT '1',
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`product_type_id`),
   KEY `fk_wpt_operator` (`operator_id`),
   KEY `centre_id` (`centre_id`),
   CONSTRAINT `fk_wpt_operator` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `walkin_product_types_ibfk_2` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

CREATE TABLE `walkin_sales` (
   `sale_id` int NOT NULL AUTO_INCREMENT,
   `buyer_name` varchar(100) DEFAULT 'ANON',
   `buyer_id` int DEFAULT NULL,
   `seller_id` int DEFAULT NULL,
   `product_type_id` int DEFAULT NULL,
   `product_type` enum('loose','packaged') NOT NULL DEFAULT 'loose',
   `milk_type` enum('cow','buffalo') NOT NULL,
   `quantity` decimal(8,2) NOT NULL,
   `mrp` decimal(8,2) NOT NULL,
   `total_amount` decimal(10,2) NOT NULL,
   `amount_paid` decimal(10,2) DEFAULT NULL,
   `previous_balance` decimal(10,2) DEFAULT '0.00',
   `payment_mode` enum('cash','upi','credit') DEFAULT 'cash',
   `shift` enum('morning','evening') NOT NULL,
   `sale_date` date NOT NULL,
   `operator_id` int DEFAULT NULL,
   `created_by_admin_id` int DEFAULT NULL,
   `centre_id` int NOT NULL,
   `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (`sale_id`),
   KEY `operator_id` (`operator_id`),
   KEY `seller_id` (`seller_id`),
   KEY `walkin_sales_ibfk_3` (`product_type_id`),
   KEY `walkin_sales_ibfk_4` (`buyer_id`),
   KEY `centre_id` (`centre_id`),
   KEY `created_by_admin_id` (`created_by_admin_id`),
   CONSTRAINT `walkin_sales_ibfk_1` FOREIGN KEY (`operator_id`) REFERENCES `operators` (`operator_id`),
   CONSTRAINT `walkin_sales_ibfk_2` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`seller_id`) ON DELETE SET NULL,
   CONSTRAINT `walkin_sales_ibfk_3` FOREIGN KEY (`product_type_id`) REFERENCES `walkin_product_types` (`product_type_id`) ON DELETE SET NULL,
   CONSTRAINT `walkin_sales_ibfk_4` FOREIGN KEY (`buyer_id`) REFERENCES `walkin_named_buyers` (`buyer_id`) ON DELETE SET NULL,
   CONSTRAINT `walkin_sales_ibfk_5` FOREIGN KEY (`centre_id`) REFERENCES `centres` (`centre_id`),
   CONSTRAINT `walkin_sales_ibfk_6` FOREIGN KEY (`created_by_admin_id`) REFERENCES `admins` (`admin_id`) ON DELETE SET NULL ON UPDATE CASCADE
 ) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
 
show create table admins;
show create table app_settings;
show create table bill_cash_advance_snapshot;
show create table bill_deposit_snapshot;
show create table bill_master;
show create table bill_milk_entries;
show create table bill_product_sales;
show create table bill_walkin_sales;
show create table bonus_events;
show create table bonus_payments;
show create table bonus_register;
show create table bonus_slabs;
show create table buffalo_milk_rates;
show create table cash_advance;
show create table centres;
show create table cow_milk_rates;
show create table dairies;
show create table excel_export_config;
show create table gavali_bonus_events;
show create table gavali_bonus_payments;
show create table generated_rates;
show create table global_settings;
show create table milk_entries;
show create table operator_permissions;
show create table operators;
show create table owner_usage;
show create table payment_cycle_config;
show create table premium_rates;
show create table product_purchases;
show create table product_sales;
show create table products;
show create table seller_deposits;
show create table seller_payments;
show create table sellers;
show create table speed_products;
show create table tank_dispatch;
show create table walkin_bill_master;
show create table walkin_bill_sales_snapshot;
show create table walkin_named_buyers;
show create table walkin_payments;
show create table walkin_product_types;
show create table walkin_sales;