// frontend/src/pages/ActivityLogsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { activityService } from '../services/activityService';
import type { ActivityLog } from '../services/activityService';
import Icon from '../components/Icon';

const getActionColor = (action: string) => {
  if (action.includes('Đăng nhập')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (action.includes('Đăng xuất')) return 'bg-gray-50 text-gray-700 border-gray-100';
  if (action.includes('Mở ca')) return 'bg-teal-50 text-teal-700 border-teal-100';
  if (action.includes('Đóng ca')) return 'bg-blue-50 text-blue-700 border-blue-100';
  if (action.includes('Tạo đơn')) return 'bg-sky-50 text-sky-700 border-sky-100';
  if (action.includes('Hủy đơn')) return 'bg-rose-50 text-rose-700 border-rose-100';
  if (action.includes('Thêm')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (action.includes('Sửa')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if (action.includes('Xóa') || action.includes('Vô hiệu')) return 'bg-red-50 text-red-700 border-red-100';
  if (action.includes('Mật khẩu') || action.includes('Đặt lại')) return 'bg-indigo-50 text-indigo-700 border-indigo-100';
  if (action.includes('kho') || action.includes('Kho')) return 'bg-purple-50 text-purple-700 border-purple-100';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

const getActionIcon = (action: string) => {
  if (action.includes('Đăng nhập')) return 'login';
  if (action.includes('Đăng xuất')) return 'logout';
  if (action.includes('Mở ca')) return 'play_circle';
  if (action.includes('Đóng ca')) return 'cancel';
  if (action.includes('Tạo đơn')) return 'shopping_cart';
  if (action.includes('Hủy đơn')) return 'remove_shopping_cart';
  if (action.includes('Thêm')) return 'add_circle';
  if (action.includes('Sửa')) return 'edit_note';
  if (action.includes('Xóa') || action.includes('Vô hiệu')) return 'delete_sweep';
  if (action.includes('Mật khẩu') || action.includes('Đặt lại')) return 'lock_reset';
  if (action.includes('kho') || action.includes('Kho')) return 'warehouse';
  return 'info';
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [actionsList, setActionsList] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await activityService.getLogs({
        page,
        limit,
        search: search || undefined,
        action: filterAction || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });

      if (res.success) {
        setLogs(res.data);
        setTotal(res.total);
        if (res.actions) {
          setActionsList(res.actions);
        }
        setError('');
      } else {
        setError('Lỗi khi tải lịch sử hoạt động');
      }
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối đến server để tải lịch sử');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, filterAction, startDate, endDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterAction, startDate, endDate]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Icon name="history" size={28} className="text-blue-600 font-bold" />
            Lịch sử hoạt động
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Nhật ký kiểm toán toàn bộ hành động đăng nhập, ca làm, đơn hàng và các thiết lập trên hệ thống
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-semibold text-sm transition"
        >
          <Icon name="refresh" size={18} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[240px] relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 select-none text-sm">🔍</span>
          <input
            type="text"
            placeholder="Tìm theo tài khoản, chi tiết..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]"
        >
          <option value="">Tất cả hoạt động</option>
          {actionsList.map((act) => (
            <option key={act} value={act}>
              {act}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
          />
          <span className="text-gray-400 text-xs">đến</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600"
          />
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-60">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-4">📝</div>
            <p className="font-medium">Không tìm thấy nhật ký hoạt động nào</p>
            <p className="text-xs text-gray-400 mt-1">Vui lòng điều chỉnh lại bộ lọc hoặc từ khóa tìm kiếm</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                  <th className="px-6 py-4 text-left font-semibold">Thời gian</th>
                  <th className="px-6 py-4 text-left font-semibold">Tài khoản</th>
                  <th className="px-6 py-4 text-left font-semibold">Loại hoạt động</th>
                  <th className="px-6 py-4 text-left font-semibold">Chi tiết hành động</th>
                  <th className="px-6 py-4 text-left font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/70 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-medium">
                      {new Date(log.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                          {log.username?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <span className="font-semibold text-gray-800">
                          {log.username || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${getActionColor(log.action)}`}>
                        <Icon name={getActionIcon(log.action)} size={13} fill className="opacity-90 shrink-0" />
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-md break-words leading-relaxed text-[13px]">
                      {log.details}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-400 font-mono">
                      {log.ip_address || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-sm text-gray-500">
            <div>
              Hiển thị <span className="font-medium text-gray-800">{logs.length}</span> trên <span className="font-medium text-gray-800">{total}</span> hoạt động
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                ◀
              </button>
              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                const active = p === page;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg font-semibold text-xs transition ${
                      active
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                        : 'border border-gray-200 hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
