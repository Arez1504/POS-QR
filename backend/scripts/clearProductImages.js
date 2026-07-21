// backend/scripts/clearProductImages.js
require('dotenv').config();
const db = require('../src/config/db');

async function clearImages() {
  try {
    console.log('🔄 Đang gỡ bỏ tất cả hình ảnh sản phẩm trong CSDL...');
    await db.query('UPDATE products SET image = NULL');
    console.log('✅ Đã xóa toàn bộ hình ảnh sản phẩm thành công!');
  } catch (error) {
    console.error('❌ Lỗi:', error);
  } finally {
    process.exit(0);
  }
}
clearImages();
