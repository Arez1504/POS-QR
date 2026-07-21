-- =============================================================================
-- MYSQL WORKBENCH QUERIES - HỆ THỐNG POS QR-CODE
-- Chạy các lệnh dưới đây để kiểm tra và hiển thị dữ liệu đã nhập trong DB.
-- =============================================================================

-- 1. CHỌN CƠ SỞ DỮ LIỆU
USE pos_qr;


-- 2. HIỂN THỊ DANH SÁCH NHÂN VIÊN / TÀI KHOẢN (USERS)
-- Xem toàn bộ tài khoản trong hệ thống (đã ẩn password để bảo mật)
SELECT id, username, full_name, email, phone, role, is_active, created_at 
FROM users 
ORDER BY id;


-- 3. HIỂN THỊ DANH MỤC SẢN PHẨM (CATEGORIES)
-- Hiển thị tất cả danh mục (cả đang hoạt động và đã ẩn)
SELECT id, name, description, is_active, created_at 
FROM categories 
ORDER BY name;


-- 4. HIỂN THỊ DANH SÁCH SẢN PHẨM (PRODUCTS)
-- Lấy thông tin chi tiết sản phẩm kèm theo tên danh mục
SELECT 
    p.id, 
    p.name AS product_name, 
    p.sku, 
    p.barcode, 
    c.name AS category_name, 
    p.price, 
    p.cost_price, 
    p.stock_quantity, 
    p.min_stock, 
    p.unit, 
    p.is_active
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
ORDER BY p.id;


-- 5. HIỂN THỊ DANH SÁCH KHÁCH HÀNG (CUSTOMERS)
-- Xem thông tin khách hàng, số điểm tích lũy và tổng chi tiêu
SELECT id, name, phone, email, address, date_of_birth, gender, reward_points, total_spent, is_active, created_at
FROM customers 
ORDER BY total_spent DESC;


-- 6. HIỂN THỊ LỊCH SỬ GIAO DỊCH ĐƠN HÀNG (ORDERS)
-- Hiển thị đơn hàng kèm theo tên thu ngân và tên khách hàng (nếu có)
SELECT 
    o.id AS order_id,
    o.order_code,
    u.full_name AS cashier_name,
    c.name AS customer_name,
    o.subtotal,
    o.discount_amount,
    o.points_redeemed,
    o.points_earned,
    o.total_amount,
    o.payment_method,
    o.payment_status,
    o.order_status,
    o.created_at
FROM orders o
LEFT JOIN users u ON o.cashier_id = u.id
LEFT JOIN customers c ON o.customer_id = c.id
ORDER BY o.created_at DESC;


-- 7. CHI TIẾT SẢN PHẨM TRONG ĐƠN HÀNG (ORDER ITEMS)
-- Hiển thị các sản phẩm được bán trong từng đơn hàng
SELECT 
    oi.id AS item_id,
    o.order_code,
    oi.product_name,
    oi.product_sku,
    oi.quantity,
    oi.unit_price,
    oi.discount,
    oi.subtotal
FROM order_items oi
INNER JOIN orders o ON oi.order_id = o.id
ORDER BY o.created_at DESC, oi.id;


-- 8. XEM LỊCH SỬ XUẤT NHẬP KHO (INVENTORY LOGS)
-- Xem nhật ký thay đổi số lượng kho của các sản phẩm
SELECT 
    il.id AS log_id,
    p.name AS product_name,
    u.full_name AS operator_name,
    il.type AS log_type, -- import, export, adjustment, order
    il.quantity_before,
    il.quantity_change,
    il.quantity_after,
    il.note,
    il.created_at
FROM inventory_logs il
LEFT JOIN products p ON il.product_id = p.id
LEFT JOIN users u ON il.user_id = u.id
ORDER BY il.created_at DESC;


-- 9. LỊCH SỬ TÍCH ĐIỂM / TIÊU ĐIỂM (POINT TRANSACTIONS)
-- Nhật ký tích điểm và sử dụng điểm của khách hàng
SELECT 
    pt.id AS transaction_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    o.order_code,
    pt.type, -- earn, redeem, adjust, expire
    pt.points,
    pt.balance_before,
    pt.balance_after,
    pt.note,
    pt.created_at
FROM point_transactions pt
INNER JOIN customers c ON pt.customer_id = c.id
LEFT JOIN orders o ON pt.order_id = o.id
ORDER BY pt.created_at DESC;


-- 10. HIỂN THỊ THÔNG TIN CA LÀM VIỆC (SHIFTS)
-- Quản lý giờ mở/đóng ca và số tiền thực tế đối soát bàn giao ca
SELECT 
    s.id AS shift_id,
    u.full_name AS cashier_name,
    s.start_time,
    s.end_time,
    s.opening_cash,
    s.closing_cash,
    s.total_sales,
    s.total_orders,
    s.status, -- open, closed
    s.note
FROM shifts s
INNER JOIN users u ON s.user_id = u.id
ORDER BY s.id DESC;


-- 11. BÁO CÁO NHANH THỐNG KÊ DOANH THU & SỐ LƯỢNG
-- Thống kê tổng hợp trực tiếp bằng SQL
SELECT 
    (SELECT COUNT(*) FROM orders WHERE order_status = 'completed') AS total_completed_orders,
    (SELECT COUNT(*) FROM orders WHERE order_status = 'cancelled') AS total_cancelled_orders,
    (SELECT SUM(total_amount) FROM orders WHERE order_status = 'completed') AS total_revenue,
    (SELECT SUM(discount_amount) FROM orders WHERE order_status = 'completed') AS total_discount_given,
    (SELECT COUNT(*) FROM products WHERE is_active = TRUE) AS active_products_count,
    (SELECT COUNT(*) FROM customers WHERE is_active = TRUE) AS active_customers_count;
