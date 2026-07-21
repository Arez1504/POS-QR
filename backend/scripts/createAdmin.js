/**
 * Script tạo tài khoản admin mặc định
 * Chạy: node scripts/createAdmin.js
 * Hoặc: node scripts/createAdmin.js <username> <password> <full_name> <role>
 */

require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
const username  = args[0] || 'admin';
const plainPass = args[1] || 'admin123';
const fullName  = args[2] || 'Quản trị viên';
const role      = args[3] || 'admin';

async function main() {
  const db = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     process.env.DB_PORT     || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'pos_qr',
  });

  try {
    // Kiểm tra username đã tồn tại chưa
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      console.log(`⚠️  Tài khoản "${username}" đã tồn tại.`);
      console.log('   Dùng lệnh sau để cập nhật mật khẩu:');
      console.log(`   node scripts/createAdmin.js --update ${username} ${plainPass}`);
      process.exit(0);
    }

    // Tạo bcrypt hash
    const hash = await bcrypt.hash(plainPass, 10);

    await db.execute(
      `INSERT INTO users (username, password, full_name, role, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [username, hash, fullName, role]
    );

    console.log('✅ Tạo tài khoản thành công!');
    console.log('━'.repeat(40));
    console.log(`  Username : ${username}`);
    console.log(`  Password : ${plainPass}`);
    console.log(`  Tên      : ${fullName}`);
    console.log(`  Role     : ${role}`);
    console.log('━'.repeat(40));
    console.log('⚠️  Hãy đổi mật khẩu ngay sau khi đăng nhập!');
  } finally {
    await db.end();
  }
}

// Xử lý --update flag
if (process.argv.includes('--update')) {
  const idx = process.argv.indexOf('--update');
  const uname = process.argv[idx + 1];
  const pwd   = process.argv[idx + 2];

  if (!uname || !pwd) {
    console.error('Cú pháp: node scripts/createAdmin.js --update <username> <new_password>');
    process.exit(1);
  }

  (async () => {
    const db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost', port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'pos_qr',
    });
    const hash = await bcrypt.hash(pwd, 10);
    const [r] = await db.execute('UPDATE users SET password = ? WHERE username = ?', [hash, uname]);
    await db.end();
    if (r.affectedRows === 0) {
      console.error(`❌ Không tìm thấy user "${uname}"`);
    } else {
      console.log(`✅ Đã cập nhật mật khẩu cho "${uname}"`);
    }
  })();
} else {
  main().catch(err => { console.error('❌ Lỗi:', err.message); process.exit(1); });
}