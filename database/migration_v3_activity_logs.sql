-- =============================================
-- MIGRATION V3: Thêm bảng LỊCH SỬ HOẠT ĐỘNG & BẢNG CA LÀM VIỆC
-- Database: pos_qr
-- =============================================

USE pos_qr;

-- 1. Bảng ACTIVITY_LOGS (Lịch sử hoạt động)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(50),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  INDEX idx_username (username)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Bảng SHIFTS (Ca làm việc)
CREATE TABLE IF NOT EXISTS shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  opening_cash DECIMAL(15,2) DEFAULT 0,
  closing_cash DECIMAL(15,2) DEFAULT NULL,
  total_sales DECIMAL(15,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  status ENUM('open', 'closed') DEFAULT 'open',
  note TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_user_id (user_id),
  INDEX idx_start_time (start_time)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
