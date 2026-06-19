# StudySync 2.0

<div align="center">
  <h1>StudySync 2.0</h1>
  <img src="./frontend/public/logo.png" alt="StudySync Logo" width="180" />
  
  <p><strong>Focus Together. Study Together.</strong></p>
  
  <a href="https://studysync.fun">
    <strong>Live Demo → studysync.fun</strong>
  </a>
</div>
**A Real-Time Virtual Study Platform** — Study together, stay focused, and build better habits.

**Live Site:** [studysync.fun](https://studysync.fun)

---

## ✨ What is StudySync?

StudySync transforms solitary studying into a **productive, social, and gamified experience**. It acts as a **virtual library** where students can join live study rooms, see peers working in real-time, track productivity, and stay motivated through community and RPG-style progression.

Whether you're preparing for exams or building consistent study habits, StudySync makes studying less lonely and more effective.

---

## 🚀 Key Features

- **Live Study Rooms** with real-time video & audio using **LiveKit**
- **Synchronized Focus Timer** (Pomodoro-style) visible to all room members
- **Collaborative Objectives** — Real-time shared to-do lists with confetti on completion
- **Ambient Audio Sync** — Built-in lo-fi sounds + custom YouTube integration
- **Zen Mode** — Distraction-free deep focus mode
- **Gamification** — XP, study streaks, levels, and global leaderboard
- **Analytics Dashboard** — Track your weekly focus hours with beautiful charts
- **Friends System** — Add friends and see who's online

---

## 🛠️ Tech Stack

### Frontend
- **React 18** (Vite)
- **React Router DOM v7**
- Vanilla CSS (Glassmorphism + Modern Animations)
- **LiveKit Components** (WebRTC)
- **Socket.io Client**
- Recharts, Lucide Icons

### Backend
- **Node.js + Express.js**
- **PostgreSQL** (Relational Database)
- **Socket.io** (Real-time synchronization)
- **LiveKit Server SDK** (Video/Audio Conferencing)
- **JWT + bcryptjs** (Secure Authentication)

### DevOps & Tools
- Render / Vercel
- Resend (Email)
- Neon / Supabase (Database)

---

## 📸 Screenshots

*(Add 6–8 screenshots/GIFs here — very important!)*

<!-- Example placeholders -->
![Landing Page](screenshots/landing.png)
![Study Room](screenshots/study-room.png)
![Dashboard](screenshots/dashboard.png)
![Zen Mode](screenshots/zen-mode.png)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL

### Local Setup

```bash
# Clone the repo
git clone https://github.com/ParthSharma2404/StudySync.git
cd StudySync

# Backend
cd backend
npm install
cp .env.example .env
# Add your environment variables

# Frontend
cd ../frontend
npm install

# Run both
# From root (recommended)
npm run dev

📄 Project Documentation
For detailed architecture, security practices, and feature breakdown, check PROJECT_DOCUMENTATION.md.

🛡️ Security Features

JWT Authentication with HttpOnly Cookies + Refresh Token Rotation
Password hashing with bcrypt (12 rounds)
Rate limiting & account lockout
Email verification via Resend
Secure LiveKit token generation


💡 Future Roadmap

Advanced AI study assistant
Mobile PWA support
Institution / College plans
Recording study sessions


Built with ❤️ for students who want to study better, together.

Made by Parth Sharma