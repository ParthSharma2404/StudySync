# StudySync 2.0 - Complete Project Documentation

Welcome to the comprehensive, in-depth documentation for **StudySync 2.0**. This document explains every single feature, technology, architecture decision, and database structure utilized in the project. If you want to understand how StudySync works from the ground up, this is the ultimate guide.

---

## 🌟 Executive Summary

StudySync is a **real-time, multiplayer virtual study platform**. Built to combat the isolation and distraction of studying alone, it acts as a virtual library. Users can join themed study rooms, see other students studying live alongside them, manage collaborative to-do lists, and track their productivity through a deeply gamified system featuring XP, Streaks, and Analytics.

---

## 🛠️ Technology Stack (In-Depth)

StudySync is a full-stack JavaScript application built with modern tooling:

### Frontend Architecture
- **Framework**: **React 18** powered by **Vite** for lightning-fast Hot Module Replacement (HMR) and optimized production builds.
- **Routing**: **React Router DOM v7** for seamless Single Page Application (SPA) navigation and route protection (checking for JWT tokens).
- **Styling**: Pure **Vanilla CSS** utilizing modern techniques like CSS Variables (Custom Properties), Flexbox/Grid layouts, and advanced glassmorphic UI design (blur filters, gradients). No heavy CSS frameworks were used, ensuring total custom control and high performance.
- **Data Visualization**: **Recharts** is used to render interactive, responsive SVG charts for the user's weekly study analytics.
- **Icons**: **Lucide React** provides clean, consistent SVG iconography.

### Backend Architecture
- **Environment**: **Node.js** running a stateful server.
- **Framework**: **Express.js (v5)** handling RESTful API routing, JSON body parsing, and serving the compiled static frontend files in production.
- **Real-Time Engine**: **Socket.io**. This is the backbone of the platform's multiplayer features. It handles persistent, bi-directional WebSocket connections between the browser and the server.
- **Authentication**: **JSON Web Tokens (JWT)** for stateless, secure authentication. Tokens are signed by the server and stored in the client's `localStorage`.
- **Security**: **bcryptjs** is used to salt and hash all user passwords before they are stored in the database.

### Database & Persistence
- **Engine**: **PostgreSQL**. A robust, fully relational database management system.
- **Driver**: **pg (node-postgres)** is used to establish a connection pool between the Node.js server and the PostgreSQL database.
- **Migrations**: Database tables are automatically generated on startup if they do not exist via raw SQL queries in `db.js`.

---

## 🗄️ Database Schema & Data Models

The PostgreSQL database is fully relational. Here is an in-depth breakdown of every table and what it does:

### 1. `users` Table
Stores all account information and gamification states.
- `id` (Primary Key): Unique UUID.
- `username` & `email`: Unique identifiers.
- `password_hash`: The bcrypt hashed password.
- `current_streak` & `longest_streak`: Tracks consecutive days studied.
- `last_active_date`: A timestamp string used to calculate if a streak should be incremented or reset upon login.
- `total_study_seconds`: Lifetime focus time.
- `xp`: Experience points earned by studying.

### 2. `rooms` Table
Stores the virtual study environments.
- `id` (Primary Key): Unique UUID.
- `name` & `description`: Metadata for the room.
- `creator_id`: Foreign Key linking to the user who created it.
- `passcode`: Optional field for private rooms.

### 3. `tasks` Table
Handles the collaborative and personal To-Do lists inside study rooms.
- `id` (Primary Key): Unique UUID.
- `room_id`: Foreign Key linking the task to a specific room.
- `owner_id`: Foreign Key linking to the creator of the task.
- `title`: The task description.
- `is_completed`: Boolean flag (0 or 1).
- `completed_by`: Foreign Key tracking *who* checked the task off.
- `time_spent_seconds`: Tracks exactly how long users worked on this specific task.

### 4. `study_sessions` Table
The core analytics ledger. Every time a user enters a room and studies, a session is recorded.
- `id` (Primary Key): Unique UUID.
- `user_id` & `room_id`: Links the user to the room.
- `start_time` & `end_time`: Timestamps to record the exact duration.
- `duration_seconds`: Calculated time spent in the room for charting.

