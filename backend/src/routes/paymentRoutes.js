// backend/src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { handlePaymentWebhook, simulatePayment } = require('../controllers/paymentController');

// Webhook is public (called by external banking callback providers)
router.post('/webhook', handlePaymentWebhook);

// Simulator endpoint for dev testing
router.post('/simulate', simulatePayment);

module.exports = router;
