// frontend/src/pages/CustomersPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { customerService, type Customer, type CreateCustomerData, POINTS_CONFIG } from '../services/customerService';
import { useAuth } from '../hooks/useAuth';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

const EMPTY_FORM: CreateCustomerData = {
  name: '', phone: '', email: '', address: '', date_of_birth: '', gender: undefined, note: ''
};

export default function CustomersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modal, setModal] = useState<'none' | 'create' | 'edit' | 'view'>('none');
  const [form, setForm] = useState<CreateCustomerData>(EMPTY_FORM);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailCustomer, setDetailCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const LIMIT = 15;

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customerService.getList({ page, limit: LIMIT, search });
      setCustomers(data.data || []);
      setTotal(data.total || 0);
    } catch {
      setCustomers([]);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  // Debounce search
  useEffect(() => { setPage(1); }, [search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setModal('create');
  };

  const openEdit = (c: Customer) => {
    let dob = '';
    if (c.date_of_birth) {
      try {
        dob = new Date(c.date_of_birth).toISOString().split('T')[0];
      } catch {
        dob = '';
      }
    }
    setForm({
      name: c.name, phone: c.phone, email: c.email || '',
      address: c.address || '', date_of_birth: dob,
      gender: c.gender, note: c.note || '',
    });
    setSelectedId(c.id);
    setFormError('');
    setModal('edit');
  };

  const openView = async (c: Customer) => {
    setSelectedId(c.id);
    setModal('view');
    try {
      const detail = await customerService.getById(c.id);
      setDetailCustomer(detail);
    } catch { setDetailCustomer(c); }
  };

  const closeModal = () => {
    setModal('none');
    setSelectedId(null);
    setDetailCustomer(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError('Tên và Số điện thoại là bắt buộc');
      return;
    }
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(form.phone.trim())) {
      setFormError('Số điện thoại phải đúng 10 chữ số');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const dataToSave = {
        ...form,
        phone: form.phone.trim(),
      };
      if (modal === 'create') {
        await customerService.create(dataToSave);
      } else if (modal === 'edit' && selectedId) {
        await customerService.update(selectedId, dataToSave);
      }
      closeModal();
      loadCustomers();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Lỗi khi lưu');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Xóa khách hàng "${name}"?`)) return;
    try {
      await customerService.delete(id);
      loadCustomers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi khi xóa');
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">👥 Khách hàng</h1>
          <p className="text-sm text-gray-400 mt-0.5">Quản lý khách hàng thân thiết & điểm tích lũy</p>
        </div>
        <button
          id="btn-create-customer"
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
        >
          <span className="text-lg leading-none">+</span> Thêm khách hàng
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <input
          id="customer-search-input"
          type="text"
          placeholder="🔍 Tìm theo tên hoặc số điện thoại..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Khách hàng</th>
                <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Điểm tích lũy</th>
                <th className="text-right px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tổng chi tiêu</th>
                <th className="text-center px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                </td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-10 text-gray-400">
                  <div className="text-3xl mb-2">👤</div>
                  <p>Chưa có khách hàng nào</p>
                </td></tr>
              ) : customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{c.name}</p>
                        {c.email && <p className="text-xs text-gray-400">{c.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3.5 text-right">
                    <div>
                      <span className={`font-semibold ${c.reward_points > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {c.reward_points.toLocaleString('vi-VN')} điểm
                      </span>
                      {c.reward_points > 0 && (
                        <p className="text-xs text-gray-400">
                          ≈ {fmt(customerService.calculatePointsValue(c.reward_points))}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-medium text-gray-700">{fmt(c.total_spent)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button onClick={() => openView(c)}
                        className="px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition">
                        Chi tiết
                      </button>
                      <button onClick={() => openEdit(c)}
                        className="px-2.5 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition">
                        Sửa
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleDelete(c.id, c.name)}
                          className="px-2.5 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition">
                          Xóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">Tổng {total} khách hàng</p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-lg transition">
                ‹
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${page === p ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 disabled:opacity-40 rounded-lg transition">
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ MODAL: Tạo / Sửa ═══ */}
      {(modal === 'create' || modal === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">
                {modal === 'create' ? '+ Thêm khách hàng mới' : '✏️ Cập nhật khách hàng'}
              </h2>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-red-600 text-sm">{formError}</div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Họ và tên *</label>
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Số điện thoại *</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="0901234567"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@gmail.com"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Giới tính</label>
                  <select value={form.gender || ''} onChange={e => setForm(f => ({ ...f, gender: e.target.value as any || undefined }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">-- Chọn --</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ngày sinh</label>
                  <input type="date" value={form.date_of_birth || ''} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Địa chỉ</label>
                  <input type="text" value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="123 Đường ABC, Quận 1..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Ghi chú</label>
                  <textarea value={form.note || ''} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    rows={2} placeholder="Ghi chú..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
              <button onClick={closeModal} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 rounded-xl transition">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-xl transition">
                {saving ? 'Đang lưu...' : modal === 'create' ? '+ Thêm' : '✅ Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: Chi tiết khách hàng ═══ */}
      {modal === 'view' && detailCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold">
                  {detailCustomer.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">{detailCustomer.name}</h2>
                  <p className="text-xs text-gray-400">{detailCustomer.phone}</p>
                </div>
              </div>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              {/* Điểm tích lũy nổi bật */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-amber-600 font-medium">ĐIỂM TÍCH LŨY</p>
                    <p className="text-3xl font-bold text-amber-700 mt-1">
                      {detailCustomer.reward_points?.toLocaleString('vi-VN')}
                      <span className="text-base ml-1 font-normal">điểm</span>
                    </p>
                    <p className="text-xs text-amber-500 mt-0.5">
                      Quy đổi được: {fmt(customerService.calculatePointsValue(detailCustomer.reward_points))}
                    </p>
                  </div>
                  <div className="text-5xl opacity-30">🎁</div>
                </div>
              </div>

              {/* Thông tin */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Tổng chi tiêu</p>
                  <p className="font-bold text-gray-900">{fmt(detailCustomer.total_spent)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-1">Quy tắc tích điểm</p>
                  <p className="font-medium text-gray-700">
                    {(POINTS_CONFIG.POINTS_PER_VND / 1000).toLocaleString('vi-VN')}k = 1đ
                  </p>
                </div>
                {detailCustomer.email && (
                  <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-gray-400 mb-1">Email</p>
                    <p className="font-medium text-gray-700">{detailCustomer.email}</p>
                  </div>
                )}
              </div>

              {/* Lịch sử điểm */}
              {detailCustomer.point_transactions?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">🕐 Lịch sử điểm</h3>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {detailCustomer.point_transactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2 text-xs">
                        <div>
                          <span className={`font-medium ${tx.points > 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {tx.points > 0 ? '+' : ''}{tx.points} điểm
                          </span>
                          {tx.order_code && <span className="text-gray-400 ml-1">({tx.order_code})</span>}
                        </div>
                        <div className="text-right text-gray-400">
                          <div>{tx.balance_after} điểm</div>
                          <div>{new Date(tx.created_at).toLocaleDateString('vi-VN')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
