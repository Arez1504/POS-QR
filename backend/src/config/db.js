// backend/src/config/db.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_qr',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00'
});

// Test kết nối và khởi tạo bảng pos_settings
pool.getConnection()
  .then(async conn => {
    console.log('✅ Kết nối MySQL thành công!');
    try {
      // Khởi tạo bảng pos_settings
      await conn.query(`
        CREATE TABLE IF NOT EXISTS pos_settings (
          key_name VARCHAR(100) PRIMARY KEY,
          key_value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Khởi tạo bảng shift_assignments
      await conn.query(`
        CREATE TABLE IF NOT EXISTS shift_assignments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          shift_date DATE NOT NULL,
          shift_name VARCHAR(50) NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Khởi tạo bảng ai_chat_history
      await conn.query(`
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
      `);
      
      // Seed dữ liệu mặc định
      const defaults = [
        ['store_name', 'Cửa hàng POS-QR'],
        ['store_address', '123 Đường ABC, Quận 1, TP. HCM'],
        ['store_phone', '0901234567'],
        ['store_logo', ''],
        ['vietqr_bank_id', 'MSB'],
        ['vietqr_account_no', '37201019953134'],
        ['vietqr_account_name', 'DANG DINH DUC DO'],
        ['vietqr_template', 'compact2']
      ];
      
      for (const [k, v] of defaults) {
        await conn.query(`
          INSERT INTO pos_settings (key_name, key_value) 
          VALUES (?, ?) 
          ON DUPLICATE KEY UPDATE key_name = key_name
        `, [k, v]);
      }
      console.log('✅ Khởi tạo và đồng bộ bảng pos_settings thành công!');
    } catch (dbErr) {
      console.error('❌ Lỗi khởi tạo bảng pos_settings:', dbErr.message);
    } finally {
      conn.release();
    }
  })
  .catch(err => {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
  });

module.exports = pool;