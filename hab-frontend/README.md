# HAB Admin Panel

Central administration dashboard for the Hostel Affairs Board. Manages hostels, caterers, students, mess changes, gala dinners, billing, notifications, summer mess, and festival mode.

**Stack:** React 19, Vite 6, Tailwind CSS 4, Ant Design 5

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Runs on `http://localhost:5173/hab/`.

## Build

```bash
pnpm build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SERVER_URL` | `http://localhost:3000/api` | Backend API base URL |
| `VITE_BASE` | `/hab` | Router base path |

## Features

- Dashboard with per-meal scan statistics and hostel rankings
- Hostel CRUD with caterer assignment
- Mess/Caterer CRUD and menu management
- Student list with CSV bulk hostel allocation
- Mess change application processing (approve/reject)
- Gala dinner scheduling and scan log export
- Monthly bill generation (Excel download)
- Push notification dispatch with alert TTL
- Festival mode configuration (theme, overlay, images)
- Summer mess season management
- Feedback window control and leaderboard
