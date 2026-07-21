// backend/src/controllers/settingController.js
const db = require('../config/db');

// GET /api/settings - Lấy cấu hình Key-Value của POS
const getSettings = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT key_name, key_value FROM pos_settings');
    const settings = {};
    rows.forEach(r => {
      settings[r.key_name] = r.key_value;
    });
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('getSettings error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// PUT /api/settings - Cập nhật cấu hình Key-Value (Chỉ dành cho Admin)
const updateSettings = async (req, res) => {
  try {
    const settings = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Dữ liệu gửi lên không hợp lệ' });
    }

    const keys = Object.keys(settings);
    for (const key of keys) {
      const val = String(settings[key]);
      await db.query(`
        INSERT INTO pos_settings (key_name, key_value) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE key_value = ?
      `, [key, val, val]);
    }

    res.json({ success: true, message: 'Lưu cấu hình thành công' });
  } catch (error) {
    console.error('updateSettings error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

module.exports = { getSettings, updateSettings };
