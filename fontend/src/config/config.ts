/**
 * src/config/config.ts
 * Chứa tất cả cấu hình của app
 */

// API configuration
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) return envUrl;
  return '/api';
};

export const API_BASE_URL = getApiUrl();

export const API_TIMEOUT = 30000; // 30 seconds

// App information
export const APP_NAME = "POS-QR";
export const APP_VERSION = "1.0.0";

// Feature flags
export const FEATURES = {
  QR_SCANNER: true,
  PAYMENT_GATEWAY: true,
  REPORT_EXPORT: false,
  AI_ASSISTANT: false,
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100,
};

// Bank configuration for VietQR payment
export const BANK_CONFIG = {
  BANK_ID: import.meta.env.VITE_BANK_ID || "MSB",
  ACCOUNT_NO: import.meta.env.VITE_BANK_ACCOUNT || "37201019953134",
  ACCOUNT_NAME: import.meta.env.VITE_BANK_NAME || "DANG DINH DUC DO",
  TEMPLATE: "compact2", // compact, compact2, qr_only, print
};

console.log(`✅ App initialized: ${APP_NAME} v${APP_VERSION}`);
