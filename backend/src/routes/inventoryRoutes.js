// backend/src/routes/inventoryRoutes.js
const express = require('express');
const router  = express.Router();
const { getStock, adjustStock, getLogs, getCategories } = require('../controllers/inventoryController');
const { verifyToken, requireAdmin, requireAdminOrCashier } = require('../middleware/authMiddleware');

router.use(verifyToken, requireAdminOrCashier); // Admin + Nhân viên bán hàng

router.get('/',            getStock);      // GET  /api/inventory
router.get('/logs',        getLogs);       // GET  /api/inventory/logs
router.get('/categories',  getCategories); // GET  /api/inventory/categories
router.post('/adjust',     requireAdmin, adjustStock);  // POST /api/inventory/adjust - Chỉ Admin điều chỉnh kho

module.exports = router;
