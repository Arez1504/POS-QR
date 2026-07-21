// frontend/src/pages/DashboardPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import api from '../services/authService';

// ── Types ────────────────────────────────────────────────────────────────────

interface OverviewData {
  date: string;
  today: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
    completed_orders: number;
    cancelled_orders: number;
  };
  growth: { revenue: string | null; orders: string | null };
  stock_warning: { out_of_stock: number; low_stock: number };
  active_cashiers: number;
}

interface RecentOrder {
  id: number;
  order_code: string;
  customer_name: string | null;
  cashier_name: string;
  total_amount: number;
  order_status: string;
  payment_method: string;
  created_at: string;
}

interface TopProduct {
  product_id: number;
  product_name: string;
  total_qty: number;
  total_revenue: number;
  order_count: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const fmtShort = (n: number) => {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

const fmtTime = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-100 text-emerald-700' },
  pending:   { label: 'Chờ xử lý',  cls: 'bg-amber-100 text-amber-700' },
  cancelled: { label: 'Đã hủy',     cls: 'bg-red-100 text-red-700' },
};

const paymentIcon: Record<string, string> = {
  cash: 'payments',
  card: 'credit_card',
  qr:   'qr_code',
  transfer: 'account_balance',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Today's date range
  const today = new Date().toISOString().slice(0, 10);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, ordRes, topRes] = await Promise.all([
        api.get(`/dashboard/stats?date=${today}`),
        api.get('/orders?limit=6&page=1'),
        api.get(`/dashboard/top-products?date=${today}&limit=5`),
      ]);

