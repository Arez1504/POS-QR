// frontend/src/pages/UsersPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { userService } from '../services/userService';
import type { User, CreateUserPayload, UpdateUserPayload, UserStats } from '../services/userService';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';

// ─── helpers ──────────────────────────────────────────────────────────────────
const ROLES = [
  { value: 'admin',   label: 'Quản trị viên',       color: 'bg-red-100 text-red-700',   icon: 'manage_accounts' },
  { value: 'cashier', label: 'Nhân viên bán hàng', color: 'bg-blue-100 text-blue-700', icon: 'point_of_sale' },
] as const;

const roleInfo = (role: string) => ROLES.find(r => r.value === role) ?? ROLES[1];

const initCreate: CreateUserPayload = {
  username: '', password: '', full_name: '', email: '', phone: '', role: 'cashier',
};

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, iconColor }: { icon: string; label: string; value: number; color: string; iconColor?: string }) {
  return (
    <div className={`rounded-2xl p-5 flex items-center gap-4 ${color}`}>
      <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
        <Icon name={icon} size={22} fill className={iconColor ?? 'text-gray-600'} />
      </div>
      <div>
        <p className="text-xs opacity-70 font-medium">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
          <button
            id="modal-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition"
          >✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me } = useAuth();

  const [users, setUsers]   = useState<User[]>([]);
  const [stats, setStats]   = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  // filters
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');

  // modals
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser]     = useState<User | null>(null);
  const [resetUser, setResetUser]   = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  // forms
  const [createForm, setCreateForm] = useState<CreateUserPayload>(initCreate);
  const [editForm, setEditForm]     = useState<UpdateUserPayload>({});
  const [newPassword, setNewPassword] = useState('');
  const [formErr, setFormErr]       = useState('');
  const [saving, setSaving]         = useState(false);

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersData, statsData] = await Promise.all([
        userService.getAll({
          search:    search    || undefined,
          role:      filterRole   || undefined,
          is_active: filterActive || undefined,
        }),
        userService.getStats(),
      ]);
      setUsers(usersData);
      setStats(statsData);
      setError('');
    } catch {
      setError('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterActive]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── create ─────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!createForm.username.trim() || !createForm.password || !createForm.full_name.trim()) {
      return setFormErr('Vui lòng nhập đầy đủ thông tin bắt buộc');
    }
    if (createForm.password.length < 6) return setFormErr('Mật khẩu ít nhất 6 ký tự');
    setSaving(true);
    try {
      await userService.create(createForm);
      setShowCreate(false);
      setCreateForm(initCreate);
      fetchAll();
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Tạo tài khoản thất bại');
    } finally { setSaving(false); }
  };

  // ── edit ───────────────────────────────────────────────────────────────────
  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({
      full_name: u.full_name,
      email:     u.email     || '',
      phone:     u.phone     || '',
      role:      u.role,
      is_active: u.is_active,
    });
    setFormErr('');
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setFormErr('');
    if (!editForm.full_name?.trim()) return setFormErr('Họ tên không được để trống');
    setSaving(true);
    try {
      await userService.update(editUser.id, editForm);
      setEditUser(null);
      fetchAll();
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Cập nhật thất bại');
    } finally { setSaving(false); }
  };

  // ── reset password ─────────────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (newPassword.length < 6) return setFormErr('Mật khẩu ít nhất 6 ký tự');
    setSaving(true);
    try {
      await userService.resetPassword(resetUser.id, newPassword);
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      setFormErr(err.response?.data?.message || 'Đặt lại mật khẩu thất bại');
    } finally { setSaving(false); }
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteUser) return;
    setSaving(true);
    try {
      await userService.delete(deleteUser.id);
      setDeleteUser(null);
      fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể xóa người dùng');
      setDeleteUser(null);
    } finally { setSaving(false); }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Icon name="group" size={28} fill className="text-blue-600" />Quản lý nhân viên</h1>
          <p className="text-gray-500 text-sm mt-1">Thêm, sửa, phân quyền tài khoản hệ thống</p>
        </div>
        <button
          id="create-user-btn"
          onClick={() => { setShowCreate(true); setFormErr(''); }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition shadow-sm"
        >
          <Icon name="person_add" size={18} /> Thêm nhân viên
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <StatCard icon="group"           label="Tổng cộng"     value={stats.total}    color="bg-gray-50"     iconColor="text-gray-600" />
          <StatCard icon="manage_accounts" label="Quản trị"      value={stats.admins}   color="bg-red-50"      iconColor="text-red-600" />
          <StatCard icon="point_of_sale"   label="Nhân viên"      value={stats.cashiers} color="bg-blue-50"     iconColor="text-blue-600" />
          <StatCard icon="check_circle"    label="Đang hoạt động" value={stats.active}   color="bg-emerald-50" iconColor="text-emerald-600" />
          <StatCard icon="block"           label="Vô hiệu"        value={stats.inactive} color="bg-orange-50"  iconColor="text-orange-500" />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <input
          id="search-users"
          type="text"
          placeholder="🔍  Tìm theo tên, username, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          id="filter-role"
          value={filterRole}
          onChange={e => setFilterRole(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả role</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.icon} {r.label}</option>)}
        </select>
        <select
          id="filter-active"
          value={filterActive}
          onChange={e => setFilterActive(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="true">✅ Đang hoạt động</option>
          <option value="false">🚫 Vô hiệu hóa</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">👥</div>
            <p className="font-medium">Không tìm thấy người dùng</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Nhân viên</th>
                  <th className="px-5 py-3 text-left">Thông tin</th>
                  <th className="px-5 py-3 text-left">Vai trò</th>
                  <th className="px-5 py-3 text-left">Trạng thái</th>
                  <th className="px-5 py-3 text-left">Ngày tạo</th>
                  <th className="px-5 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => {
                  const ri = roleInfo(u.role);
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={`hover:bg-gray-50 transition ${!u.is_active ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800">
                              {u.full_name}
                              {isMe && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">Bạn</span>}
                            </p>
                            <p className="text-gray-400 text-xs">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-gray-500">
                        <div>{u.email || '—'}</div>
                        <div className="text-xs">{u.phone || ''}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ri.color}`}>
                          <Icon name={ri.icon} size={13} fill />
                          {ri.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {u.is_active
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full"><Icon name="check_circle" size={13} fill className="text-emerald-500" />Hoạt động</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full"><Icon name="block" size={13} fill className="text-orange-500" />Vô hiệu</span>
                        }
                      </td>
                      <td className="px-5 py-4 text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            id={`edit-user-${u.id}`}
                            onClick={() => openEdit(u)}
                            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition flex items-center gap-1"
                          ><Icon name="edit" size={14} />Sửa</button>
                          <button
                            id={`reset-pwd-${u.id}`}
                            onClick={() => { setResetUser(u); setNewPassword(''); setFormErr(''); }}
                            className="px-3 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition flex items-center gap-1"
                          ><Icon name="key" size={14} />Đặt lại MK</button>
                          {!isMe && (
                            <button
                              id={`delete-user-${u.id}`}
                              onClick={() => setDeleteUser(u)}
                              className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
                            ><Icon name="delete" size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Tạo user ── */}
      {showCreate && (
        <Modal title="Thêm nhân viên mới" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {formErr && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formErr}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tên đăng nhập *</label>
                <input id="new-username" type="text" required
                  value={createForm.username}
                  onChange={e => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="vd: nguyenvana"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Mật khẩu *</label>
                <input id="new-password" type="password" required
                  value={createForm.password}
                  onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tối thiểu 6 ký tự"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Họ và tên *</label>
              <input id="new-fullname" type="text" required
                value={createForm.full_name}
                onChange={e => setCreateForm({ ...createForm, full_name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input id="new-email" type="email"
                  value={createForm.email}
                  onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Điện thoại</label>
                <input id="new-phone" type="tel"
                  value={createForm.phone}
                  onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0901234567"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Vai trò *</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(r => (
                  <label key={r.value} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition ${createForm.role === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="create-role" value={r.value} className="sr-only"
                      checked={createForm.role === r.value}
                      onChange={() => setCreateForm({ ...createForm, role: r.value as any })}
                    />
                    <div className="flex justify-center mb-1">
                      <Icon name={r.icon} size={24} fill={createForm.role === r.value} className={createForm.role === r.value ? 'text-blue-600' : 'text-gray-400'} />
                    </div>
                    <div className="text-xs font-semibold text-gray-700">{r.label}</div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Hủy
              </button>
              <button type="submit" disabled={saving} id="submit-create-user"
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Sửa user ── */}
      {editUser && (
        <Modal title={`✏️ Sửa: ${editUser.username}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {formErr && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formErr}</div>}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Họ và tên *</label>
              <input id="edit-fullname" type="text" required
                value={editForm.full_name || ''}
                onChange={e => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input id="edit-email" type="email"
                  value={editForm.email || ''}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Điện thoại</label>
                <input id="edit-phone" type="tel"
                  value={editForm.phone || ''}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Vai trò - không cho tự hạ quyền */}
            {editUser.id !== me?.id && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Vai trò</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(r => (
                    <label key={r.value} className={`cursor-pointer rounded-xl border-2 p-3 text-center transition ${editForm.role === r.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="edit-role" value={r.value} className="sr-only"
                        checked={editForm.role === r.value}
                        onChange={() => setEditForm({ ...editForm, role: r.value as any })}
                      />
                      <div className="text-2xl mb-1">{r.icon}</div>
                      <div className="text-xs font-semibold text-gray-700">{r.label}</div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input id="edit-active" type="checkbox"
                  checked={editForm.is_active !== false}
                  onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })}
                  className="sr-only peer"
                  disabled={editUser.id === me?.id}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                <span className="ml-2 text-sm font-medium text-gray-700">Tài khoản hoạt động</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Hủy
              </button>
              <button type="submit" disabled={saving} id="submit-edit-user"
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Reset password ── */}
      {resetUser && (
        <Modal title={`🔑 Đặt lại mật khẩu: ${resetUser.username}`} onClose={() => setResetUser(null)}>
          <form onSubmit={handleReset} className="space-y-4">
            {formErr && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{formErr}</div>}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              ⚠️ Mật khẩu mới sẽ được đặt ngay lập tức. Thông báo cho người dùng sau khi đặt lại.
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Mật khẩu mới *</label>
              <input id="reset-new-password" type="password" required
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setFormErr(''); }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Tối thiểu 6 ký tự"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setResetUser(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Hủy
              </button>
              <button type="submit" disabled={saving} id="submit-reset-password"
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Đang đặt lại...' : '🔑 Đặt lại mật khẩu'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Xác nhận xóa ── */}
      {deleteUser && (
        <Modal title="🗑️ Xác nhận vô hiệu hóa" onClose={() => setDeleteUser(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <p>Bạn có chắc muốn <strong>vô hiệu hóa</strong> tài khoản:</p>
              <p className="mt-1 font-bold text-base">{deleteUser.full_name} (@{deleteUser.username})</p>
              <p className="mt-2 text-xs text-red-500">Tài khoản sẽ không thể đăng nhập, nhưng dữ liệu vẫn được giữ lại.</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteUser(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
                Hủy
              </button>
              <button onClick={handleDelete} disabled={saving} id="confirm-delete-user"
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2.5 rounded-xl text-sm font-semibold transition">
                {saving ? 'Đang xử lý...' : '🗑️ Vô hiệu hóa'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}