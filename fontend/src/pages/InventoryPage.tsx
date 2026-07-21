// frontend/src/pages/InventoryPage.tsx
import { useState, useEffect, useCallback } from 'react';
import Icon from '../components/Icon';
import api from '../services/authService';
import BarcodeScanner from '../components/BarcodeScanner';

interface StockItem {
  id: number; name: string; sku?: string; barcode?: string;
  stock_quantity: number; min_stock: number; cost_price: number; price: number;
  unit: string; category_name?: string;
}
interface StockStats {
  total_sku: number; total_qty: number; low_stock: number; out_of_stock: number; total_value: number;
}
interface InventoryLog {
  id: number; product_name: string; sku?: string; user_name: string;
  type: string; quantity_before: number; quantity_change: number; quantity_after: number;
  note?: string; created_at: string;
}

const fmt   = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const fmtVND = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const fmtDate = (s: string) => new Date(s).toLocaleString('vi-VN');

const TYPE_MAP: Record<string, { label: string; color: string; icon: string }> = {
  import:  { label: 'Nhập kho',    color: 'bg-emerald-50 text-emerald-700', icon: 'add_circle' },
  export:  { label: 'Xuất kho',    color: 'bg-blue-50 text-blue-700',       icon: 'remove_circle' },
  adjust:  { label: 'Điều chỉnh',  color: 'bg-amber-50 text-amber-700',     icon: 'tune' },
  order:   { label: 'Bán hàng',    color: 'bg-purple-50 text-purple-700',   icon: 'shopping_bag' },
};

