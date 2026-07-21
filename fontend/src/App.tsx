import { type JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import InventoryPage from './pages/InventoryPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';
import CustomersPage from './pages/CustomersPage';
import ActivityLogsPage from './pages/ActivityLogsPage';
import ShiftsPage from './pages/ShiftsPage';
import ScannerPage from './pages/ScannerPage';
import POSSettingsPage from './pages/POSSettingsPage';
import Layout from './components/Layout';

const PrivateRoute = ({ children, roles }: { children: JSX.Element; roles?: string[] }) => {
  const { isLoggedIn, user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to={user.role === 'admin' ? '/dashboard' : '/pos'} replace />;
  return children;
};

const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const { isLoggedIn, user, isLoading } = useAuth();
  if (isLoading) return null;
  if (isLoggedIn && user) return <Navigate to={user.role === 'admin' ? '/dashboard' : '/pos'} replace />;
  return children;
};

const RootRedirect = () => {
  const { isLoggedIn, user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Navigate to={user?.role === 'admin' ? '/dashboard' : '/pos'} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      {/* Scanner — fullscreen không Layout, dùng cho ĐT */}
      <Route path="/scanner" element={<PrivateRoute><ScannerPage /></PrivateRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="dashboard" element={<PrivateRoute roles={['admin']}><DashboardPage /></PrivateRoute>} />
        <Route path="pos" element={<POSPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="reports" element={<PrivateRoute roles={['admin']}><ReportsPage /></PrivateRoute>} />
        <Route path="users" element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="activity-logs" element={<PrivateRoute roles={['admin']}><ActivityLogsPage /></PrivateRoute>} />
        <Route path="shifts" element={<ShiftsPage />} />
        <Route path="pos-settings" element={<PrivateRoute roles={['admin']}><POSSettingsPage /></PrivateRoute>} />
      </Route>
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}