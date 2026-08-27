CREATE TABLE seller_commission_overrides (
  id INT NOT NULL AUTO_INCREMENT,
  seller_id INT NOT NULL,
  centre_id INT NOT NULL,
  milk_type ENUM('cow','buffalo') NOT NULL,
  base_fat DECIMAL(4,2) NOT NULL,
  base_snf DECIMAL(4,2) NOT NULL,
  base_commission DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  fat_step_cut DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  snf_step_cut DECIMAL(6,2) NOT NULL DEFAULT 0.00,
  reason TEXT,
  effective_from DATE NOT NULL,
  effective_to DATE DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY seller_id (seller_id),
  KEY centre_id (centre_id),
  CONSTRAINT seller_commission_overrides_ibfk_1 FOREIGN KEY (seller_id) REFERENCES sellers (seller_id) ON DELETE CASCADE,
  CONSTRAINT seller_commission_overrides_ibfk_2 FOREIGN KEY (centre_id) REFERENCES centres (centre_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-----------------------------------------------------------------------------------------------------------

ALTER TABLE seller_commission_overrides
  ADD COLUMN commission_rate DECIMAL(6,2) NOT NULL DEFAULT 0.00 AFTER seller_id,
  DROP COLUMN milk_type,
  DROP COLUMN base_fat,
  DROP COLUMN base_snf,
  DROP COLUMN base_commission,
  DROP COLUMN fat_step_cut,
  DROP COLUMN snf_step_cut;

-- 1a. New table — separate from walkin_named_buyers
CREATE TABLE cattle_feed_named_buyers (
   buyer_id int NOT NULL AUTO_INCREMENT,
   operator_id int DEFAULT NULL,
   created_by_admin_id int DEFAULT NULL,
   centre_id int NOT NULL,
   name varchar(100) NOT NULL,
   mobile varchar(15) DEFAULT NULL,
   address text,
   code varchar(20) DEFAULT NULL,
   is_active tinyint(1) NOT NULL DEFAULT '1',
   created_at datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (buyer_id),
   UNIQUE KEY uq_cf_centre_code (centre_id, code),
   KEY idx_operator_id (operator_id),
   KEY idx_centre_id (centre_id),
   CONSTRAINT cattle_feed_named_buyers_ibfk_1 FOREIGN KEY (operator_id) REFERENCES operators (operator_id) ON DELETE SET NULL,
   CONSTRAINT cattle_feed_named_buyers_ibfk_2 FOREIGN KEY (centre_id) REFERENCES centres (centre_id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 1b. Alter cattle_feed_sales — seller becomes optional, add buyer fields
ALTER TABLE cattle_feed_sales
   MODIFY seller_id int NULL,
   ADD COLUMN buyer_id int NULL AFTER seller_id,
   ADD COLUMN buyer_name varchar(100) NULL AFTER buyer_id,
   ADD COLUMN buyer_type ENUM('seller','named','anon') NOT NULL DEFAULT 'seller' AFTER buyer_name,
   ADD KEY idx_buyer_id (buyer_id),
   ADD CONSTRAINT cattle_feed_sales_ibfk_buyer FOREIGN KEY (buyer_id) REFERENCES cattle_feed_named_buyers (buyer_id) ON DELETE SET NULL;

-- 1c. Backfill existing rows (all pre-existing sales are seller-based)
UPDATE cattle_feed_sales SET buyer_type = 'seller' WHERE seller_id IS NOT NULL;

-- 1a. New table — separate from walkin_named_buyers AND cattle_feed_named_buyers
CREATE TABLE product_named_buyers (
   buyer_id int NOT NULL AUTO_INCREMENT,
   operator_id int DEFAULT NULL,
   created_by_admin_id int DEFAULT NULL,
   centre_id int NOT NULL,
   name varchar(100) NOT NULL,
   mobile varchar(15) DEFAULT NULL,
   address text,
   code varchar(20) DEFAULT NULL,
   is_active tinyint(1) NOT NULL DEFAULT '1',
   created_at datetime DEFAULT CURRENT_TIMESTAMP,
   PRIMARY KEY (buyer_id),
   UNIQUE KEY uq_ps_centre_code (centre_id, code),
   KEY idx_operator_id (operator_id),
   KEY idx_centre_id (centre_id),
   CONSTRAINT product_named_buyers_ibfk_1 FOREIGN KEY (operator_id) REFERENCES operators (operator_id) ON DELETE SET NULL,
   CONSTRAINT product_named_buyers_ibfk_2 FOREIGN KEY (centre_id) REFERENCES centres (centre_id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 1b. Alter product_sales — seller becomes optional, add buyer fields
ALTER TABLE product_sales
   MODIFY seller_id int NULL,
   ADD COLUMN buyer_id int NULL AFTER seller_id,
   ADD COLUMN buyer_name varchar(100) NULL AFTER buyer_id,
   ADD COLUMN buyer_type ENUM('seller','named','anon') NOT NULL DEFAULT 'seller' AFTER buyer_name,
   ADD KEY idx_buyer_id (buyer_id),
   ADD CONSTRAINT product_sales_ibfk_buyer FOREIGN KEY (buyer_id) REFERENCES product_named_buyers (buyer_id) ON DELETE SET NULL;

-- 1c. Backfill existing rows
UPDATE product_sales SET buyer_type = 'seller' WHERE seller_id IS NOT NULL;

-- Add cheque column to sellers table
ALTER TABLE sellers 
ADD COLUMN cheque LONGTEXT DEFAULT NULL COMMENT 'Base64 encoded cheque image';

ALTER TABLE sellers
  MODIFY milk_type enum('cow','buffalo','both') NOT NULL DEFAULT 'cow';
  
ALTER TABLE sellers
  ADD COLUMN profile_image longtext COMMENT 'Base64 encoded profile photo' AFTER cheque;
  
show create table sellers;
select * from operators;
INSERT INTO operator_permissions (operator_id, page_key, can_create, can_read, can_update, can_delete)
VALUES (12, 'port_settings', 0, 1, 1, 0)
ON DUPLICATE KEY UPDATE can_read = 1, can_update = 1;

ALTER TABLE admins    ADD COLUMN last_login datetime DEFAULT NULL AFTER has_seen_tour;
ALTER TABLE operators ADD COLUMN last_login datetime DEFAULT NULL AFTER is_active;