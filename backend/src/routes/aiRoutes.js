// backend/src/routes/aiRoutes.js
const express = require('express');
const router = express.Router();
const { chat, getSuggestions, getHistory, analyzeInventory } = require('../controllers/aiController');
const { verifyToken } = require('../middleware/authMiddleware');

// Tất cả route AI đều yêu cầu đăng nhập (admin + cashier đều dùng được)
router.post('/chat', verifyToken, chat);
router.get('/suggestions', verifyToken, getSuggestions);
router.get('/history', verifyToken, getHistory);
router.post('/inventory-analysis', verifyToken, analyzeInventory);

module.exports = router;
