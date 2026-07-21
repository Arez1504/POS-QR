// frontend/src/services/userService.ts
import api from './authService';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'cashier';
  avatar?: string;
  is_active: boolean;
  created_at: string;
}

export interface UserStats {
  total: number;
  admins: number;
  cashiers: number;
  active: number;
  inactive: number;
}

export interface CreateUserPayload {
  username: string;
  password: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: 'admin' | 'cashier';
}

export interface UpdateUserPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  role?: 'admin' | 'cashier' | 'warehouse';
  is_active?: boolean;
}

export const userService = {
  getAll: async (params?: { role?: string; is_active?: string; search?: string }): Promise<User[]> => {
    const res = await api.get('/users', { params });
    return res.data.users;
  },

  getOne: async (id: number): Promise<User> => {
    const res = await api.get(`/users/${id}`);
    return res.data.user;
  },

  getStats: async (): Promise<UserStats> => {
    const res = await api.get('/users/stats');
    return res.data.stats;
  },

  create: async (payload: CreateUserPayload): Promise<User> => {
    const res = await api.post('/users', payload);
    return res.data.user;
  },

  update: async (id: number, payload: UpdateUserPayload): Promise<User> => {
    const res = await api.put(`/users/${id}`, payload);
    return res.data.user;
  },

  resetPassword: async (id: number, new_password: string): Promise<void> => {
    await api.put(`/users/${id}/reset-password`, { new_password });
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
