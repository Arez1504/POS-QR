-- =============================================
-- MIGRATION V4: Bảng lưu lịch sử chat AI
-- Chạy sau khi đã chạy schema.sql, migration_v2, migration_v3
-- =============================================

USE pos_qr;

CREATE TABLE IF NOT EXISTS ai_chat_history (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  session_id  VARCHAR(100) NOT NULL,
  user_id     INT NOT NULL,
  role        ENUM('user', 'assistant') NOT NULL,
  content     TEXT NOT NULL,
  tools_used  JSON DEFAULT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_session (session_id),
  INDEX idx_user (user_id),
  INDEX idx_created (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
