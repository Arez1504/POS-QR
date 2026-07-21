/**
 * File này dùng để ôn tập TypeScript - Bạn có thể xóa sau khi học xong
 */

// @ts-nocheck

// ========== 1. BIẾN VÀ KIỂU DỮ LIỆU ==========
const name: string = "Nguyễn Văn A";        // String
const age: number = 25;                     // Number
const isActive: boolean = true;             // Boolean

// TypeScript tự suy luận kiểu (type inference)
const city = "Hà Nội";  // tự động suy ra là string

// ========== 2. ARRAYS ==========
const numbers: number[] = [1, 2, 3, 4, 5];
const names: Array<string> = ["A", "B", "C"];
const mixed: (string | number)[] = [1, "hello", 2];

// ========== 3. OBJECTS & INTERFACES ==========
interface User {
  id: number;
  name: string;
  email: string;
  age?: number;  // ? = optional (có hoặc không)
}

const user: User = {
  id: 1,
  name: "Nguyễn A",
  email: "a@gmail.com",
  age: 25
};

// ========== 4. FUNCTIONS ==========
// Function với kiểu parameters và return type
function greet(name: string, age: number): string {
  return `Xin chào ${name}, bạn ${age} tuổi`;
}

// Arrow function
const multiply = (a: number, b: number): number => a * b;

// Function không return gì (void)
const logMessage = (msg: string): void => {
  console.log(msg);
};

// ========== 5. UNION TYPES ==========
type Status = "pending" | "success" | "error";

const orderStatus: Status = "pending";
// orderStatus = "invalid";  // ❌ Lỗi! Chỉ được dùng: pending, success, error

// ========== 6. GENERICS (Kiểu tổng quát) ==========
function getFirstItem<T>(items: T[]): T {
  return items[0];
}

const firstNum = getFirstItem([1, 2, 3]);      // number
const firstStr = getFirstItem(["a", "b"]);    // string

// ========== 7. CLASSES ==========
class Product {
  id: number;
  name: string;
  price: number;

  constructor(id: number, name: string, price: number) {
    this.id = id;
    this.name = name;
    this.price = price;
  }

  getInfo(): string {
    return `${this.name} - ${this.price}đ`;
  }
}

const product = new Product(1, "Laptop", 10000000);
console.log(product.getInfo());

// ========== 8. UNION TYPES THAY CHO ENUM ==========
type Color = "RED" | "GREEN" | "BLUE";

const myColor: Color = "RED";

// ========== BƯỚC TIẾP THEO ==========
// Bạn có thể chạy: npm run dev
// Sau đó mở DevTools > Console để xem output
// hoặc tạo file .ts khác và import vào main.tsx

export { greet, multiply };
export type { User, Color };
export { Product };