// backend/src/controllers/paymentController.js
const db = require('../config/db');
const { logActivity } = require('../utils/logger');

// Webhook receiver for automated payments
const handlePaymentWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log('📬 Payment Webhook Received:', payload);

    // Extract transaction details
    // Casso uses: records[].description, records[].amount
    // SePay uses: content, transferAmount
    // PayOS uses: data.description, data.amount
    let description = '';
    let amount = 0;

    if (payload.records && Array.isArray(payload.records) && payload.records.length > 0) {
      // Casso format
      const record = payload.records[0];
      description = record.description || '';
      amount = Number(record.amount) || 0;
    } else if (payload.data && typeof payload.data === 'object') {
      // PayOS format
      description = payload.data.description || '';
      amount = Number(payload.data.amount) || 0;
    } else {
      // SePay or generic format
      description = payload.content || payload.description || payload.note || '';
      amount = Number(payload.transferAmount || payload.amount || payload.value) || 0;
    }

    if (!description) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy nội dung giao dịch' });
    }

    // Match order code ORD-YYYYMMDD-XXXX
    const match = description.match(/(ORD-\d{8}-\d{4})/i);
    if (!match) {
      console.log('⚠️ Could not find order code in description:', description);
      return res.status(200).json({ success: true, message: 'Bỏ qua giao dịch không chứa mã đơn hàng' });
    }

    const orderCode = match[1].toUpperCase();

    // Query order
    const [orders] = await db.execute('SELECT * FROM orders WHERE order_code = ?', [orderCode]);
    if (orders.length === 0) {
      console.log('⚠️ Order not found in database:', orderCode);
      return res.status(404).json({ success: false, message: `Không tìm thấy đơn hàng ${orderCode}` });
    }

    const order = orders[0];

    // If order is already paid, return success
    if (order.payment_status === 'paid') {
      return res.json({ success: true, message: 'Đơn hàng đã được thanh toán trước đó' });
    }

    // Verify amount
    if (amount < order.total_amount) {
      console.log(`⚠️ Insufficient amount. Expected >= ${order.total_amount}, got ${amount}`);
      return res.status(400).json({ 
        success: false, 
        message: `Số tiền chuyển khoản (${amount}đ) không đủ so với tổng tiền đơn hàng (${order.total_amount}đ)` 
      });
    }

    // Update order status
    await db.execute(
      'UPDATE orders SET payment_status = "paid", order_status = "completed", paid_amount = ? WHERE id = ?',
      [amount, order.id]
    );

    // Log activity
    await logActivity(
      req,
      'Thanh toán tự động',
      `Đơn hàng ${order.order_code} đã thanh toán tự động qua ngân hàng thành công với số tiền ${amount.toLocaleString('vi-VN')}đ`,
      { id: null, username: 'Hệ thống' }
    );

    console.log(`✅ Auto payment verified successfully for order ${orderCode}`);
    res.json({ success: true, message: 'Xác nhận thanh toán đơn hàng thành công' });
  } catch (error) {
    console.error('handlePaymentWebhook error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// Simulation endpoint for local dev testing
const simulatePayment = async (req, res) => {
  try {
    const { order_code, amount } = req.body;

    if (!order_code) {
      return res.status(400).json({ success: false, message: 'Thiếu mã đơn hàng' });
    }

    const [orders] = await db.execute('SELECT * FROM orders WHERE order_code = ?', [order_code]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    }

    const order = orders[0];
    const payAmount = Number(amount) || order.total_amount;

    if (order.payment_status === 'paid') {
      return res.json({ success: true, message: 'Đơn hàng đã được thanh toán trước đó' });
    }

    // Update order status
    await db.execute(
      'UPDATE orders SET payment_status = "paid", order_status = "completed", paid_amount = ? WHERE id = ?',
      [payAmount, order.id]
    );

    // Log activity
    await logActivity(
      req,
      'Thanh toán tự động',
      `[GIẢ LẬP] Đơn hàng ${order.order_code} đã thanh toán tự động thành công với số tiền ${payAmount.toLocaleString('vi-VN')}đ`,
      { id: null, username: 'Hệ thống' }
    );

    res.json({ 
      success: true, 
      message: `[Giả lập] Đã xác thực thanh toán thành công cho đơn ${order_code} với số tiền ${payAmount.toLocaleString('vi-VN')}đ` 
    });
  } catch (error) {
    console.error('simulatePayment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

module.exports = {
  handlePaymentWebhook,
  simulatePayment
};
