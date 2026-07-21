// backend/src/routes/activityRoutes.js
const express = require('express');
const router  = express.Router();
const { getActivityLogs } = require('../controllers/activityController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Chỉ cho phép admin xem lịch sử hoạt động hệ thống
router.use(verifyToken, requireAdmin);

router.get('/', getActivityLogs);

module.exports = router;
