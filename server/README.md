# HABit Backend Server

Node.js/Express backend for the IIT Guwahati Hostel Affairs Board platform. Consists of a **gateway** that routes requests to one of two API servers based on the `x-api-version` header.

## Architecture

```
Gateway (port 3000)
├── x-api-version: v1  →  API v1 (port 3001)  — Latest API (21 modules)
└── x-api-version: v2  →  API v2 (port 3002)  — Legacy API (19 modules + Agenda schedulers)

Background processes:
├── hab-worker-logger-v1  — Log processing worker
└── hab-worker-agenda-v1  — Job scheduler (auto-feedback, auto-rebate, etc.)
```

## Prerequisites

- **Node.js** 18+
- **MongoDB** (with replica set for transactions)
- **Redis**
- **PostgreSQL** (optional, only for Agenda if using PG backend)
- **PM2** (for production): `npm install -g pm2`

## Setup

### 1. Clone and install dependencies

```bash
cd server
pnpm install
cd v1 && pnpm install && cd ..
cd v2 && pnpm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials — see [Environment Variables](#environment-variables) below.

### 3. Start dependencies

Ensure MongoDB, Redis, and (optionally) PostgreSQL are running.

## Running

### Development (with auto-reload)

```bash
pnpm dev
```

Runs gateway, v1, and v2 concurrently with `nodemon`.

### Production (with PM2)

```bash
pnpm start
```

Starts 5 PM2 processes:

- `hab-gateway` — Reverse proxy (port 3000)
- `hab-api-v1` — API v1 server (port 3001)
- `hab-api-v2` — API v2 server (port 3002)
- `hab-worker-logger-v1` — Logger worker
- `hab-worker-agenda-v1` — Agenda scheduler

## Project Structure

```
server/
├── index.js                 # Gateway — reverse proxy
├── ecosystem.config.cjs     # PM2 process configuration
├── processHandlers.js       # Crash handlers (uncaught exceptions)
├── VERSIONING.md            # API versioning strategy guide
├── modules/                 # Shared modules
│   ├── app_version/         # App version enforcement for all 3 Flutter apps
│   ├── google_login/        # Google OAuth
│   └── notification/        # FCM push notifications
├── v1/                      # API v1 (latest)
│   ├── index.js             # Express server entry
│   ├── config/              # App version config, DB config
│   ├── modules/             # Route modules (auth, hostel, mess, etc.)
│   ├── utils/               # Delegated Graph auth helpers
│   ├── workers/             # Logger + Agenda workers
│   └── models/              # Mongoose schemas
├── v2/                      # API v2 (legacy)
│   └── (same structure as v1)
├── scripts/
│   ├── migrate.js           # DB migration script
│   └── check_schema.js      # Schema validation
├── test/
│   └── docker-compose.yml   # Test infrastructure containers
└── uploads/                 # Uploaded files (dev)
```

### API v1 Modules

| Route                | Module        | Purpose                                    |
| -------------------- | ------------- | ------------------------------------------ |
| `/api/auth`          | auth          | Login, OAuth (Microsoft + Google), session |
| `/api/users`         | user          | User CRUD, anonymized init                 |
| `/api/hostel`        | hostel        | Hostel CRUD, SMC/HMC, boarders             |
| `/api/mess`          | mess          | Mess CRUD, menu, scan logs, WebSocket      |
| `/api/feedback`      | feedback      | Meal feedback, leaderboard, OPI reports    |
| `/api/notification`  | notification  | Push via FCM, alerts with TTL              |
| `/api/leave`         | leave         | Mess rebate, station leave, OneDrive PDF   |
| `/api/mess-change`   | mess_change   | Mess change applications, allotment        |
| `/api/room-cleaning` | room_cleaning | Bookings, cleaners, auto-resolve           |
| `/api/laundry`       | laundry       | QR codes, usage logs, stats                |
| `/api/gala`          | gala          | Dinner scheduling, menu, WebSocket         |
| `/api/summer-mess`   | summer_mess   | Registration, season management            |
| `/api/festival-mode` | festival_mode | Theme toggle, auto-disable                 |
| `/api/profile`       | profile       | User profile settings                      |
| `/api/logs`          | logs          | Scan logs                                  |
| `/api/bug-report`    | bug_report    | Bug submissions                            |
| `/api/app`           | app           | Bootstrap data                             |
| `/api/docs`          | swagger       | API documentation UI                       |
| `/api/_debug`        | debug         | Dev endpoints                              |

### Firebase (push notifications)

Place your Firebase service account key at `v1/config/firebaseServiceAccountKey.json`.

## API Versioning

The gateway routes based on the `x-api-version` header:

- `x-api-version: v2` → routes to v2 (port 3002)
- No header or `x-api-version: v1` → routes to v1 (port 3001)

The Flutter apps auto-detect which version to use by comparing their major version against the server's latest published version. See `VERSIONING.md` for the full strategy.

## Real-time (WebSocket)

- **Mess scanning**: WebSocket server broadcasts QR scan events to connected HABit HQ (mess manager) apps
- **Gala dinner scanning**: WebSocket server broadcasts gala QR scan events
- **Redis Pub/Sub**: Bridges API processes with WebSocket servers for scan broadcast distribution
