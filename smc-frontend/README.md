# SMC Panel

Student Mess Council administration dashboard for managing mess menus, meal timings, notifications, and gala dinner events.

**Stack:** React 19, Vite 6, Tailwind CSS 4, Ant Design 5, Radix UI

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Runs on `http://localhost:5175/smc/`.

## Build

```bash
pnpm build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000/api` | Backend API base URL |
| `VITE_BASE` | `/smc` | Router base path |

## Features

- **Menu Management** — weekly menu CRUD for all 7 days per meal (Breakfast/Lunch/Dinner), timings, categories, drag-to-reorder, PDF download
- **Gala Dinner** — menu management per course (Starters/Main Course/Desserts), PDF download
- **Notifications** — push notification dispatch to boarders or subscribers with alert TTL
