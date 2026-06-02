<div align="center">
   <img src="./readme-assets/habit-header.svg">
</div>

<h1 align="center">HABit IITG</h1>

<p align="center">
   IIT Guwahati's unified campus-life platform
</p>

<div align="center"> 
   <img src="./readme-assets/habit-ad.jpg">
</div>

<div align="center">
  <a href="https://play.google.com/store/apps/details?id=in.codingclub.hab"><img src="./readme-assets/playstore.svg" alt="Get it on Google Play"></a>
  <a href="https://apps.apple.com/us/app/habit-iitg/id6740746036"><img src="./readme-assets/appstore.svg" alt="Download on the App Store"></a>
</div>

A unified ecosystem powering complaints, mess management, room cleaning, laundry services, gala dinners, leave requests, rebates, notifications, and administrative workflows across the entire IIT Guwahati hostel network.

Built collaboratively by the [Hostel Affairs Board (HAB)](https://hab.codingclub.in) and [Coding Club, IIT Guwahati](https://codingclub.in), the platform serves students, wardens, mess managers, hostel administrations, and governing bodies through a collection of mobile apps, web dashboards, and backend services.

## Features

- **Complaint management** with multi-stage approval workflows
- **QR-based mess authentication** and meal tracking
- **Mess change, rebate, and summer mess automation**
- **Room cleaning** scheduling and workforce management
- **Laundry** registration and tracking
- **Gala Dinner** registrations and QR validation
- **Leave applications** and hostel service feedback
- **Real-time notifications** and live updates
- Dedicated dashboards for HAB, SMC, wardens, caterers, and administrators

## Screenshots

<div align="center">Mobile App screens</div>
<img src="./readme-assets/screenshots.jpg" alt="App screens showing the mobile interface">

<div align="center">HAB Dashboard panel</div>
<img src="./readme-assets/hab-dash.jpeg" alt="HAB Dashboard showing the administrative panel">

## System Architecture

```mermaid
graph LR

%% ===== STYLES =====
classDef mobile fill:#dbeafe,stroke:#2563eb,stroke-width:2px,color:#000000
classDef web fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#000000
classDef gateway fill:#c7d2fe,stroke:#4338ca,stroke-width:3px,color:#000000
classDef api fill:#d1fae5,stroke:#059669,stroke-width:2px,color:#000000
classDef apiOld fill:#fce7f3,stroke:#db2777,stroke-width:2px,color:#000000
classDef service fill:#ede9fe,stroke:#7c3aed,stroke-width:2px,color:#000000
classDef db fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#000000
classDef ext fill:#ecfdf5,stroke:#16a34a,stroke-width:2px,color:#000000
%% ===== CLIENTS =====
subgraph Clients["Client Applications"]

    subgraph Mobile["📱 Mobile Apps"]
        direction TB
        SA["HABit<br/>Student App"]:::mobile
        HQ["HABit HQ<br/>Mess Manager"]:::mobile
        RC["HABit RC<br/>Room Cleaning"]:::mobile
    end

    subgraph Web["🖥️ Web Dashboards"]
        direction TB
        HAB["HAB Admin Panel"]:::web
        HTL["Hostel Office Panel"]:::web
        SMC["SMC Panel"]:::web
        LND["Landing Page"]:::web
    end

end

%% ===== GATEWAY =====
GW["🌐 API Gateway<br/>Version Routing"]:::gateway

%% ===== APIS =====
subgraph Backend["Backend Services"]
direction TB

V1["🆕 API v1<br/>Latest<br/>21 Modules"]:::api
V2["🔄 API v2<br/>Legacy<br/>19 Modules"]:::apiOld

end

%% ===== PLATFORM =====
SERV["🔧 Shared Platform Services<br/>WebSockets • Agenda • Logging<br/>Notifications • Version Enforcement"]:::service

%% ===== DATA =====
DATA["🗄️ Data Layer<br/>MongoDB Atlas • Redis • PostgreSQL"]:::db

%% ===== EXTERNAL =====
EXT["☁️ External Services<br/>Microsoft OAuth (Azure AD)<br/>Firebase FCM • Cloudinary<br/>OneDrive • AWS S3"]:::ext

%% ===== FLOWS =====
SA --> GW
HQ --> GW
RC --> GW

HAB --> GW
HTL --> GW
SMC --> GW
LND --> GW

GW -->|"x-api-version: v1"| V1
GW -->|"x-api-version: v2"| V2

V1 --> SERV
V2 --> SERV

V1 --> DATA
V2 --> DATA

V1 --> EXT
V2 --> EXT
```

<p align="center">
    <img src="https://img.shields.io/badge/Flutter-%2302569B.svg?style=for-the-badge&logo=Flutter&logoColor=white" alt="Flutter"/>
    <img src="https://img.shields.io/badge/dart-%230175C2.svg?style=for-the-badge&logo=dart&logoColor=white" alt="Dart"/>
    <img src="https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React"/>
    <img src="https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS"/>
    <img src="https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
    <img src="https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="NodeJS"/>
    <img src="https://img.shields.io/badge/express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express.js"/>
    <img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB"/>
    <img src="https://img.shields.io/badge/redis-%23DD0031.svg?style=for-the-badge&logo=redis&logoColor=white" alt="Redis"/>
    <img src="https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white" alt="Postgres"/>
    <img src="https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white" alt="AWS"/>
    <img src="https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white" alt="Docker"/>
</p>

HABit follows a versioned service-oriented architecture designed to support multiple client applications while maintaining backward compatibility with legacy systems.

### Client Applications

The platform consists of seven frontend applications:

**Mobile Applications**: Built with Flutter 3.x + Dart.

- **HABit**: Student-facing application for hostel services and daily operations.
- **HABit HQ**: Mess management and dining operations.
- **HABit RC**: Room cleaning and maintenance workflows.

**Web Dashboards**: Built with React 19, Vite 6, Tailwind CSS 4, and Ant Design 5.

- **HAB Admin Panel**: Central administration and platform management.
- **Hostel Office Panel**: Hostel administration and resident management.
- **SMC Panel**: Student Mess Committee operations and oversight.
- **Landing Page**: Public-facing website and platform information.

### API Gateway

All client requests are routed through a centralized API Gateway built with Express 5. The gateway determines the appropriate backend service using the `x-api-version` header, allowing multiple API versions to coexist without impacting client applications.

### Backend Services

The backend currently maintains two Node.js 18+ / Express 5 API versions:

- **API v1**: The latest actively developed backend containing new features and improvements.
- **API v2**: Legacy backend retained for backward compatibility with existing clients and workflows.

This versioned approach enables gradual migration of features while ensuring uninterrupted service availability.

### Data Layer

The platform uses a persistence model backed by three databases:

- **MongoDB Atlas** serves as the primary operational database.
- **Redis** provides caching and real-time Pub/Sub messaging.
- **PostgreSQL** powers background job scheduling and queue management.

### External Integrations

HABit integrates with several third-party services:

- **Microsoft OAuth (Azure AD)** for authentication and identity management.
- **Firebase Cloud Messaging (FCM)** for push notifications.
- **Cloudinary** for image storage and media processing.
- **OneDrive** and **AWS S3** for file storage and asset management.

## Setup

### Prerequisites

- Node.js 18+
- Flutter 3.x
- pnpm (for web frontends)
- MongoDB (replica set), Redis, PostgreSQL

### 1. Backend Server

The server must be running before any frontend can connect.

```bash
cd server
cp .env.example .env   # configure your environment variables
pnpm install
pnpm dev
```

> [!NOTE]
> See `server/README.md` for detailed setup instructions including PM2 production deployment, environment variables reference, and API versioning.

### 2. Login Portal (Landing Page)

The login portal must be set up before any web dashboard.

```bash
cd login-frontend
pnpm install && pnpm dev        # localhost:5172/
```

### 3. Web Dashboards

Once the server and login portal are running, set up the admin dashboards:

```bash
# HAB Admin Panel
cd hab-frontend
pnpm install && pnpm dev       # localhost:5173/hab/

# Hostel Office Panel
cd hostel-frontend
pnpm install && pnpm dev       # localhost:5174/hostel/

# SMC Panel
cd smc-frontend
pnpm install && pnpm dev       # localhost:5175/smc/
```

### 4. Mobile Apps (Flutter)

```bash
# Student App
cd frontend2
flutter pub get && flutter run

# Mess Manager App
cd mess_frontend
flutter pub get && flutter run

# Room Cleaning App
cd rc_frontend
flutter pub get && flutter run
```

> [!NOTE]
> See the individual READMEs for platform-specific build instructions and API endpoint configuration.

## Workflow & Deployment

We follow a specific branching strategy to ensure stability:

- **`dev` Branch**: This is the active development branch. **All code changes, features, and fixes must be committed here.** Please create Pull Requests (PRs) against the `dev` branch.
- **`prod` Branch**: This branch is strictly for **production server deployment**. It reflects the live state of the application.

> [!CAUTION]
> Do not commit directly to `prod`. Changes are merged from `dev` to `prod` only when ready for release.

---

## License

IIT Guwahati © 2026 Hostel Affairs Board
