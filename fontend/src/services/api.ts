/**
 * src/services/api.ts
 * Chứa logic gọi API (fetch, axios, v.v...)
 */

import { API_BASE_URL, API_TIMEOUT } from "../config/config";
import type { ApiResponse } from "../types";

/**
 * Hàm generic fetch data từ API
 * @template T - Kiểu dữ liệu response
 * @param endpoint - URL endpoint (ví dụ: /products, /users)
 * @param options - Fetch options (method, body, headers)
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Tạo AbortController để handle timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || "Lỗi gọi API",
      };
    }

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi không xác định";
    return {
      success: false,
      error: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * GET request
 */
export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiCall<T>(endpoint, {
    method: "GET",
  });
}

/**
 * POST request
 */
export async function apiPost<T>(
  endpoint: string,
  data: unknown
): Promise<ApiResponse<T>> {
  return apiCall<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * PUT request
 */
export async function apiPut<T>(
  endpoint: string,
  data: unknown
): Promise<ApiResponse<T>> {
  return apiCall<T>(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<ApiResponse<T>> {
  return apiCall<T>(endpoint, {
    method: "DELETE",
  });
}

/**
 * Example usage:
 * 
 * const response = await apiGet<Product[]>('/products');
 * if (response.success) {
 *   console.log(response.data);
 * } else {
 *   console.error(response.error);
 * }
 */
