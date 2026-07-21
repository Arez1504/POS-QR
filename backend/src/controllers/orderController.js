// backend/src/controllers/orderController.js
const db = require('../config/db');
const CustomerModel = require('../models/customerModel');
const { logActivity } = require('../utils/logger');

// ============================================================
// CẤU HÌNH TÍCH ĐIỂM
// 10.000 VNĐ thanh toán thực tế = 1 điểm
// 1 điểm = 1.000 VNĐ khi quy đổi giảm giá
// ============================================================
const POINTS_PER_VND   = 10000; // Cứ 10.000đ được 1 điểm
const VND_PER_POINT    = 1000;  // 1 điểm = 1.000đ giảm giá

const generateOrderCode = () => {
  const date = new Date();
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${d}-${rand}`;
};

// GET /api/orders
const getOrders = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const { status, date, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    // Phân quyền: Nhân viên chỉ nhìn thấy đơn hàng của chính mình, admin thấy toàn bộ
    if (req.user.role !== 'admin') {
      where += ' AND o.cashier_id = ?';
      params.push(req.user.id);
    }

    if (status) { where += ' AND o.order_status = ?';     params.push(status); }
    if (date)   { where += ' AND DATE(o.created_at) = ?';  params.push(date); }
    if (search) { where += ' AND o.order_code LIKE ?';     params.push(`%${search}%`); }

    const [orders] = await db.query(
      `SELECT o.*, u.full_name as cashier_name, c.name as customer_name, c.phone as customer_phone
       FROM orders o
       LEFT JOIN users u ON o.cashier_id = u.id
       LEFT JOIN customers c ON o.customer_id = c.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM orders o ${where}`, params
    );

    res.json({ success: true, data: orders, total, page, limit });
  } catch (error) {
    console.error('getOrders error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// GET /api/orders/:id
const getOrder = async (req, res) => {
  try {
    const [orders] = await db.execute(
      `SELECT o.*, u.full_name as cashier_name,
              c.name as customer_name_join, c.phone as customer_phone_join, c.reward_points
       FROM orders o
       LEFT JOIN users u ON o.cashier_id = u.id
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ?`, [req.params.id]
    );
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

    // Phân quyền: Nhân viên chỉ được xem chi tiết đơn hàng do chính mình tạo
    if (req.user.role !== 'admin' && orders[0].cashier_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập thông tin đơn hàng này' });
    }

    const [items] = await db.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ success: true, data: { ...orders[0], items } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/orders - Tạo đơn hàng mới (có tích điểm & đổi điểm)
const createOrder = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const {
      customer_id,
      items,
      payment_method,
      paid_amount,
      discount_amount = 0,
      use_points = false,   // true nếu khách muốn dùng điểm giảm giá
      note
    } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ success: false, message: 'Đơn hàng phải có ít nhất 1 sản phẩm' });
    }

    // ── 1. Kiểm tra và tính giá từng sản phẩm ──
    let subtotal = 0;
    const orderItems = [];

    for (const item of items) {
      const [products] = await conn.execute(
        'SELECT id, name, sku, price, stock_quantity FROM products WHERE id = ? AND is_active = TRUE',
        [item.product_id]
      );
      if (!products.length) throw new Error(`Sản phẩm ID ${item.product_id} không tồn tại`);
      const product = products[0];
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.stock_quantity})`);
      }

      const itemSubtotal = Number(product.price) * Number(item.quantity);
      subtotal += itemSubtotal;
      orderItems.push({ ...product, price: Number(product.price), quantity: item.quantity, subtotal: itemSubtotal });
    }

    // ── 2. Xử lý điểm tích lũy ──
    let customer = null;
    let pointsRedeemed  = 0;   // Số điểm đã dùng để giảm giá
    let pointsDiscount  = 0;   // Số tiền giảm từ điểm (VNĐ)
    let pointsEarned    = 0;   // Số điểm sẽ được cộng sau giao dịch

    if (customer_id) {
      const [customers] = await conn.execute(
        'SELECT * FROM customers WHERE id = ? AND is_active = TRUE FOR UPDATE',
        [customer_id]
      );
      if (!customers.length) throw new Error('Không tìm thấy khách hàng');
      customer = customers[0];

      // Nếu khách muốn dùng điểm để giảm giá
      if (use_points && customer.reward_points > 0) {
        // Tối đa chỉ dùng điểm để giảm 50% hóa đơn
        const maxDiscount = Math.floor(subtotal * 0.5);
        const availableDiscount = customer.reward_points * VND_PER_POINT;
        pointsDiscount  = Math.min(availableDiscount, maxDiscount);
        pointsRedeemed  = Math.ceil(pointsDiscount / VND_PER_POINT);
        // Điều chỉnh lại để tròn điểm
        pointsDiscount  = pointsRedeemed * VND_PER_POINT;
      }
    }

    // ── 3. Tính tổng tiền cuối ──
    const totalDiscount  = Number(discount_amount) + pointsDiscount;
    const total_amount   = Math.max(0, subtotal - totalDiscount);
    const change_amount  = paid_amount ? Math.max(0, paid_amount - total_amount) : 0;
    const order_code     = generateOrderCode();

    // ── 4. Điểm tích lũy: tính dựa trên tiền thanh toán thực tế (sau giảm giá) ──
    if (customer_id && customer) {
      pointsEarned = Math.floor(total_amount / POINTS_PER_VND);
    }

    // ── 5. Ghi đơn hàng vào DB ──
    let paymentStatus = 'paid';
    let orderStatus = 'completed';
    let actualPaidAmount = paid_amount || total_amount;

    if (payment_method === 'qr_transfer') {
      paymentStatus = 'pending';
      orderStatus = 'pending';
      actualPaidAmount = 0;
    }

    const [orderResult] = await conn.execute(
      `INSERT INTO orders
         (order_code, customer_id, cashier_id, subtotal, discount_amount,
          points_redeemed, points_earned, total_amount, paid_amount, change_amount,
          payment_method, payment_status, order_status, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_code,
        customer_id || null,
        req.user.id,
        subtotal,
        Number(discount_amount),
        pointsRedeemed,
        pointsEarned,
        total_amount,
        actualPaidAmount,
        change_amount,
        payment_method || 'cash',
        paymentStatus,
        orderStatus,
        note || null,
      ]
    );
    const order_id = orderResult.insertId;

    // ── 6. Ghi chi tiết đơn & trừ kho ──
    for (const item of orderItems) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, product_sku, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [order_id, item.id, item.name, item.sku || null, item.quantity, item.price, item.subtotal]
      );
      const newStock = item.stock_quantity - item.quantity;
      await conn.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, item.id]);

      // Ghi inventory log nếu bảng tồn tại
      try {
        await conn.execute(
          `INSERT INTO inventory_logs (product_id, user_id, type, quantity_before, quantity_change, quantity_after, note, reference_id)
           VALUES (?, ?, 'order', ?, ?, ?, ?, ?)`,
          [item.id, req.user.id, item.stock_quantity, -item.quantity, newStock, `Đơn hàng ${order_code}`, order_id]
        );
      } catch (_) { /* Bỏ qua nếu bảng chưa tồn tại */ }
    }

    // ── 7. Cập nhật điểm khách hàng ──
    if (customer_id && customer) {
      // Trừ điểm đã dùng
      if (pointsRedeemed > 0) {
        await CustomerModel.redeemPoints(
          conn, customer_id, pointsRedeemed, order_id,
          `Đổi ${pointsRedeemed} điểm giảm ${pointsDiscount.toLocaleString('vi-VN')}đ - Đơn ${order_code}`
        );
      }

      // Cộng điểm mới
      if (pointsEarned > 0) {
        await CustomerModel.addPoints(
          conn, customer_id, pointsEarned, order_id,
          `Tích ${pointsEarned} điểm từ đơn ${order_code}`
        );
      }

      // Cập nhật tổng chi tiêu
      await CustomerModel.updateTotalSpent(conn, customer_id, total_amount);
    }

    await conn.commit();

    // ── 8. Trả về kết quả ──
    const [newOrder] = await db.execute(
      `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.reward_points as customer_points_after
       FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?`,
      [order_id]
    );
    const [newItems] = await db.execute('SELECT * FROM order_items WHERE order_id = ?', [order_id]);

    res.status(201).json({
      success: true,
      message: 'Tạo đơn hàng thành công',
      data: {
        ...newOrder[0],
        items: newItems,
        loyalty_summary: customer_id ? {
          points_redeemed : pointsRedeemed,
          points_discount : pointsDiscount,
          points_earned   : pointsEarned,
          points_after    : newOrder[0].customer_points_after,
        } : null,
      },
    });

    await logActivity(req, 'Tạo đơn hàng', `Đã tạo đơn hàng thành công: ${order_code} (Tổng cộng: ${total_amount.toLocaleString('vi-VN')}đ, Phương thức: ${payment_method})`);
  } catch (error) {
    await conn.rollback();
    console.error('createOrder error:', error);
    res.status(400).json({ success: false, message: error.message || 'Lỗi tạo đơn hàng' });
  } finally {
    conn.release();
  }
};

// PUT /api/orders/:id/cancel
const cancelOrder = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [orders] = await conn.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!orders.length) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
    if (orders[0].order_status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Đơn hàng đã bị hủy' });
    }

    const order = orders[0];

    // Hoàn kho
    const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    for (const item of items) {
      const [products] = await conn.execute(
        'SELECT stock_quantity FROM products WHERE id = ?', [item.product_id]
      );
      if (products.length) {
        const newStock = products[0].stock_quantity + item.quantity;
        await conn.execute('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, item.product_id]);
      }
    }

    // Hoàn điểm nếu có khách hàng
    if (order.customer_id && order.points_earned > 0) {
      const [customers] = await conn.execute(
        'SELECT reward_points FROM customers WHERE id = ? FOR UPDATE', [order.customer_id]
      );
      if (customers.length) {
        const before = customers[0].reward_points;
        const after  = Math.max(0, before - order.points_earned);
        await conn.execute('UPDATE customers SET reward_points = ? WHERE id = ?', [after, order.customer_id]);
        await conn.execute(
          `INSERT INTO point_transactions (customer_id, order_id, type, points, balance_before, balance_after, note)
           VALUES (?, ?, 'adjust', ?, ?, ?, ?)`,
          [order.customer_id, order.id, -order.points_earned, before, after, `Hủy đơn hàng ${order.order_code}`]
        );
      }
    }

    // Hoàn điểm đã đổi (trả lại điểm đã trừ)
    if (order.customer_id && order.points_redeemed > 0) {
      const [customers] = await conn.execute(
        'SELECT reward_points FROM customers WHERE id = ? FOR UPDATE', [order.customer_id]
      );
      if (customers.length) {
        const before = customers[0].reward_points;
        const after  = before + order.points_redeemed;
        await conn.execute('UPDATE customers SET reward_points = ? WHERE id = ?', [after, order.customer_id]);
        await conn.execute(
          `INSERT INTO point_transactions (customer_id, order_id, type, points, balance_before, balance_after, note)
           VALUES (?, ?, 'adjust', ?, ?, ?, ?)`,
          [order.customer_id, order.id, order.points_redeemed, before, after, `Hoàn điểm hủy đơn ${order.order_code}`]
        );
      }
    }

    await conn.execute(
      'UPDATE orders SET order_status = "cancelled", payment_status = "refunded" WHERE id = ?',
      [req.params.id]
    );
    await conn.commit();

    await logActivity(req, 'Hủy đơn hàng', `Đã hủy đơn hàng ${order.order_code} và thực hiện hoàn kho cho các sản phẩm`);

    res.json({ success: true, message: 'Đã hủy đơn hàng và hoàn kho' });
  } catch (error) {
    await conn.rollback();
    console.error('cancelOrder error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  } finally {
    conn.release();
  }
};

module.exports = { getOrders, getOrder, createOrder, cancelOrder };