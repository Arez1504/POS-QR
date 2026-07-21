// frontend/src/services/activityService.ts
import api from './authService';

export interface ActivityLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ActivityLogParams {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
}

export interface ActivityLogResponse {
  success: boolean;
  data: ActivityLog[];
  actions: string[];
  total: number;
  page: number;
  limit: number;
}

export const activityService = {
  getLogs: async (params: ActivityLogParams = {}): Promise<ActivityLogResponse> => {
    const res = await api.get('/activity-logs', { params });
    return res.data;
  }
};
