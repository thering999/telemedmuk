# Telemedicine API

Backend API for the Telemedicine Dashboard.

## Setup

```bash
cd api
npm install
cp .env.example .env
```

## Development

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Next Steps

1. **Database Setup**
   - Install PostgreSQL
   - Create database: `telemedmuk`
   - Connect via `DATABASE_URL` in `.env`

2. **Schema & Migrations**
   - Define tables: `snapshots`, `facilities`, `service_data`
   - Use Prisma ORM for type safety

3. **API Endpoints to Implement**
   - `GET /api/snapshots` — list all snapshots
   - `GET /api/snapshots/:date` — fetch specific snapshot
   - `POST /api/snapshots/import` — upload Excel file
   - `GET /api/facilities` — list all facilities
   - `GET /api/analytics/:facility_id` — get analytics for facility

4. **Frontend Integration**
   - Update `src/lib/useFilteredData.ts` to call API instead of static data
   - Set `API_BASE_URL` environment variable

## Architecture

```
telemedmuk/
├── src/          (React frontend)
├── api/          (Express backend)
│   ├── server.ts (main server)
│   └── routes/   (API endpoints)
└── data/         (Static data for now)
```
