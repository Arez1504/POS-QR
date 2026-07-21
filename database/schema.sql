-- =============================================
-- DATABASE: pos_qr
-- Chạy file này để khởi tạo toàn bộ DB
-- =============================================

CREATE DATABASE IF NOT EXISTS pos_qr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pos_qr;

-- =============================================
-- Bảng USERS (phân quyền)
-- role: admin | cashier | warehouse
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50)  NOT NULL UNIQUE,
  password     VARCHAR(255) NOT NULL,          -- bcrypt hash
  full_name    VARCHAR(100) NOT NULL,
  email        VARCHAR(100),
  phone        VARCHAR(20),
  role         ENUM('admin','cashier') NOT NULL DEFAULT 'cashier',
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- Bảng PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  description  TEXT,
  price        DECIMAL(10,2) NOT NULL DEFAULT 0,
  cost_price   DECIMAL(10,2) DEFAULT 0,
  stock        INT NOT NULL DEFAULT 0,
  category     VARCHAR(100),
  unit         VARCHAR(50) DEFAULT 'cái',
  barcode      VARCHAR(100),
  qr_code      VARCHAR(255),
  image_url    VARCHAR(500),
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- Bảng ORDERS
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  order_code     VARCHAR(50) UNIQUE,
  user_id        INT,
  customer_name  VARCHAR(100),
  customer_phone VARCHAR(20),
  total_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(12,2) DEFAULT 0,
  final_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method ENUM('cash','card','transfer') DEFAULT 'cash',
  status         ENUM('pending','completed','cancelled') DEFAULT 'completed',
  note           TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================
-- Bảng ORDER ITEMS
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  order_id    INT NOT NULL,
  product_id  INT,
  product_name VARCHAR(255) NOT NULL,
  quantity    INT NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL,
  subtotal    DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

-- =============================================
-- Tài khoản mặc định
-- password: admin123  (bcrypt hash)
-- THAY ĐỔI MẬT KHẨU NGAY SAU KHI CÀI ĐẶT!
-- =============================================
INSERT INTO users (username, password, full_name, email, role, is_active)
VALUES (
  'admin',
  '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- password: password
  'Quản trị viên',
  'admin@pos.local',
  'admin',
  TRUE
)
ON DUPLICATE KEY UPDATE id = id;