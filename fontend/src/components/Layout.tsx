// frontend/src/components/Layout.tsx
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Icon from './Icon';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const menuItems = [
    { label: 'Dashboard',    path: '/dashboard', icon: 'dashboard', roles: ['admin'] },
    { label: 'POS Bán hàng', path: '/pos',       icon: 'point_of_sale' },
    { label: 'Sản phẩm',     path: '/products',  icon: 'inventory_2' },
    { label: 'Đơn hàng',     path: '/orders',    icon: 'receipt_long' },
    { label: 'Khách hàng',   path: '/customers', icon: 'group' },
    { label: 'Kho hàng',     path: '/inventory', icon: 'warehouse'       },
    { label: 'Báo cáo',      path: '/reports',   icon: 'bar_chart',       roles: ['admin'] },
    { label: 'Nhân viên',    path: '/users',     icon: 'manage_accounts', roles: ['admin'] },
    { label: 'Ca làm',       path: '/shifts',    icon: 'assignment_ind' },
    { label: 'Lịch sử HĐ',    path: '/activity-logs', icon: 'history',      roles: ['admin'] },
    { label: 'Quản lý POS',   path: '/pos-settings',  icon: 'settings',     roles: ['admin'] },
  ];

  const filteredMenu = menuItems.filter(item => !item.roles || (user && item.roles.includes(user.role)));
  const currentPage = menuItems.find(m => location.pathname.startsWith(m.path))?.label ?? 'Dashboard';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-[72px]'} bg-white border-r border-gray-100 text-gray-700 transition-all duration-300 flex flex-col shrink-0 shadow-sm`}>
        {/* Logo */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between px-5' : 'justify-center px-3'} py-5 border-b border-gray-100`}>
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shrink-0">
                <Icon name="qr_code_2" size={20} className="text-white" />
              </div>
              <span className="font-bold text-[15px] tracking-tight text-gray-900">POS System</span>
            </div>
          )}
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition text-gray-400 hover:text-gray-700"
          >
            <Icon name={sidebarOpen ? 'menu_open' : 'menu'} size={20} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredMenu.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                id={`nav-${item.path.replace('/', '')}`}
                onClick={() => navigate(item.path)}
                title={!sidebarOpen ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium ${
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                }`}
              >
                <Icon
                  name={item.icon}
                  size={20}
                  fill={active}
                  className={active ? 'text-white' : 'text-gray-400'}
                />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
                {sidebarOpen && active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-70" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div className="border-t border-gray-100 p-3 space-y-1">
          {sidebarOpen && (
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {user?.full_name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên bán hàng'}
                </p>
              </div>
            </div>
          )}
          <button
            id="logout-btn"
            onClick={handleLogout}
            title={!sidebarOpen ? 'Đăng xuất' : undefined}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition text-sm font-medium"
          >
            <Icon name="logout" size={20} />
            {sidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{currentPage}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative w-9 h-9 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 transition">
              <Icon name="notifications" size={20} className="text-gray-500" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              {user?.full_name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}