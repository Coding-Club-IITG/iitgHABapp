# HABit Landing Page

Public-facing website and login portal for the IIT Guwahati Hostel Affairs Board platform. Serves as the first point of contact for students and visitors.

**Stack:** React 19, Vite 6, Tailwind CSS 4

## Setup

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Runs on `http://localhost:5172`.

## Build

```bash
pnpm build
```

## Environment Variables

| Variable          | Default                     | Description          |
| ----------------- | --------------------------- | -------------------- |
| `VITE_SERVER_URL` | `http://localhost:3000/api` | Backend API base URL |

## Pages

| Route         | Page                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `/`           | Home: hero carousel, app download buttons, live stats, hostel showcase |
| `/forms`      | Online forms for hostel services                                       |
| `/hostels`    | Public hostel information listing                                      |
| `/privacy`    | Privacy policy                                                         |
| `/contact`    | Contact and support                                                    |
| `/bug-report` | Bug report submission form                                             |
