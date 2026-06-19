# StudySync 2.0 - Comprehensive Project Documentation

## 🌟 1. Project Overview: What is StudySync?
StudySync is a **real-time, multiplayer virtual study platform** designed to combat the isolation, distraction, and lack of motivation often experienced when studying alone. Functioning as a "virtual library," it allows users to join themed study rooms, see and hear peers studying alongside them, and track their productivity. 

By combining collaborative productivity tools (like shared to-do lists and synchronized timers) with deep gamification (RPG-style leveling, study streaks, and global leaderboards), StudySync transforms the solitary act of studying into an engaging, community-driven habit.

---

## 🛠️ 2. Technology Stack
StudySync is built as a full-stack JavaScript application using modern, high-performance tooling:

### Frontend
* **Framework**: **React 18** (powered by **Vite** for fast HMR and optimized builds).
* **Routing**: **React Router DOM v7** for Single Page Application (SPA) navigation and protected routes.
* **Styling**: **Vanilla CSS** employing modern design techniques (CSS Variables, Grid/Bento layouts, glassmorphism, and dynamic animations). 
* **Real-Time Media**: **LiveKit Components React** for WebRTC-based SFU routing (Selective Forwarding Unit) handling peer-to-peer video and audio.
* **Real-Time Data**: **Socket.io-client** for real-time state synchronization (timers, tasks, online status).
* **Icons & UI**: **Lucide React** for consistent SVG iconography.

### Backend
* **Runtime**: **Node.js** running a stateful server environment.
* **Framework**: **Express.js (v5)** handling RESTful API routing, JSON body parsing, and static file serving.
* **Real-Time Engine (Data)**: **Socket.io** handles persistent bi-directional WebSocket connections.
* **Real-Time Engine (Media)**: **LiveKit Server SDK** generates secure access tokens to route client media streams (without routing media through the primary database).
* **Security & Auth**: **JSON Web Tokens (JWT)** for stateless authentication and **bcryptjs** for secure password hashing.

### Database
* **Engine**: **PostgreSQL** (interfaced via `pg` node driver) acting as the central relational database.
* **Data Structure**: Stores user profiles, gamification states, study sessions, friendships, notifications, and room configurations.

---

## 🛡️ 3. Security Protocols
The platform implements rigorous security protocols to protect user data and ensure application integrity:

1. **Authentication & Token Rotation**:
   * Uses **JWT (JSON Web Tokens)** for stateless authentication.
   * Both `accessToken` (15m expiry) and `refreshToken` (7-day expiry) are stored securely in **HttpOnly Cookies**, mitigating Cross-Site Scripting (XSS) attacks.
   * Refresh tokens are rotated upon use to prevent token theft.
2. **Password Cryptography**:
   * All passwords are computationally hashed and salted using **bcryptjs (12 rounds)** before touching the database.
3. **Rate Limiting & Brute Force Protection**:
   * **Express-Rate-Limit**: Limits login attempts to 5 per 15 minutes per IP.
   * **Account Lockout**: After 5 failed login attempts, the target user account is explicitly locked at the database level for 15 minutes.
4. **Email Verification**:
   * Accounts are flagged as `is_verified = 0` upon creation. A secure, one-time UUID `verification_token` is generated and emailed (via Resend API) to ensure the user owns the email address.
5. **Media Privacy**:
   * LiveKit SFU routing ensures that video and audio streams are routed directly between peers via the LiveKit cloud. Media feeds never touch or get recorded on the StudySync PostgreSQL database.

---

## 📱 4. Application Screens & Their Actual Use

### 1. Landing Page (`/`)
* **Purpose**: The public-facing marketing page.
* **Features**: Highlights platform features (Zen Mode, Gamification, Live Rooms), showcases a sketchbook-inspired premium UI, and provides clear Call-to-Action (CTA) buttons to log in or register.

### 2. Authentication Flow (`/login` & `/register`)
* **Purpose**: Secure entry points for users.
* **Features**: Collects credentials, enforces password complexity, handles the email verification gateway, and manages HTTP-only cookie injection upon successful authentication.

### 3. Dashboard (`/dashboard`)
* **Purpose**: The user's central command center and social hub.
* **Features**:
  * **Profile & Stats**: Displays current level, total XP, current streak, and best streak.
  * **Analytics Panel**: A custom-built CSS bar chart displaying focus hours over the past 7 days.
  * **RPG Progression**: A visual breakdown of the user's current rank (Novice, Scholar, Master, Legend) and progress bar to the next level.
  * **Global Leaderboard**: Displays the top 10 users platform-wide by focus time, highlighting the #1 user as "Champion".
  * **Live Social**: Interface to add friends via username, accept/reject incoming requests, and view which friends are currently online.
  * **Room Directory**: Allows users to launch their "Private Workspace" or create/join active group "Study Rooms".

### 4. Study Workspace (`/room/:roomId`)
* **Purpose**: The core productivity and collaboration environment.
* **Features**:
  * **Permissions Lobby**: A staging area enforcing hardware checks (Camera/Mic) before entering the room to maintain room quality.
  * **Live Video Sidebar**: LiveKit-powered grid showing webcam feeds of all active participants.
  * **Stopwatch & Timer**: A local stopwatch that tracks focus time and synchronizes progress to the server database via a `timer-heartbeat` every 15 seconds.
  * **Collaborative Objectives**: A real-time synchronized to-do list. Users can add tasks, and when a task is checked off, a broadcasted announcement and confetti animation play for everyone in the room.
  * **Ambient Audio**: Built-in lo-fi audio player offering environmental sounds (Rain, Forest, Cafe, Stream) or custom YouTube URL integration.
  * **Zen Mode (Deep Indigo)**: A toggleable UI state that collapses the video feeds, shifts the UI into a dark "Aizome" radial gradient theme, and highlights only the active timer and tasks for deep focus.

---

## 🚀 5. Core Features & User Benefits

### Technical Capabilities
* **SFU Video Routing**: By utilizing an SFU (Selective Forwarding Unit) instead of traditional P2P mesh networking, StudySync can support multiple users in a single room without exponentially degrading client bandwidth or CPU.
* **WebSocket Synchronization**: The application state (who is online, who checked off a task, who just leveled up) updates instantly across all connected clients without requiring page refreshes.

### Theoretical & Psychological Benefits
1. **Body Doubling (Social Facilitation)**:
   * *Benefit*: Seeing others actively working on their webcams triggers psychological accountability. It mimics the environment of a physical library, reducing the urge to open distracting tabs.
2. **Extrinsic to Intrinsic Motivation via Gamification**:
   * *Benefit*: Developing study habits is difficult. By applying RPG mechanics (Levels, XP, Ranks) and Streaks, the platform provides immediate, extrinsic dopamine rewards for studying. Over time, this builds the habit until the motivation becomes intrinsic.
3. **Structured Focus (Objectives + Timers)**:
   * *Benefit*: The integration of an active timer alongside a micro-task list prevents users from feeling overwhelmed by large projects. They can break work into small tasks, track exact time spent per task, and receive public recognition (confetti/announcements) when completing them.
4. **Environment Control (Zen Mode & Ambience)**:
   * *Benefit*: Users who get overstimulated by the social aspect can toggle Zen mode and ambient audio, instantly transforming the social environment into an isolated, aesthetic focus tunnel.

---
*StudySync is more than a video call app—it is a meticulously engineered psychological tool designed to make productivity an engaging, rewarding, and shared human experience.*