      if (ovRes.data?.success)  setOverview(ovRes.data.data);
      if (ordRes.data?.success) setRecentOrders(ordRes.data.data || []);
      if (topRes.data?.success) setTopProducts(topRes.data.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ── Stat cards config ─────────────────────────────────────────────────────

  const todaySales    = overview?.today.total_revenue ?? 0;
  const todayOrders   = overview?.today.total_orders  ?? 0;
  const lowStock      = (overview?.stock_warning.low_stock ?? 0) + (overview?.stock_warning.out_of_stock ?? 0);
  const revenueGrowth = overview?.growth.revenue;
  const orderGrowth   = overview?.growth.orders;

  const cards = [
    {
      label: 'Doanh thu hôm nay',
      value: fmtShort(todaySales),
      sub:   fmt(todaySales),
      icon: 'payments',
      bg: 'bg-emerald-500',
      cardBg: 'bg-gradient-to-br from-emerald-50 to-green-100',
      border: 'border-emerald-200',
      textColor: 'text-emerald-700',
      trend: revenueGrowth !== null ? `${Number(revenueGrowth) >= 0 ? '+' : ''}${revenueGrowth}% so hôm qua` : 'Chưa có kỳ trước',
      trendUp: revenueGrowth !== null ? Number(revenueGrowth) >= 0 : null,
    },
    {
      label: 'Đơn hàng hôm nay',
      value: String(todayOrders),
      sub:   `${overview?.today.completed_orders ?? 0} hoàn thành`,
      icon: 'shopping_bag',
      bg: 'bg-blue-500',
      cardBg: 'bg-gradient-to-br from-blue-50 to-indigo-100',
      border: 'border-blue-200',
      textColor: 'text-blue-700',
      trend: orderGrowth !== null ? `${Number(orderGrowth) >= 0 ? '+' : ''}${orderGrowth}% so hôm qua` : 'Chưa có kỳ trước',
      trendUp: orderGrowth !== null ? Number(orderGrowth) >= 0 : null,
    },
    {
      label: 'Nhân viên hoạt động',
      value: String(overview?.active_cashiers ?? 0),
      sub:   'Đang làm việc hôm nay',
      icon: 'group',
      bg: 'bg-violet-500',
      cardBg: 'bg-gradient-to-br from-violet-50 to-purple-100',
      border: 'border-violet-200',
      textColor: 'text-violet-700',
      trend: 'Ca hôm nay',
      trendUp: null,
    },
    {
      label: 'Cần chú ý tồn kho',
      value: String(lowStock),
      sub:   `${overview?.stock_warning.out_of_stock ?? 0} hết hàng · ${overview?.stock_warning.low_stock ?? 0} sắp hết`,
      icon: 'warning',
      bg: lowStock > 0 ? 'bg-red-500' : 'bg-gray-400',
      cardBg: lowStock > 0 ? 'bg-gradient-to-br from-red-50 to-rose-100' : 'bg-gradient-to-br from-gray-50 to-slate-100',
      border: lowStock > 0 ? 'border-red-200' : 'border-gray-200',
      textColor: lowStock > 0 ? 'text-red-700' : 'text-gray-600',
      trend: lowStock > 0 ? 'Cần nhập thêm' : 'Tồn kho ổn định',
      trendUp: lowStock > 0 ? false : null,
    },
  ];

  const quickActions = [
    { label: 'Tạo đơn hàng',  icon: 'add_shopping_cart', path: '/pos',       color: 'text-blue-600 bg-blue-50 hover:bg-blue-100' },
    { label: 'Thêm sản phẩm', icon: 'add_box',            path: '/products',  color: 'text-violet-600 bg-violet-50 hover:bg-violet-100' },
    { label: 'Xem báo cáo',   icon: 'bar_chart',          path: '/reports',   color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' },
    { label: 'Quản lý kho',   icon: 'inventory_2',        path: '/inventory', color: 'text-amber-600 bg-amber-50 hover:bg-amber-100' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  const SkeletonCard = () => (
    <div className="bg-gray-100 animate-pulse rounded-2xl h-32" />
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* ── Greeting ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Xin chào, {user?.full_name}
              <Icon name="waving_hand" size={22} fill className="text-amber-400" />
            </h1>
            <p className="text-gray-400 text-sm flex items-center gap-1.5">
              {user?.role === 'admin'
                ? <><Icon name="verified_user" size={14} fill className="text-indigo-500" /> Quản trị viên</>
                : <><Icon name="point_of_sale" size={14} fill className="text-emerald-500" /> Nhân viên bán hàng</>
              }
              {' · '}Hệ thống POS QR
            </p>
          </div>
        </div>

        {/* Refresh button */}
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
        >
          <Icon name="refresh" size={16} className={loading ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <Icon name="error_outline" size={18} fill />
          <span>{error}</span>
          <button onClick={fetchAll} className="ml-auto text-red-600 hover:text-red-800 font-medium">Thử lại</button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? [1,2,3,4].map(i => <SkeletonCard key={i} />)
          : cards.map(card => (
            <div key={card.label} className={`${card.cardBg} border ${card.border} rounded-2xl p-5`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">{card.label}</p>
                <div className={`${card.bg} w-10 h-10 rounded-xl flex items-center justify-center shrink-0`}>
                  <Icon name={card.icon} size={20} fill className="text-white" />
                </div>
              </div>
              <p className={`text-2xl font-bold ${card.textColor} mb-0.5`}>{card.value}</p>
              <p className="text-xs text-gray-500 mb-2">{card.sub}</p>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {card.trendUp !== null && (
                  <Icon
                    name={card.trendUp ? 'trending_up' : 'trending_down'}
                    size={14}
                    className={card.trendUp ? 'text-emerald-500' : 'text-red-500'}
                  />
                )}
                <span>{card.trend}</span>
              </div>
            </div>
          ))
        }
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Quick Actions + Top Products */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="bolt" size={20} fill className="text-amber-500" />
              <h3 className="font-bold text-gray-800 text-sm">Thao tác nhanh</h3>
            </div>
            <div className="space-y-2">
              {quickActions.map(item => (
                <button
                  key={item.path}
                  id={`quick-${item.path.replace('/', '')}`}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${item.color}`}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Top Products hôm nay */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="local_fire_department" size={20} fill className="text-orange-500" />
              <h3 className="font-bold text-gray-800 text-sm">Bán chạy hôm nay</h3>
            </div>
            {loading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-8 bg-gray-100 animate-pulse rounded-lg" />)}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                <Icon name="inventory_2" size={28} className="text-gray-300 mb-2" />
                <p className="text-xs text-gray-400">Chưa có dữ liệu hôm nay</p>
              </div>
            ) : (
              <ol className="space-y-2">
                {topProducts.map((p, idx) => (
                  <li key={p.product_id} className="flex items-center gap-2 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                      ${idx === 0 ? 'bg-amber-400 text-white' : idx === 1 ? 'bg-gray-300 text-gray-700' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {idx + 1}
                    </span>
                    <span className="flex-1 truncate text-gray-700 font-medium">{p.product_name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{p.total_qty} cái</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="receipt_long" size={20} fill className="text-blue-500" />
              <h3 className="font-bold text-gray-800 text-sm">Đơn hàng gần đây</h3>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              Xem tất cả
              <Icon name="chevron_right" size={14} />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" />
                    <div className="h-2.5 bg-gray-100 animate-pulse rounded w-1/3" />
                  </div>
                  <div className="h-3 bg-gray-100 animate-pulse rounded w-20" />
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <Icon name="receipt_long" size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Chưa có đơn hàng nào</p>
              <p className="text-xs text-gray-400 mt-1">Tạo đơn hàng đầu tiên tại trang POS</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map(order => {
                const st = statusLabel[order.order_status] ?? { label: order.order_status, cls: 'bg-gray-100 text-gray-600' };
                const pmIcon = paymentIcon[order.payment_method] ?? 'payments';
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate('/orders')}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition cursor-pointer group"
                  >
                    {/* Payment method icon */}
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <Icon name={pmIcon} size={18} fill className="text-blue-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{order.order_code}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {order.customer_name || 'Khách lẻ'} · {order.cashier_name}
                      </p>
                    </div>

                    {/* Status + Amount + Time */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      <span className="text-sm font-bold text-gray-800">{fmt(order.total_amount)}</span>
                      <span className="text-xs text-gray-400">{fmtTime(order.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Footer info ── */}
      {!loading && overview && (
        <p className="text-center text-xs text-gray-400">
          Dữ liệu ngày <span className="font-medium">{overview.date}</span>
          {' · '}Trung bình đơn hàng: <span className="font-medium text-gray-600">{fmt(overview.today.avg_order_value)}</span>
        </p>
      )}
    </div>
  );
}