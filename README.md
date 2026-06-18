# StudySync 2.0 - Complete Project Documentation

Welcome to the comprehensive, in-depth documentation for **StudySync 2.0**. This document explains every single feature, technology, architecture decision, and database structure utilized in the project. If you want to understand how StudySync works from the ground up, this is the ultimate guide.

---

## 🌟 Executive Summary

StudySync is a **real-time, multiplayer virtual study platform**. Built to combat the isolation and distraction of studying alone, it acts as a virtual library. Users can join themed study rooms, see and hear other students studying live alongside them (via LiveKit), manage collaborative to-do lists, and track their productivity through a deeply gamified system featuring Progressive RPG Leveling, True Study Streaks, and Global Leaderboards.

---

## 🛠️ Technology Stack (In-Depth)

StudySync is a full-stack JavaScript application built with modern tooling:

### Frontend Architecture
- **Framework**: **React 18** powered by **Vite** for lightning-fast Hot Module Replacement (HMR) and optimized production builds.
- **Routing**: **React Router DOM v7** for seamless Single Page Application (SPA) navigation and route protection (checking for JWT tokens).
- **Styling**: Pure **Vanilla CSS** utilizing modern techniques like CSS Variables, Grid/Bento layouts, and advanced glassmorphic UI design.
- **Live Video & Audio**: **LiveKit Components** provides high-performance, WebRTC-based SFU routing for real-time peer-to-peer communication.
- **Data Visualization**: **Recharts** is used to render interactive, responsive SVG charts for the user's weekly study analytics.
- **Icons**: **Lucide React** provides clean, consistent SVG iconography.

### Backend Architecture
- **Environment**: **Node.js** running a stateful server.
- **Framework**: **Express.js (v5)** handling RESTful API routing, JSON body parsing, and serving the compiled static frontend files in production.
- **Real-Time Engine (Data)**: **Socket.io**. Handles persistent, bi-directional WebSocket connections for synchronized timers, tasks, and XP heartbeats.
- **Real-Time Engine (Media)**: **LiveKit Server SDK**. Generates secure access tokens to route client media streams without storing any video or audio data.
- **Authentication**: **JSON Web Tokens (JWT)** for stateless, secure authentication.
- **Security**: **bcryptjs** is used to salt and hash all user passwords.

### Database & Persistence
- **Engine**: **PostgreSQL**. A robust, fully relational database management system.
- **Driver**: **pg (node-postgres)** is used to establish a connection pool.
- **Migrations**: Database tables are automatically generated on startup via raw SQL queries in `db.js`.

---

## 🗄️ Database Schema & Data Models

### 1. `users` Table
Stores all account information and gamification states.
- `id` (Primary Key): Unique UUID.
- `username` & `email`: Unique identifiers.
- `password_hash`: The bcrypt hashed password.
- `current_streak` & `longest_streak`: Tracks consecutive days of **active studying**.
- `last_active_date`: A timestamp used by the timer-heartbeat to calculate if a study streak should be incremented or reset.
- `total_study_seconds`: Lifetime focus time.
- `xp`: Experience points earned by studying.
- `level`: The current RPG rank of the user (calculated dynamically based on XP).

### 2. `rooms` Table
Stores the virtual study environments.
- `id` (Primary Key): Unique UUID.
- `name` & `description`: Metadata for the room.
- `creator_id`: Foreign Key linking to the user who created it.
- `passcode`: Optional field for private rooms.

### 3. `tasks` Table
Handles the collaborative To-Do lists inside study rooms.
- `id`, `room_id`, `owner_id`, `title`, `is_completed`, `completed_by`.

### 4. `study_sessions` Table
The core analytics ledger.
- `id`, `user_id`, `room_id`, `start_time`, `end_time`, `duration_seconds`.

---

## ⚙️ Core Features & Engineering Details