### 5. `friendships` Table
Manages the social graph.
- `sender_id` & `receiver_id`: Links two users.
- `status`: String flag, either `'pending'` or `'accepted'`.

### 6. `user_badges` Table
The achievement system.
- `user_id` & `badge_id`: Composite Primary Key tracking which badges a user has unlocked.
- `awarded_at`: Timestamp of achievement.

---

## ⚙️ Core Features & Engineering Details

### 1. Real-Time Peer Presence (WebSockets)
When a user joins a room, `Socket.io` emits a `join_room` event. The server adds the user's socket to a specific Socket.io Room. The server then broadcasts a `room_users_update` event to everyone in that room, sending an array of all active participants. When a user disconnects, the server automatically detects it and broadcasts the updated list, ensuring you always know exactly who is studying with you.

### 2. Server-Synchronized Pomodoro Timer
Unlike typical timers that run locally in the browser (which easily fall out of sync), StudySync's timer runs centrally on the **Node.js server** using `setInterval`. Every single second, the server calculates the remaining time and broadcasts a `timer_update` event containing the `time_remaining`, `mode` (Focus vs Break), and `isRunning` state to all clients in the room. This ensures every student is perfectly synced to the exact same millisecond.

### 3. Gamification Engine (XP & Streaks)
- **XP**: As the server-side timer ticks down during a "Focus" session, the backend continuously updates the database, granting the user XP and incrementing their `total_study_seconds`. 
- **Streaks**: When a user logs in, the backend compares the current date to their `last_active_date`. If it's the next consecutive day, `current_streak` increments. If a day was missed, it resets to 1. If it breaks their `longest_streak` record, that is updated too.

### 4. Collaborative Task Synchronization
Inside a study room, the To-Do list is collaborative. When User A adds a task, an API request is made to the database, and immediately upon success, the server emits a `task_added` WebSocket event. User B's screen instantly updates with the new task without needing to refresh the page. This applies to completing and deleting tasks as well.

### 5. Weekly Analytics
The `study_sessions` table acts as a raw ledger. On the Dashboard, the backend aggregates this data using the PostgreSQL `TO_CHAR(start_time, 'YYYY-MM-DD')` function to group all sessions by day for the past 7 days. This aggregated data is fed into the frontend `Recharts` library to render a beautiful, interactive bar chart of the user's weekly productivity.

---

## 🚀 Deployment & Infrastructure Guide

The project is fully configured to be deployed on **Render.com**.

### Render Configuration
1. **Managed PostgreSQL Database**: Provisioned on Render. The internal connection string is utilized for hyper-fast, secure communication between the DB and the Web Service.
2. **Web Service**: The Node.js application is deployed as a single unified service.

### The Build Process
The root directory contains a master `package.json` with a `postinstall` script:
```json
"postinstall": "cd frontend && npm install && npm run build"
```
When Render deploys the app:
1. It installs the root and backend dependencies.
2. It automatically navigates into the `frontend` folder, installs Vite/React dependencies, and compiles the React app into optimized static files located in `frontend/dist`.

### Express Static Serving
In production, the Express backend serves as both the API and the web server. It catches all non-API requests and serves the compiled React app:
```javascript
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.resolve(__dirname, '../frontend/dist', 'index.html'));
});
```
This elegantly handles React Router's client-side routing.

### Environment Variables
For the app to function in production, the following variables must be set in the Render environment:
- `NODE_ENV`: Set to `production` (Triggers static file serving).
- `DATABASE_URL`: The PostgreSQL connection string.
- `JWT_SECRET`: A secure, random string used to sign authentication tokens.

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
   Create a `.env` file inside the `/backend` folder:
   ```env
   PORT=5000
   DATABASE_URL=postgresql://your_db_user:your_db_password@localhost:5432/your_local_db_name
   JWT_SECRET=development_secret_key
   NODE_ENV=development
   ```

4. **Run the Application**
   - Terminal 1 (Backend): `node server.js`
   - Terminal 2 (Frontend): `npm run dev`
   - Open `http://localhost:5173` in your browser.

---

*This concludes the complete technical documentation for StudySync 2.0. Every component, from the database schema down to the WebSockets and CSS styling, was purposefully engineered to create a fast, real-time, and deeply engaging user experience.*
