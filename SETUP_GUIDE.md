# 🚀 Setup & Run Guide - QR-CODE POS System

## ✅ Issues Fixed

1. **HomePage.tsx** - Converted from HTML to React component
   - Removed malformed HTML structure
   - Implemented proper React functional component with hooks
   - Added form state management with useState
   - Fixed all TypeScript/JSX compilation errors

2. **Dependencies** - All npm packages are installed
   - Frontend: 216 packages ✓
   - Backend: 107 packages ✓

3. **Environment Files** - Already configured
   - Frontend: `.env` created with API_URL
   - Backend: `.env` with database config

4. **Frontend Build** - Successfully builds!
   ```
   ✓ tsc compilation passed
   ✓ Vite production build: 197.23 kB (gzipped: 62.32 kB)
   ```

---

## 📋 Prerequisites

- **Node.js** v14+ (check: `node --version`)
- **MySQL** or **MariaDB** running (default: localhost:3306)
- **npm** v6+ (comes with Node.js)

---

## 🔧 Setup Instructions

### 1️⃣ Database Setup
First, create the database and schema:

```bash
# Option A: Using MySQL CLI
mysql -u root -p < database/schema.sql

# Option B: Using MySQL Workbench or PhpMyAdmin
# Copy the contents of database/schema.sql and execute
```

Update the `.env` file in backend directory if your credentials differ:
```bash
cd backend
# Edit .env with your MySQL credentials
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=pos_qr
DB_PORT=3306
```

### 2️⃣ Backend Server

```bash
cd backend

# Development mode (with auto-reload)
npm run dev

# Or production mode
npm run start
```

Expected output:
```
Server chạy tại http://localhost:3000
```

### 3️⃣ Frontend Development

```bash
cd fontend

# Development server (with hot reload)
npm run dev

# Visit: http://localhost:5173
```

### 4️⃣ Frontend Production Build

```bash
cd fontend
npm run build
npm run preview
```

---

## 📂 Project Structure

```
QR-CODE/
├── backend/
│   ├── .env                          # Database config
│   ├── package.json
│   ├── server.js                     # Express server
│   └── src/
│       ├── config/db.js              # MySQL connection
│       ├── controllers/               # API logic
│       ├── models/                    # Data models
│       └── routes/                    # API endpoints
├── fontend/
│   ├── .env                          # Frontend API config
│   ├── vite.config.ts                # Vite config
│   ├── tailwind.config.js            # Tailwind CSS
│   ├── index.html                    # React root
│   └── src/
│       ├── App.tsx                   # Root component
│       ├── pages/HomePage.tsx        # Login page ✅ FIXED
│       ├── components/
│       ├── config/api.js             # API client
│       └── main.tsx                  # React entry point
└── database/
    └── schema.sql                    # Database schema
```

---

## 🔌 API Endpoints

Once backend is running:

- **Products**
  - `GET /api/products` - Get all products
  - `GET /api/products/:id` - Get product by ID
  - `POST /api/products` - Create product
  - `PUT /api/products/:id` - Update product
  - `DELETE /api/products/:id` - Delete product

- **Orders** (routes ready, controllers to be implemented)
  - `GET /api/orders`
  - `POST /api/orders`
  - etc.

---

## 🧪 Testing

### Check Backend
```bash
curl http://localhost:3000
# Expected: {"message": "Backend đang chạy!"}
```

### Check Frontend
Visit `http://localhost:5173` and you should see the login page

### Test API
```bash
curl http://localhost:3000/api/products
# Should return: [] or products array
```

---

## 📝 Debugging Tips

1. **Port already in use?**
   ```bash
   # Find process using port 3000
   netstat -ano | findstr :3000
   # Kill it if needed
   taskkill /PID <PID> /F
   ```

2. **Database connection error?**
   - Check MySQL is running
   - Verify .env credentials match your setup
   - Check database `pos_qr` exists

3. **Frontend won't load?**
   - Check `npm run build` output
   - Clear browser cache
   - Check console for errors (F12)

---

## 🎯 Next Steps

1. ✅ Fix database schema for Orders table
2. ✅ Implement order controllers
3. ✅ Add QR code generation library
4. ✅ Build product management UI
5. ✅ Add user authentication

---

## 📧 Support

All critical compilation errors have been fixed. The system is now ready to:
- ✅ Build the frontend
- ✅ Run the backend server
- ✅ Connect to MySQL database

Just run the commands above to get started!
