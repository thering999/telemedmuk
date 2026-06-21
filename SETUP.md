# Telemedicine Dashboard - Setup Guide

## Quick Start

### Frontend (React + Vite)

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Visit http://localhost:5173
```

### Backend (Node.js + Express)

```bash
# Install dependencies
cd api
npm install

# Copy environment
cp .env.example .env

# Start dev server
npm run dev

# API runs on http://localhost:3000
```

## Database Setup (Optional - for production)

### Prerequisites
- Docker & Docker Compose
- PostgreSQL 16+

### Start PostgreSQL

```bash
docker-compose -f docker-compose.dev.yml up -d
```

Database credentials:
- User: `telemedmuk`
- Password: `telemedmuk_dev`
- Database: `telemedmuk`
- Host: `localhost:5432`

### Connect API to Database

1. Update `api/.env`:
```
DATABASE_URL=postgresql://telemedmuk:telemedmuk_dev@localhost:5432/telemedmuk
```

2. Add Prisma ORM (next step)

## Architecture

**Frontend:**
- React 19 + TypeScript
- Vite build tool
- Tailwind CSS
- Recharts for visualizations
- Toast notifications + Loading states

**Backend:**
- Node.js + Express
- TypeScript
- CORS enabled
- Health check endpoint

**Data Flow:**
```
Frontend (React)
    ↓
API Layer (Express)
    ↓
Database (PostgreSQL)
```

## Next Steps

1. **Add Prisma ORM**
   ```bash
   cd api
   npm install @prisma/client
   npx prisma init
   ```

2. **Define Database Schema**
   - Create `api/prisma/schema.prisma`
   - Define Snapshot, Facility, ServiceData models

3. **Wire API to Frontend**
   - Update data fetching in `src/lib/`
   - Replace mock data with API calls

4. **Deploy**
   - Frontend → Vercel / Netlify
   - Backend → Heroku / Railway / AWS

## Development Commands

```bash
# Frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Check code style
npm run preview      # Preview production build

# Backend
cd api
npm run dev          # Start dev server
npm run build        # Compile TypeScript
npm start            # Run compiled code
```

## Troubleshooting

**Port 5173 already in use?**
```bash
npx vite --host 0.0.0.0 --port 5174
```

**Port 3000 already in use?**
```bash
PORT=3001 npm run dev  # (in api directory)
```

**Docker issues?**
```bash
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```