export default function InventoryPage() {
  const [tab, setTab]           = useState<'stock' | 'logs'>('stock');
  const [items, setItems]       = useState<StockItem[]>([]);
  const [stats, setStats]       = useState<StockStats | null>(null);
  const [logs, setLogs]         = useState<InventoryLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  // Adjust modal
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustForm, setAdjustForm] = useState({ type: 'import', quantity: '', note: '' });
  const [saving, setSaving]     = useState(false);
  const [formErr, setFormErr]   = useState('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const handleCameraScanSuccess = async (scannedBarcode: string) => {
    setShowCameraScanner(false);
    if (!scannedBarcode) return;
    const term = scannedBarcode.trim();
    const foundLocal = items.find(item => item.barcode === term || item.sku === term);
    if (foundLocal) {
      setAdjustItem(foundLocal);
      setAdjustForm({ type: 'import', quantity: '', note: '' });
      setFormErr('');
    } else {
      try {
        setLoading(true);
        const res = await api.get(`/inventory?search=${encodeURIComponent(term)}`);
        const list = res.data.data || [];
        const foundRemote = list.find((item: StockItem) => item.barcode === term || item.sku === term);
        if (foundRemote) {
          setAdjustItem(foundRemote);
          setAdjustForm({ type: 'import', quantity: '', note: '' });
          setFormErr('');
        } else {
          alert(`Không tìm thấy sản phẩm có mã vạch: ${scannedBarcode}`);
        }
      } catch (err) {
        console.error("Lỗi khi tìm sản phẩm nhập kho:", err);
        alert(`Lỗi hệ thống khi tìm mã vạch: ${scannedBarcode}`);
      } finally {
        setLoading(false);
      }
    }
  };

  // Filters stock
  const [search, setSearch]         = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStock, setFilterStock]       = useState('');
  const [categories, setCategories] = useState<{id:number;name:string}[]>([]);

  // Filters logs
  const [logsPage, setLogsPage]         = useState(1);
  const [logsTypeFilter, setLogsTypeFilter] = useState('');

  // Fetch stock
  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search)         params.set('search', search);
      if (filterCategory) params.set('category', filterCategory);
      if (filterStock)    params.set('filter', filterStock);
      params.set('limit', '100');
      const res = await api.get(`/inventory?${params}`);
      setItems(res.data.data || []);
      setStats(res.data.stats || null);
      setError('');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không thể tải tồn kho');
    } finally { setLoading(false); }
  }, [search, filterCategory, filterStock]);

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(logsPage), limit: '30' });
      if (logsTypeFilter) params.set('type', logsTypeFilter);
      const res = await api.get(`/inventory/logs?${params}`);
      setLogs(res.data.data || []);
      setLogsTotal(res.data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [logsPage, logsTypeFilter]);

  // Fetch categories
  useEffect(() => {
    api.get('/inventory/categories').then(r => setCategories(r.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => { if (tab === 'stock') fetchStock(); }, [tab, fetchStock]);
  useEffect(() => { if (tab === 'logs')  fetchLogs();  }, [tab, fetchLogs]);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem) return;
    setFormErr('');
    const qty = parseInt(adjustForm.quantity);
    if (!qty || qty === 0) return setFormErr('Vui lòng nhập số lượng hợp lệ');

    setSaving(true);
    try {
      await api.post('/inventory/adjust', {
        product_id: adjustItem.id,
        type: adjustForm.type,
        quantity: qty,
        note: adjustForm.note || undefined,
      });
      setAdjustItem(null);
      setAdjustForm({ type: 'import', quantity: '', note: '' });
      fetchStock();
      if (tab === 'logs') fetchLogs();
    } catch (e: any) {
      setFormErr(e.response?.data?.message || 'Lỗi điều chỉnh kho');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="warehouse" size={28} fill className="text-violet-600" /> Kho hàng
          </h1>
          <p className="text-gray-400 text-sm mt-1">Quản lý tồn kho, nhập xuất hàng hóa</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: 'inventory_2', label: 'Tổng SKU',   value: fmt(stats.total_sku),   color: 'bg-gray-50',     ic: 'text-gray-600' },
            { icon: 'layers',      label: 'Tổng số lượng', value: fmt(stats.total_qty), color: 'bg-blue-50',   ic: 'text-blue-600' },
            { icon: 'warning',     label: 'Sắp hết',    value: fmt(stats.low_stock),   color: 'bg-amber-50',   ic: 'text-amber-500' },
            { icon: 'block',       label: 'Hết hàng',   value: fmt(stats.out_of_stock),color: 'bg-red-50',     ic: 'text-red-500' },
            { icon: 'account_balance_wallet', label: 'Giá trị kho', value: fmtVND(stats.total_value), color: 'bg-emerald-50', ic: 'text-emerald-600' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-2xl p-4 flex items-center gap-3`}>
              <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                <Icon name={s.icon} size={20} fill className={s.ic} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">{s.label}</p>
                <p className="font-bold text-gray-900 text-sm truncate">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['stock', 'logs'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'stock'
              ? <><Icon name="inventory_2" size={16} className="mr-1" />Tồn kho</>
              : <><Icon name="history" size={16} className="mr-1" />Lịch sử</>
            }
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

      {/* STOCK TAB */}
      {tab === 'stock' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3">
            <div className="flex gap-2 items-center flex-1 min-w-40">
              <div className="relative flex-1">
                <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Tên, SKU, mã vạch..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                  >
                    <Icon name="close" size={16} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex items-center gap-1.5 transition text-sm font-medium shadow-md shadow-violet-100 active:scale-95 flex-shrink-0"
                title="Quét mã nhập kho"
              >
                <Icon name="photo_camera" size={18} />
                <span className="hidden sm:inline">Quét camera</span>
              </button>
            </div>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả danh mục</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả</option>
              <option value="low">Sắp hết</option>
              <option value="out">Hết hàng</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Sản phẩm</th>
                      <th className="px-5 py-3 text-left">Danh mục</th>
                      <th className="px-5 py-3 text-right">Tồn kho</th>
                      <th className="px-5 py-3 text-right">Mức tối thiểu</th>
                      <th className="px-5 py-3 text-right">Giá vốn</th>
                      <th className="px-5 py-3 text-right">Giá bán</th>
                      <th className="px-5 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {items.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-400">Không có sản phẩm nào</td></tr>
                    ) : items.map(item => {
                      const isOut = item.stock_quantity === 0;
                      const isLow = item.stock_quantity <= item.min_stock && !isOut;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-semibold text-gray-800">{item.name}</p>
                              <p className="text-xs text-gray-400">{item.sku || item.barcode || ''}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs">{item.category_name || '—'}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`inline-flex items-center gap-1 font-bold px-2.5 py-1 rounded-full text-sm ${
                              isOut ? 'bg-red-50 text-red-600' : isLow ? 'bg-amber-50 text-amber-600' : 'text-gray-800'
                            }`}>
                              {isOut && <Icon name="block" size={13} fill className="text-red-500" />}
                              {isLow && !isOut && <Icon name="warning" size={13} fill className="text-amber-500" />}
                              {fmt(item.stock_quantity)} {item.unit}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-500">{fmt(item.min_stock)} {item.unit}</td>
                          <td className="px-5 py-3.5 text-right text-gray-600">{fmtVND(item.cost_price)}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-gray-800">{fmtVND(item.price)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <button onClick={() => { setAdjustItem(item); setAdjustForm({ type: 'import', quantity: '', note: '' }); setFormErr(''); }}
                              className="px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition flex items-center gap-1 ml-auto">
                              <Icon name="tune" size={13} /> Điều chỉnh
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* LOGS TAB */}
      {tab === 'logs' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3">
            <select value={logsTypeFilter} onChange={e => { setLogsTypeFilter(e.target.value); setLogsPage(1); }}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Tất cả loại</option>
              <option value="import">Nhập kho</option>
              <option value="export">Xuất kho</option>
              <option value="adjust">Điều chỉnh</option>
              <option value="order">Bán hàng</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 text-left">Sản phẩm</th>
                      <th className="px-5 py-3 text-left">Loại</th>
                      <th className="px-5 py-3 text-right">Trước</th>
                      <th className="px-5 py-3 text-right">Thay đổi</th>
                      <th className="px-5 py-3 text-right">Sau</th>
                      <th className="px-5 py-3 text-left">Ghi chú</th>
                      <th className="px-5 py-3 text-left">Người thực hiện</th>
                      <th className="px-5 py-3 text-left">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-12 text-gray-400">Chưa có lịch sử</td></tr>
                    ) : logs.map(log => {
                      const tm = TYPE_MAP[log.type] ?? TYPE_MAP.adjust;
                      const isPositive = log.quantity_change > 0;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50 transition">
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-gray-800">{log.product_name}</p>
                            {log.sku && <p className="text-xs text-gray-400">{log.sku}</p>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${tm.color}`}>
                              <Icon name={tm.icon} size={12} fill /> {tm.label}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-gray-500">{fmt(log.quantity_before)}</td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{fmt(log.quantity_change)}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-semibold text-gray-800">{fmt(log.quantity_after)}</td>
                          <td className="px-5 py-3.5 text-gray-500 text-xs max-w-32 truncate">{log.note || '—'}</td>
                          <td className="px-5 py-3.5 text-gray-600 text-xs">{log.user_name}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs">{fmtDate(log.created_at)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {/* Logs Pagination */}
            {Math.ceil(logsTotal / 30) > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-gray-50">
                <p className="text-xs text-gray-400">Trang {logsPage}/{Math.ceil(logsTotal/30)}</p>
                <div className="flex gap-2">
                  <button disabled={logsPage <= 1} onClick={() => setLogsPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1">
                    <Icon name="chevron_left" size={14} /> Trước
                  </button>
                  <button disabled={logsPage >= Math.ceil(logsTotal/30)} onClick={() => setLogsPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1">
                    Sau <Icon name="chevron_right" size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Adjust Modal */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Điều chỉnh kho</h3>
              <button onClick={() => setAdjustItem(null)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"><Icon name="close" size={16} /></button>
            </div>
            <form onSubmit={handleAdjust} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <p className="font-semibold text-gray-800">{adjustItem.name}</p>
                <p className="text-gray-500 text-xs mt-1">Tồn kho hiện tại: <strong>{fmt(adjustItem.stock_quantity)} {adjustItem.unit}</strong></p>
              </div>
              {formErr && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formErr}</div>}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Loại điều chỉnh *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'import', label: 'Nhập kho', icon: 'add_circle', color: 'text-emerald-600' },
                    { value: 'export', label: 'Xuất kho', icon: 'remove_circle', color: 'text-blue-600' },
                    { value: 'adjust', label: 'Kiểm kê', icon: 'tune', color: 'text-amber-600' },
                  ].map(t => (
                    <label key={t.value} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition ${adjustForm.type === t.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" className="sr-only" name="adj-type" value={t.value}
                        checked={adjustForm.type === t.value}
                        onChange={() => setAdjustForm({ ...adjustForm, type: t.value })} />
                      <Icon name={t.icon} size={22} fill className={`${t.color} mx-auto mb-1`} />
                      <p className="text-xs font-semibold text-gray-700">{t.label}</p>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Số lượng {adjustForm.type === 'adjust' ? '(âm = giảm)' : ''} *
                </label>
                <input type="number" required
                  value={adjustForm.quantity}
                  onChange={e => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={adjustForm.type === 'adjust' ? 'Ví dụ: -5 hoặc +10' : 'Nhập số lượng'} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ghi chú</label>
                <input type="text"
                  value={adjustForm.note}
                  onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Lý do điều chỉnh..." />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setAdjustItem(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Hủy</button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                  {saving ? 'Đang lưu...' : 'Xác nhận'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Camera Quét */}
      {showCameraScanner && (
        <BarcodeScanner 
          onScanSuccess={handleCameraScanSuccess} 
          onClose={() => setShowCameraScanner(false)} 
        />
      )}
    </div>
  );
}