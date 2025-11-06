# Setup Guide - USDA AI Red Team Training

## Quick Start

### 1. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env  # Create if doesn't exist
# Edit .env and add:
# DATABASE_URL="postgresql://user:password@localhost:5432/usda_db"
# JWT_SECRET="your-secret-key-here"
# PORT=5000

# Set up database
npx prisma migrate dev --name init
npx prisma generate

# Start backend server
npm run dev
```

Backend will run on: **http://localhost:5000**

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start frontend dev server
npm run dev
```

Frontend will run on: **http://localhost:3000**

### 3. Access the Application

Open your browser and go to: **http://localhost:3000**

## Port Configuration

- **Frontend (Vite)**: Port 3000
- **Backend (Express)**: Port 5000
- **Database (PostgreSQL)**: Port 5432 (default)

## Troubleshooting

### Cannot access localhost:3000

1. **Check if frontend is running:**
   ```bash
   cd frontend
   npm run dev
   ```
   You should see: `Local: http://localhost:3000/`

2. **Check if port 3000 is already in use:**
   ```bash
   lsof -i :3000  # macOS/Linux
   netstat -ano | findstr :3000  # Windows
   ```
   If something is using port 3000, either:
   - Stop that process
   - Or change frontend port in `vite.config.ts`

### Backend not responding

1. **Check if backend is running:**
   ```bash
   cd backend
   npm run dev
   ```
   You should see: `API listening on :5000`

2. **Check backend port:**
   - Default is 5000 (can be changed via `PORT` env variable)
   - Make sure frontend API URL matches in `frontend/src/utils/api.ts`

### CORS Errors

If you see CORS errors in browser console:
- Make sure CORS middleware is enabled in backend (should be automatic)
- Check that backend is running on port 5000
- Check that frontend API base URL in `utils/api.ts` is correct

### Database Connection Issues

1. **Make sure PostgreSQL is running:**
   ```bash
   # macOS (with Homebrew)
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   
   # Docker
   docker-compose up -d
   ```

2. **Check DATABASE_URL in .env:**
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
   ```

3. **Run migrations:**
   ```bash
   cd backend
   npx prisma migrate dev
   ```

## Environment Variables

### Backend (.env)

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/usda_db"

# JWT Secret (generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server Port
PORT=5000

# Gemini API (optional, for other features)
GEMINI_API_KEY="your-key-here"
```

### Frontend (.env)

```env
# Backend API URL
VITE_API_BASE_URL="http://localhost:5000/api"
```

If not set, defaults to `http://localhost:5000/api`

## First Time Setup

1. **Start PostgreSQL database**
2. **Run backend migrations:**
   ```bash
   cd backend
   npx prisma migrate dev
   ```
3. **Start backend server:**
   ```bash
   npm run dev
   ```
4. **Start frontend server:**
   ```bash
   cd frontend
   npm run dev
   ```
5. **Open browser:** http://localhost:3000
6. **Sign up** with email/password to create your first account

## Common Issues

### Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find and kill process
lsof -ti:3000 | xargs kill  # macOS/Linux
# OR change port in vite.config.ts
```

### Module Not Found Errors

**Solution:**
```bash
# Reinstall dependencies
cd frontend && rm -rf node_modules package-lock.json && npm install
cd ../backend && rm -rf node_modules package-lock.json && npm install
```

### Database Migration Errors

**Solution:**
```bash
cd backend
npx prisma migrate reset  # WARNING: Deletes all data
npx prisma migrate dev
```

## Development Workflow

1. **Backend changes**: Restart backend server (auto-reload with nodemon)
2. **Frontend changes**: Hot reload (no restart needed)
3. **Database changes**: Run `npx prisma migrate dev` in backend folder

## Production Build

### Frontend
```bash
cd frontend
npm run build
# Output in: frontend/build/
```

### Backend
```bash
cd backend
npm start  # or use PM2, Docker, etc.
```

