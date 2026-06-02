# Hostel Office Panel

Dashboard for hostel wardens and office staff to manage boarders, mess subscribers, SMC/HMC committees, room cleaners, laundry, bills, and mess workers.

**Stack:** React 19, Vite 6, Tailwind CSS 4, Ant Design 5, Radix UI

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Runs on `http://localhost:5174/hostel/`.

## Build

```bash
pnpm build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SERVER_URL` | `http://localhost:3000/api` | Backend API base URL |
| `VITE_BASE` | `/hostel` | Router base path |

## Features

- **Boarders** — searchable directory with PDF export
- **Mess** — live and historical subscriber snapshots
- **SMC Management** — assign/remove SMC members
- **HMC Management** — committee roster with 9 secretary positions
- **Room Cleaners** — CRUD with slot assignment (A/B/C/D)
- **Laundry** — QR code display, monthly stats, usage logs
- **Bill** — mess bill calculator per month
- **Mess Workers** — CRUD with designation and wage rate
