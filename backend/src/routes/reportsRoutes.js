// backend/src/routes/reportsRoutes.js
const express = require('express');
const router  = express.Router();
const { 
  getOverview, 
  getRevenue, 
  getTopProducts, 
  getByCashier, 
  getPaymentMethods,
  getCategoryRevenue,
  getRevenueByShift
} = require('../controllers/reportsController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

router.use(verifyToken, requireAdmin);

router.get('/overview',         getOverview);        // GET /api/reports/overview
router.get('/revenue',          getRevenue);         // GET /api/reports/revenue
router.get('/top-products',     getTopProducts);     // GET /api/reports/top-products
router.get('/by-cashier',       getByCashier);       // GET /api/reports/by-cashier
router.get('/payment-methods',  getPaymentMethods);  // GET /api/reports/payment-methods
router.get('/category-revenue', getCategoryRevenue); // GET /api/reports/category-revenue
router.get('/revenue-by-shift', getRevenueByShift);   // GET /api/reports/revenue-by-shift

module.exports = router;
