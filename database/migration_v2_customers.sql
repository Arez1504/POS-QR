-- =============================================
-- MIGRATION V2: Thêm bảng CUSTOMERS & Tích điểm
-- Chạy file này sau khi đã có schema.sql
-- Database: pos_qr
-- =============================================

USE pos_qr;

-- =============================================
-- Bảng CUSTOMERS (Khách hàng tích điểm)
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  phone           VARCHAR(20)  NOT NULL UNIQUE,       -- SĐT dùng để tra cứu
  email           VARCHAR(100),
  address         TEXT,
  date_of_birth   DATE,
  gender          ENUM('male','female','other'),
  reward_points   INT NOT NULL DEFAULT 0,             -- Điểm tích lũy hiện tại
  total_spent     DECIMAL(15,2) NOT NULL DEFAULT 0,   -- Tổng chi tiêu (thống kê)
  note            TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_name  (name)
);

-- =============================================
-- Bảng POINT_TRANSACTIONS (Lịch sử tích điểm)
-- Giúp audit, tra soát điểm minh bạch
-- =============================================
CREATE TABLE IF NOT EXISTS point_transactions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  customer_id     INT NOT NULL,
  order_id        INT,
  type            ENUM('earn','redeem','adjust','expire') NOT NULL,
  points          INT NOT NULL,                       -- (+) cộng, (-) trừ
  balance_before  INT NOT NULL DEFAULT 0,
  balance_after   INT NOT NULL DEFAULT 0,
  note            TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id)    REFERENCES orders(id)    ON DELETE SET NULL,
  INDEX idx_customer (customer_id),
  INDEX idx_order    (order_id)
);

-- =============================================
-- Cập nhật bảng ORDERS để liên kết khách hàng
-- (nếu cột customer_id chưa có hoặc chưa liên kết đúng)
-- =============================================

-- Thêm cột customer_id nếu chưa có
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id      INT          AFTER cashier_id,
  ADD COLUMN IF NOT EXISTS points_redeemed  INT NOT NULL DEFAULT 0 AFTER discount_amount,
  ADD COLUMN IF NOT EXISTS points_earned    INT NOT NULL DEFAULT 0 AFTER points_redeemed,
  ADD COLUMN IF NOT EXISTS order_status     ENUM('pending','completed','cancelled') NOT NULL DEFAULT 'completed' AFTER payment_status;

-- Thêm khóa ngoại customer_id -> customers (nếu chưa có)
-- Dùng IF NOT EXISTS thông qua kiểm tra information_schema
SET @constraint_exists = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'orders'
    AND CONSTRAINT_NAME = 'fk_orders_customer'
);

-- Chỉ thêm nếu chưa có
SET @sql = IF(@constraint_exists = 0,
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- Dữ liệu mẫu - Khách hàng thân thiết
-- =============================================
INSERT INTO customers (name, phone, email, reward_points, total_spent) VALUES
  ('Nguyễn Văn An',   '0901234567', 'an.nguyen@gmail.com',  150, 1500000),
  ('Trần Thị Bình',   '0912345678', 'binh.tran@gmail.com',   80, 800000),
  ('Lê Hoàng Cường',  '0923456789', NULL,                    220, 2200000),
  ('Phạm Thị Dung',   '0934567890', 'dung.pham@gmail.com',   50, 500000),
  ('Hoàng Minh Đức',  '0945678901', NULL,                     10, 100000)
ON DUPLICATE KEY UPDATE id = id;
