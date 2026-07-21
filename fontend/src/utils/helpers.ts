/**
 * src/utils/helpers.ts
 * Chứa các utility functions dùng chung
 */

/**
 * Format tiền tệ VND
 * @example formatCurrency(1000000) => "1,000,000đ"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format ngày tháng
 * @example formatDate(new Date()) => "01/06/2026"
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(date));
}

/**
 * Format thời gian đầy đủ
 * @example formatDateTime(new Date()) => "01/06/2026 14:30:45"
 */
export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

/**
 * Delay execution (dùng cho loading, demo)
 * @example await delay(1000); // chờ 1 giây
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Kiểm tra email hợp lệ
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Cắt string dài
 * @example truncate("Hello World", 5) => "He..."
 */
export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + "...";
}

/**
 * Loại bỏ duplicates trong array
 * @example removeDuplicates([1, 2, 2, 3, 3, 3]) => [1, 2, 3]
 */
export function removeDuplicates<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Deep clone object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Sleep/delay for async operations
 * @example await sleep(2000);
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
