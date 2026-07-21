// frontend/src/pages/OrdersPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import api from '../services/authService';
import { BANK_CONFIG } from '../config/config';

interface OrderItem {
  id: number; product_name: string; quantity: number; unit_price: number; subtotal: number;
}
interface Order {
  id: number; order_code: string; cashier_name: string;
  total_amount: number; discount_amount: number;
  payment_method: string; order_status: string; note?: string;
  created_at: string; items?: OrderItem[];
}

const fmt = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleString('vi-VN');

const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  completed: { label: 'Hoàn thành', color: 'bg-emerald-50 text-emerald-700', icon: 'check_circle' },
  pending:   { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700',    icon: 'schedule' },
  cancelled: { label: 'Đã hủy',    color: 'bg-red-50 text-red-700',         icon: 'cancel' },
};
const PAY_MAP: Record<string, string> = { cash: 'Tiền mặt', card: 'Thẻ', transfer: 'Chuyển khoản', qr_transfer: 'QR' };

export default function OrdersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [orders, setOrders]     = useState<Order[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [detail, setDetail]     = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<Order | null>(null);
  const [showDetailQR, setShowDetailQR] = useState(false);
  const [copyStatus, setCopyStatus]     = useState<string | null>(null);
  const [posSettings, setPosSettings]   = useState<any>(null);

  useEffect(() => {
    api.get('/settings')
      .then(res => {
        if (res.data.success) {
          setPosSettings(res.data.data);
        }
      })
      .catch(err => console.error('Lỗi lấy cấu hình POS settings:', err));
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  // filters
  const [search, setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate]     = useState('');
  const [page, setPage]           = useState(1);
  const limit = 20;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search)       params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      if (filterDate)   params.set('date', filterDate);
      const res = await api.get(`/orders?${params}`);
      setOrders(res.data.data || []);
      setTotal(res.data.total || 0);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không thể tải đơn hàng');
    } finally { setLoading(false); }
  }, [search, filterStatus, filterDate, page]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const openDetail = async (order: Order) => {
    try {
      const res = await api.get(`/orders/${order.id}`);
      setDetail(res.data.data);
    } catch { setDetail(order); }
  };

  const handleCancel = async () => {
    if (!confirmCancel) return;
    setCancelling(true);
    try {
      await api.put(`/orders/${confirmCancel.id}/cancel`);
      setConfirmCancel(null);
      setDetail(null);
      fetchOrders();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không thể hủy đơn');
    } finally { setCancelling(false); }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="receipt_long" size={28} fill className="text-blue-600" /> Đơn hàng
          </h1>
          <p className="text-gray-400 text-sm mt-1">Quản lý và theo dõi tất cả đơn hàng</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-center">
          <p className="text-2xl font-bold text-blue-700">{total}</p>
          <p className="text-xs text-blue-500">Tổng đơn</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-40">
          <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Tìm mã đơn hàng..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả trạng thái</option>
          <option value="completed">Hoàn thành</option>
          <option value="pending">Chờ xử lý</option>
          <option value="cancelled">Đã hủy</option>
        </select>
        <input type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        {(search || filterStatus || filterDate) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterDate(''); setPage(1); }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="receipt_long" size={48} className="text-gray-200 mx-auto mb-3" />
            <p className="font-medium">Không có đơn hàng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Mã đơn</th>
                  {isAdmin && <th className="px-5 py-3 text-left">Thu ngân</th>}
                  <th className="px-5 py-3 text-left">Tổng tiền</th>
                  <th className="px-5 py-3 text-left">Thanh toán</th>
                  <th className="px-5 py-3 text-left">Trạng thái</th>
                  <th className="px-5 py-3 text-left">Thời gian</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map(o => {
                  const st = STATUS_MAP[o.order_status] ?? STATUS_MAP.completed;
                  return (
                    <tr key={o.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-3.5">
                        <span className="font-mono font-semibold text-gray-800 text-xs bg-gray-100 px-2 py-1 rounded">{o.order_code}</span>
                      </td>
                      {isAdmin && <td className="px-5 py-3.5 text-gray-600">{o.cashier_name || '—'}</td>}
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{fmt(o.total_amount)}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{PAY_MAP[o.payment_method] || o.payment_method}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                          <Icon name={st.icon} size={12} fill /> {st.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{fmtDate(o.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <button onClick={() => openDetail(o)}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1 ml-auto">
                          <Icon name="visibility" size={13} /> Xem
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50">
            <p className="text-xs text-gray-400">Trang {page}/{totalPages} · {total} đơn</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition flex items-center gap-1">
                <Icon name="chevron_left" size={14} /> Trước
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition flex items-center gap-1">
                Sau <Icon name="chevron_right" size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Chi tiết đơn hàng</h3>
                <p className="text-xs text-gray-400 font-mono">{detail.order_code}</p>
              </div>
              <button onClick={() => setDetail(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"><Icon name="close" size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Thu ngân', detail.cashier_name || '—'],
                  ['Thời gian', fmtDate(detail.created_at)],
                  ['Thanh toán', PAY_MAP[detail.payment_method] || detail.payment_method],
                  ['Trạng thái', STATUS_MAP[detail.order_status]?.label || detail.order_status],
                ].map(([k, v]) => (
                  <div key={k} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-1">{k}</p>
                    <p className="font-semibold text-gray-800">{v}</p>
                  </div>
                ))}
              </div>
              {/* Items */}
              {detail.items && detail.items.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 text-sm">Sản phẩm</h4>
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-gray-50 text-xs text-gray-500">
                        <th className="px-4 py-2 text-left">Sản phẩm</th>
                        <th className="px-4 py-2 text-right">SL</th>
                        <th className="px-4 py-2 text-right">Đơn giá</th>
                        <th className="px-4 py-2 text-right">Thành tiền</th>
                      </tr></thead>
                      <tbody className="divide-y divide-gray-50">
                        {detail.items.map(it => (
                          <tr key={it.id}>
                            <td className="px-4 py-2.5 text-gray-800">{it.product_name}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{it.quantity}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600">{fmt(it.unit_price)}</td>
                            <td className="px-4 py-2.5 text-right font-semibold">{fmt(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {/* Totals */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                {detail.discount_amount > 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Giảm giá</span><span>-{fmt(detail.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
                  <span>Tổng thanh toán</span>
                  <span className="text-blue-600">{fmt(detail.total_amount)}</span>
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              {detail.payment_method === 'qr_transfer' && detail.order_status !== 'cancelled' && (
                <button onClick={() => setShowDetailQR(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition">
                  <Icon name="qr_code" size={16} /> QR Thanh toán
                </button>
              )}
              {detail.order_status !== 'cancelled' && (
                <button onClick={() => setConfirmCancel(detail)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition">
                  <Icon name="cancel" size={16} /> Hủy / Đổi trả
                </button>
              )}
              <button onClick={() => setDetail(null)}
                className="ml-auto px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancel */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Icon name="warning" size={28} fill className="text-red-500" />
              </div>
              <h3 className="font-bold text-gray-900">Hủy đơn / Đổi trả?</h3>
              <p className="text-sm text-gray-500 mt-1">Đơn <strong>{confirmCancel.order_code}</strong> sẽ bị hủy và tồn kho được hoàn lại tự động.</p>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-2">⚠️ Thao tác này không thể hoàn tác. Vui lòng xác nhận trước khi tiến hành.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmCancel(null)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Không</button>
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition disabled:bg-red-400">
                {cancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail VietQR Payment Modal */}
      {showDetailQR && detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-blue-50">
              <div className="flex items-center gap-2">
                <Icon name="qr_code_scanner" size={24} className="text-blue-600 animate-pulse" />
                <div>
                  <h3 className="font-bold text-gray-800">Mã QR Thanh toán</h3>
                  <p className="text-xs text-blue-600 font-medium font-mono">{detail.order_code}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailQR(false)} className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition">
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const bankId = posSettings?.vietqr_bank_id || BANK_CONFIG.BANK_ID;
              const accountNo = posSettings?.vietqr_account_no || BANK_CONFIG.ACCOUNT_NO;
              const accountName = posSettings?.vietqr_account_name || BANK_CONFIG.ACCOUNT_NAME;
              const template = posSettings?.vietqr_template || BANK_CONFIG.TEMPLATE;
              return (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col items-center">
                  {/* QR Image */}
                  <div className="relative w-64 h-64 bg-gray-50 rounded-2xl border border-gray-100 p-2 flex items-center justify-center shadow-inner">
                    <img
                      src={`https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${detail.total_amount}&addInfo=${encodeURIComponent(detail.order_code)}&accountName=${encodeURIComponent(accountName)}`}
                      alt="VietQR Payment Code"
                      className="w-full h-full object-contain rounded-xl animate-fade-in"
                      loading="lazy"
                    />
                  </div>

                  {/* Toast copy notification */}
                  {copyStatus && (
                    <div className="bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 animate-bounce">
                      <Icon name="check" size={12} />
                      <span>Đã sao chép {copyStatus}!</span>
                    </div>
                  )}

                  {/* Payment Details */}
                  <div className="w-full space-y-3 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                      <span className="text-gray-500">Ngân hàng</span>
                      <span className="font-bold text-gray-800">{bankId}</span>
                    </div>
                    
                    <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                      <span className="text-gray-500">Số tài khoản</span>
                      <button 
                        onClick={() => handleCopy(accountNo, 'Số tài khoản')}
                        className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 active:scale-95 transition"
                        title="Click để sao chép"
                      >
                        {accountNo}
                        <Icon name="content_copy" size={14} />
                      </button>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                      <span className="text-gray-500">Chủ tài khoản</span>
                      <span className="font-semibold text-gray-800 uppercase">{accountName}</span>
                    </div>

                <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                  <span className="text-gray-500">Số tiền</span>
                  <button
                    onClick={() => handleCopy(String(detail.total_amount), 'Số tiền')}
                    className="flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-800 active:scale-95 transition"
                    title="Click để sao chép"
                  >
                    {fmt(detail.total_amount)}
                    <Icon name="content_copy" size={14} />
                  </button>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="text-gray-500">Nội dung CK</span>
                  <button
                    onClick={() => handleCopy(detail.order_code, 'Nội dung chuyển khoản')}
                    className="flex items-center gap-1 font-mono font-semibold text-blue-600 hover:text-blue-800 active:scale-95 transition"
                    title="Click để sao chép"
                  >
                    {detail.order_code}
                    <Icon name="content_copy" size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowDetailQR(false)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl active:scale-[0.98] transition text-sm flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 animate-fade-in"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}