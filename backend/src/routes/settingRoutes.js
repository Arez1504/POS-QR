// backend/src/routes/settingRoutes.js
const express = require('express');
const router  = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Cho phép truy cập công khai GET để POS & OrdersPage lấy cấu hình VietQR khi thanh toán
router.get('/', getSettings);

// Chỉ Admin mới được thay đổi cấu hình
router.put('/', verifyToken, requireAdmin, updateSettings);

module.exports = router;