### 1. LiveKit Video & Audio Streaming
Study rooms feature embedded video and audio communication. Instead of pure P2P (which degrades with many users), we use an SFU (Selective Forwarding Unit) via **LiveKit**. The backend securely generates an Access Token for the user, allowing them to publish and subscribe to media tracks securely without any media touching our PostgreSQL database.

### 2. Server-Synchronized Pomodoro Timer
Unlike typical timers that run locally in the browser, StudySync's timer runs centrally on the **Node.js server** using `setInterval`. Every second, the server broadcasts a `timer_update` event containing the `time_remaining`, ensuring every student is perfectly synced to the exact millisecond.

### 3. Deep Gamification Engine (RPG Leveling & Streaks)
- **Progressive Leveling**: Users earn XP continuously while studying. Leveling up requires exponentially more XP per rank (e.g., Level 2 requires 100XP, Level 3 requires 150XP, Level 4 requires 200XP).
- **True Study Streaks**: Streaks are *not* tied to logging in. Instead, the backend listens for a `timer-heartbeat` via WebSockets. Only when a user actively studies for 1 minute on a new day does their streak increment, ensuring streaks represent true effort.
- **Global Leaderboards**: Users are ranked continuously based on their XP, with the #1 ranked user receiving a unique "Champion" highlighter in the UI.

### 4. Zen Mode Environments
Users can toggle "Zen Mode" inside study rooms, which replaces the standard UI background with immersive, high-quality pixel-art lo-fi backgrounds to induce deep focus.

### 5. Weekly Analytics
The `study_sessions` table acts as a raw ledger. On the Dashboard, the backend aggregates this data using the PostgreSQL `TO_CHAR` function to group sessions by day for the past 7 days, feeding into `Recharts` for interactive bar charts.

---

## 🚀 Deployment & Infrastructure Guide

The project is fully configured to be deployed on **Render.com**.

### Render Configuration
1. **Managed PostgreSQL Database**: Provisioned on Render.
2. **Web Service**: The Node.js application is deployed as a single unified service.

### The Build Process
The root directory contains a master `package.json` with a `postinstall` script:
```json
"postinstall": "cd frontend && npm install && npm run build"
```
When Render deploys the app, it automatically compiles the React app into static files located in `frontend/dist`. The Express backend catches all non-API requests and serves the compiled React app.

### Environment Variables (Production)
- `NODE_ENV`: Set to `production`.
- `DATABASE_URL`: The PostgreSQL connection string.
- `JWT_SECRET`: A secure string for auth tokens.
- `LIVEKIT_API_KEY`: Key from LiveKit Cloud.
- `LIVEKIT_API_SECRET`: Secret from LiveKit Cloud.
- `LIVEKIT_WS_URL`: WebSocket URL from LiveKit Cloud.

---

## 💻 Local Developer Setup

If you want to run or modify StudySync locally, follow these steps:

1. **Clone the Repo**
   ```bash
   git clone https://github.com/ParthSharma2404/StudySync.git
   cd StudySync
   ```

2. **Install Dependencies**
   Open two terminal windows.
   - Terminal 1 (Backend): `cd backend && npm install`
   - Terminal 2 (Frontend): `cd frontend && npm install`

3. **Configure Environment**
   Create a `.env` file in the root folder (or backend folder depending on your setup) with your credentials:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://your_db_user:your_db_password@localhost:5432/your_local_db_name
   JWT_SECRET=development_secret_key
   LIVEKIT_API_KEY=your_dev_key
   LIVEKIT_API_SECRET=your_dev_secret
   LIVEKIT_WS_URL=wss://your-livekit-project.livekit.cloud
   NODE_ENV=development
   ```

4. **Run the Application**
   - Terminal 1 (Backend): `node server.js` (or `npm start` / `nodemon server.js`)
   - Terminal 2 (Frontend): `npm run dev`
   - Open `http://localhost:5173` in your browser.

---

*This concludes the complete technical documentation for StudySync 2.0. Every component, from the database schema down to the WebSockets and CSS styling, was purposefully engineered to create a fast, real-time, and deeply engaging user experience.*
