/**
 * src/types/index.ts
 * Chứa tất cả TypeScript types/interfaces của app
 */

// ========== USER TYPES ==========
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff" | "customer";
  createdAt: Date;
}

// ========== PRODUCT TYPES ==========
export interface Product {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
  category: string;
}

// ========== ORDER TYPES ==========
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalPrice: number;
  status: OrderStatus;
  createdAt: Date;
}

export interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

export type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

// ========== API RESPONSE TYPES ==========
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ========== QR CODE TYPES ==========
export interface QRCodeData {
  id: string;
  content: string;
  type: "product" | "order" | "customer";
  createdAt: Date;
}
