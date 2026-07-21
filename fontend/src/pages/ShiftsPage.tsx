// frontend/src/pages/ShiftsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { shiftService } from '../services/shiftService';
import type { Shift, ShiftAssignment } from '../services/shiftService';
import { userService } from '../services/userService';
import type { User } from '../services/userService';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';

const getDurationStr = (start: string, end: string | null) => {
  const sTime = new Date(start).getTime();
  const eTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = eTime - sTime;
  const diffMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}p`;
  return `${mins} phút`;
};

export default function ShiftsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'assignments' | 'history'>('assignments');
  const [cashiers, setCashiers] = useState<User[]>([]);

  // ─── TAB 1: STATE PHÂN CÔNG CA LÀM ───
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(true);
  const [assignError, setAssignError] = useState('');
  const [filterAssignUser, setFilterAssignUser] = useState('');
  const [assignStartDate, setAssignStartDate] = useState('');
  const [assignEndDate, setAssignEndDate] = useState('');

  // Modals for CRUD assignments
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<ShiftAssignment | null>(null);
  const [assignForm, setAssignForm] = useState({
    user_id: '',
    shift_date: '',
    shift_name: 'Ca sáng',
    start_time: '08:00',
    end_time: '16:00',
    notes: ''
  });
  const [assignSubmitting, setAssignSubmitting] = useState(false);

  // ─── TAB 2: STATE LỊCH SỬ CA LÀM VIỆC ───
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(15);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const [filterHistoryUser, setFilterHistoryUser] = useState('');
  const [filterHistoryStatus, setFilterHistoryStatus] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');

  // ─── EFFECTS & LOADS ───
  const fetchUsers = async () => {
    try {
      const list = await userService.getAll();
      setCashiers(list);
    } catch (e) {
      console.error('Error fetching cashiers list:', e);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  // Fetch assignments
  const fetchAssignments = useCallback(async () => {
    setAssignLoading(true);
    setAssignError('');
    try {
      const res = await shiftService.getAssignments({
        user_id: filterAssignUser ? parseInt(filterAssignUser) : undefined,
        start_date: assignStartDate || undefined,
        end_date: assignEndDate || undefined
      });
      if (res.success) {
        setAssignments(res.data);
      } else {
        setAssignError('Lỗi nạp danh sách phân công ca làm');
      }
    } catch (err) {
      console.error(err);
      setAssignError('Không thể kết nối đến server để lấy lịch phân công');
    } finally {
      setAssignLoading(false);
    }
  }, [filterAssignUser, assignStartDate, assignEndDate]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await shiftService.getHistory({
        page: historyPage,
        limit: historyLimit,
        user_id: filterHistoryUser ? parseInt(filterHistoryUser) : undefined,
        status: (filterHistoryStatus as any) || undefined,
        start_date: historyStartDate || undefined,
        end_date: historyEndDate || undefined
      });
      if (res.success) {
        setShifts(res.data);
        setHistoryTotal(res.total);
      } else {
        setHistoryError('Lỗi nạp lịch sử ca làm việc');
      }
    } catch (err) {
      console.error(err);
      setHistoryError('Không thể kết nối đến server để tải lịch sử ca');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage, historyLimit, filterHistoryUser, filterHistoryStatus, historyStartDate, historyEndDate]);

  useEffect(() => {
    if (activeTab === 'assignments') {
      fetchAssignments();
    } else {
      fetchHistory();
    }
  }, [activeTab, fetchAssignments, fetchHistory]);

  // Reset pages when filters change
  useEffect(() => {
    setHistoryPage(1);
  }, [filterHistoryUser, filterHistoryStatus, historyStartDate, historyEndDate]);

  // ─── CRUD ASSIGNMENT HANDLERS ───
  const handleOpenAddModal = () => {
    setEditingAssignment(null);
    setAssignForm({
      user_id: cashiers[0]?.id ? String(cashiers[0].id) : '',
      shift_date: new Date().toISOString().split('T')[0],
      shift_name: 'Ca sáng',
      start_time: '08:00',
      end_time: '16:00',
      notes: ''
    });
    setShowAssignModal(true);
  };

  const handleOpenEditModal = (assign: ShiftAssignment) => {
    setEditingAssignment(assign);
    setAssignForm({
      user_id: String(assign.user_id),
      shift_date: assign.shift_date.split('T')[0],
      shift_name: assign.shift_name,
      start_time: assign.start_time.substring(0, 5),
      end_time: assign.end_time.substring(0, 5),
      notes: assign.notes || ''
    });
    setShowAssignModal(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssignSubmitting(true);
    try {
      const payload = {
        user_id: parseInt(assignForm.user_id),
        shift_date: assignForm.shift_date,
        shift_name: assignForm.shift_name,
        start_time: assignForm.start_time + ':00',
        end_time: assignForm.end_time + ':00',
        notes: assignForm.notes
      };

      if (editingAssignment) {
        const res = await shiftService.updateAssignment(editingAssignment.id, payload);
        if (res.success) {
          setShowAssignModal(false);
          fetchAssignments();
        }
      } else {
        const res = await shiftService.createAssignment(payload);
        if (res.success) {
          setShowAssignModal(false);
          fetchAssignments();
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Có lỗi xảy ra khi lưu phân công ca làm');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phân công ca làm việc này không?')) return;
    try {
      const res = await shiftService.deleteAssignment(id);
      if (res.success) {
        fetchAssignments();
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể xóa phân công ca');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-gray-100 p-5 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 tracking-tight">
            <Icon name="assignment_ind" size={28} className="text-blue-600" />
            Ca làm việc
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">
            Quản lý và phân công lịch trực cho nhân viên, theo dõi lịch sử mở/đóng ca đối soát doanh số két tiền mặt
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'assignments' && isAdmin && (
            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Icon name="add" size={16} /> Phân công ca
            </button>
          )}
          <button
            onClick={activeTab === 'assignments' ? fetchAssignments : fetchHistory}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            <Icon name="refresh" size={16} /> Làm mới
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('assignments')}
          className={`py-3 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'assignments'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon name="event" size={18} /> Phân công ca làm
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-6 font-bold text-sm transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'border-blue-600 text-blue-600 font-extrabold'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <Icon name="history" size={18} /> Lịch sử hoạt động ca
        </button>
      </div>

      {/* ─── TAB 1: PHÂN CÔNG CA LÀM ─── */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
            {isAdmin && (
              <select
                value={filterAssignUser}
                onChange={(e) => setFilterAssignUser(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px] text-gray-700 font-medium"
              >
                <option value="">Tất cả nhân viên</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.full_name} (@{cashier.username})
                  </option>
                ))}
              </select>
            )}

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={assignStartDate}
                onChange={(e) => setAssignStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 font-medium"
              />
              <span className="text-gray-400 text-xs font-medium">đến</span>
              <input
                type="date"
                value={assignEndDate}
                onChange={(e) => setAssignEndDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 font-medium"
              />
            </div>
          </div>

          {assignError && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold">
              {assignError}
            </div>
          )}

          {/* Assignments List Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {assignLoading ? (
              <div className="flex items-center justify-center h-60">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="text-5xl mb-4">📅</div>
                <p className="font-bold text-gray-800 text-sm">Chưa có phân công ca trực nào</p>
                <p className="text-xs text-gray-400 mt-1">Lịch phân công của nhân viên sẽ xuất hiện ở đây</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                      <th className="px-5 py-4 text-left font-bold">Ngày trực</th>
                      <th className="px-5 py-4 text-left font-bold">Nhân viên</th>
                      <th className="px-5 py-4 text-left font-bold">Tên ca</th>
                      <th className="px-5 py-4 text-left font-bold">Thời gian dự kiến</th>
                      <th className="px-5 py-4 text-left font-bold">Ghi chú / Yêu cầu</th>
                      {isAdmin && <th className="px-5 py-4 text-center font-bold">Hành động</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {assignments.map((assign) => (
                      <tr key={assign.id} className="hover:bg-gray-50/50 transition">
                        <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-gray-700">
                          {new Date(assign.shift_date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                              {assign.employee_name?.charAt(0).toUpperCase() || 'E'}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-xs">{assign.employee_name}</p>
                              <p className="text-gray-400 text-[10px]">@{assign.employee_username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                            assign.shift_name.toLowerCase().includes('sáng') ? 'bg-amber-50 text-amber-700' :
                            assign.shift_name.toLowerCase().includes('chiều') ? 'bg-blue-50 text-blue-700' :
                            assign.shift_name.toLowerCase().includes('tối') ? 'bg-purple-50 text-purple-700' : 'bg-gray-50 text-gray-700'
                          }`}>
                            {assign.shift_name}
                          </span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-xs font-bold text-gray-600">
                          {assign.start_time.substring(0, 5)} - {assign.end_time.substring(0, 5)}
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-500 font-medium max-w-[250px] truncate" title={assign.notes || ''}>
                          {assign.notes || '—'}
                        </td>
                        {isAdmin && (
                          <td className="px-5 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenEditModal(assign)}
                                className="w-7 h-7 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                title="Chỉnh sửa lịch trực"
                              >
                                <Icon name="edit" size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteAssignment(assign.id)}
                                className="w-7 h-7 flex items-center justify-center text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Xóa lịch phân công"
                              >
                                <Icon name="delete" size={16} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 2: LỊCH SỬ HOẠT ĐỘNG CA ─── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
            {isAdmin && (
              <select
                value={filterHistoryUser}
                onChange={(e) => setFilterHistoryUser(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px] text-gray-700 font-medium"
              >
                <option value="">Tất cả nhân viên</option>
                {cashiers.map((cashier) => (
                  <option key={cashier.id} value={cashier.id}>
                    {cashier.full_name} (@{cashier.username})
                  </option>
                ))}
              </select>
            )}

            <select
              value={filterHistoryStatus}
              onChange={(e) => setFilterHistoryStatus(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px] text-gray-700 font-medium"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="open">🟢 Đang hoạt động</option>
              <option value="closed">⚪ Đã kết ca</option>
            </select>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 font-medium"
              />
              <span className="text-gray-400 text-xs font-medium">đến</span>
              <input
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-600 font-medium"
              />
            </div>
          </div>

          {historyError && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold">
              {historyError}
            </div>
          )}

          {/* History Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {historyLoading ? (
              <div className="flex items-center justify-center h-60">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="text-5xl mb-4">🚪</div>
                <p className="font-bold text-gray-800 text-sm">Không tìm thấy ca làm việc nào</p>
                <p className="text-xs text-gray-400 mt-1">Các nhân viên chưa mở ca làm việc trong khoảng thời gian này</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide border-b border-gray-100">
                      <th className="px-5 py-4 text-left font-bold">Nhân viên</th>
                      <th className="px-5 py-4 text-left font-bold">Trạng thái</th>
                      <th className="px-5 py-4 text-left font-bold">Thời gian hoạt động</th>
                      <th className="px-5 py-4 text-right font-bold">Tiền đầu ca</th>
                      <th className="px-5 py-4 text-right font-bold">Doanh thu ca</th>
                      <th className="px-5 py-4 text-right font-bold">Bàn giao thực tế</th>
                      <th className="px-5 py-4 text-right font-bold">Chênh lệch két</th>
                      <th className="px-5 py-4 text-left font-bold">Ghi chú bàn giao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {shifts.map((shift) => {
                      const duration = getDurationStr(shift.start_time, shift.end_time);
                      return (
                        <tr key={shift.id} className="hover:bg-gray-50/50 transition">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                {shift.cashier_name?.charAt(0).toUpperCase() || 'C'}
                              </div>
                              <div>
                                <p className="font-bold text-gray-800 text-xs">{shift.cashier_name}</p>
                                <p className="text-gray-400 text-[10px]">@{shift.cashier_username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {shift.status === 'open' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Đang hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-100">
                                Đã kết ca
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-xs text-gray-600 font-semibold">
                            <div>
                              {new Date(shift.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {shift.end_time ? new Date(shift.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Hiện tại'}
                            </div>
                            <div className="text-gray-400 font-medium text-[10px] mt-0.5">
                              {new Date(shift.start_time).toLocaleDateString('vi-VN')} ({duration})
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-gray-700 whitespace-nowrap">
                            {Number(shift.opening_cash).toLocaleString('vi-VN')}đ
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="font-semibold text-blue-600">
                              {Number(shift.total_sales).toLocaleString('vi-VN')}đ
                            </div>
                            <div className="text-gray-400 font-medium text-[10px] mt-0.5">
                              {shift.total_orders} đơn hàng
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-semibold text-gray-800 whitespace-nowrap">
                            {shift.closing_cash !== null ? `${Number(shift.closing_cash).toLocaleString('vi-VN')}đ` : '—'}
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            {shift.status === 'open' ? (
                              <span className="text-gray-400">—</span>
                            ) : (() => {
                              const actualDiff = Number(shift.closing_cash) - Number(shift.opening_cash) - Number(shift.total_sales);
                              if (actualDiff === 0) {
                                return <span className="text-emerald-600 font-bold">Khớp két (0đ)</span>;
                              } else if (actualDiff > 0) {
                                return <span className="text-teal-600 font-bold">+{actualDiff.toLocaleString('vi-VN')}đ</span>;
                              } else {
                                return <span className="text-rose-600 font-bold">{actualDiff.toLocaleString('vi-VN')}đ</span>;
                              }
                            })()}
                          </td>
                          <td className="px-5 py-4 text-gray-500 text-xs font-medium max-w-[180px] truncate" title={shift.note || ''}>
                            {shift.note || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* History Pagination */}
            {!historyLoading && historyTotal > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 text-xs text-gray-400 font-medium">
                <div>
                  Hiển thị <span className="font-bold text-gray-700">{shifts.length}</span> trên <span className="font-bold text-gray-700">{historyTotal}</span> ca hoạt động
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage(historyPage - 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 transition disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  >
                    ◀
                  </button>
                  {Array.from({ length: Math.ceil(historyTotal / historyLimit) }).map((_, i) => {
                    const p = i + 1;
                    const active = p === historyPage;
                    return (
                      <button
                        key={p}
                        onClick={() => setHistoryPage(p)}
                        className={`w-7 h-7 rounded-lg font-bold text-xs transition cursor-pointer ${
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
                    disabled={historyPage === Math.ceil(historyTotal / historyLimit)}
                    onClick={() => setHistoryPage(historyPage + 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center border border-gray-200 hover:bg-gray-50 text-gray-500 transition disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                  >
                    ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ADD/EDIT ASSIGNMENT MODAL (ADMIN ONLY) ─── */}
      {showAssignModal && isAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-blue-50">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Icon name="event" size={20} className="text-blue-600" />
                {editingAssignment ? 'Cập nhật phân công ca' : 'Phân công ca làm mới'}
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveAssignment}>
              <div className="p-6 space-y-4 text-xs font-semibold text-gray-500">
                {/* Employee select */}
                <div className="space-y-1">
                  <label className="text-gray-500">Nhân viên trực ca <span className="text-rose-500">*</span></label>
                  <select
                    value={assignForm.user_id}
                    onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                    required
                    disabled={!!editingAssignment}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  >
                    <option value="">-- Chọn nhân viên --</option>
                    {cashiers.map((cashier) => (
                      <option key={cashier.id} value={cashier.id}>
                        {cashier.full_name} (@{cashier.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Date picker */}
                  <div className="space-y-1">
                    <label className="text-gray-500">Ngày làm việc <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      value={assignForm.shift_date}
                      onChange={(e) => setAssignForm({ ...assignForm, shift_date: e.target.value })}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Shift name select */}
                  <div className="space-y-1">
                    <label className="text-gray-500">Ca làm <span className="text-rose-500">*</span></label>
                    <select
                      value={assignForm.shift_name}
                      onChange={(e) => {
                        const name = e.target.value;
                        let start = '08:00';
                        let end = '16:00';
                        if (name === 'Ca chiều') {
                          start = '16:00';
                          end = '23:00';
                        } else if (name === 'Ca tối') {
                          start = '23:00';
                          end = '06:00';
                        }
                        setAssignForm({ ...assignForm, shift_name: name, start_time: start, end_time: end });
                      }}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white text-gray-700 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    >
                      <option value="Ca sáng">Ca sáng</option>
                      <option value="Ca chiều">Ca chiều</option>
                      <option value="Ca tối">Ca tối</option>
                      <option value="Ca khác">Ca khác</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start time */}
                  <div className="space-y-1">
                    <label className="text-gray-500">Giờ bắt đầu ca <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      value={assignForm.start_time}
                      onChange={(e) => setAssignForm({ ...assignForm, start_time: e.target.value })}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>

                  {/* End time */}
                  <div className="space-y-1">
                    <label className="text-gray-500">Giờ kết thúc ca <span className="text-rose-500">*</span></label>
                    <input
                      type="time"
                      value={assignForm.end_time}
                      onChange={(e) => setAssignForm({ ...assignForm, end_time: e.target.value })}
                      required
                      className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1">
                  <label className="text-gray-500">Ghi chú / Yêu cầu công việc</label>
                  <textarea
                    rows={3}
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                    placeholder="Mô tả công việc cần làm trong ca, hoặc dặn dò giao hàng..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2.5 border border-gray-200 hover:bg-gray-100 text-gray-600 rounded-xl active:scale-[0.98] transition text-xs font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={assignSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl active:scale-[0.98] transition text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-200 disabled:opacity-50 cursor-pointer"
                >
                  {assignSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={14} />
                      {editingAssignment ? 'Cập nhật' : 'Phân công ca'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
