# StudySync 2.0

StudySync is a comprehensive, real-time virtual study platform designed to boost productivity, foster community, and make studying engaging. It provides students with interactive virtual study rooms, live peers, productivity tracking, and gamified features to keep them motivated.

## 🚀 Features

- **Virtual Study Rooms**: Join themed live rooms (e.g., Deep Focus, Lo-Fi Chill) and study alongside peers in real-time.
- **Live Peer Presence**: See exactly who is studying with you right now and how long they've been focusing using WebSocket integration.
- **Focus Timer**: A synchronized built-in Pomodoro/Focus timer within study rooms.
- **Gamification & Streaks**: Earn XP for your study time and build daily study streaks.
- **Analytics & Dashboard**: Track your weekly study progress with visual analytics and charts.
- **Friends System**: Send, accept, and manage friend requests to study together.
- **Authentication**: Secure user registration and login using JWT (JSON Web Tokens) and bcrypt password hashing.
- **PostgreSQL Database**: Robust data management and persistent storage using a fully relational cloud database.

## 🛠️ Technology Stack

### Frontend
- **Framework**: React.js
- **Routing**: React Router DOM (v7)
- **Styling**: Vanilla CSS with modern aesthetics (Glassmorphism, CSS Variables, Animations)
- **Icons**: Lucide React
- **Charting**: Recharts

### Backend
- **Environment**: Node.js
- **Framework**: Express.js (v5)
- **Real-Time Communication**: Socket.io
- **Database**: PostgreSQL (using `pg` node-postgres driver)
- **Authentication**: JSON Web Token (JWT)
- **Password Hashing**: bcryptjs

### Hosting & Deployment
- **Platform**: Render
- **Infrastructure**: Web Services (Node/Express/React) & Managed PostgreSQL Database

## ⚙️ Local Development Setup

Follow these steps to run StudySync on your local machine:

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (installed locally, or use a cloud URI)

### 1. Clone the repository
```bash
git clone https://github.com/ParthSharma2404/StudySync.git
cd StudySync
```

### 2. Install Dependencies

Install root dependencies (optional, depending on structure):
```bash
npm install
```

Install backend dependencies:
```bash
cd backend
npm install
```

Install frontend dependencies:
```bash
cd ../frontend
npm install
```

### 3. Environment Variables
Create a `.env` file in the **root directory** and the **backend** directory with the following variables:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studysync
JWT_SECRET=your_super_secret_jwt_key
NODE_ENV=development
```
*(Make sure to update `DATABASE_URL` with your actual local Postgres credentials if needed).*

### 4. Start the Application

You can start both the backend and frontend concurrently from the root directory:
```bash
npm start
```
*Alternatively, you can run them separately:*
- Backend: `cd backend && node server.js`
- Frontend: `cd frontend && npm run dev`

### 5. Access the Platform
Open your browser and navigate to: `http://localhost:5173` (or the port specified by Vite).

## ☁️ Deployment

StudySync is configured to be deployed seamlessly on **Render**.

1. **Database**: Create a PostgreSQL instance on Render.
2. **Web Service**: Connect your GitHub repository to a Render Web Service.
3. **Environment Setup**:
   - Add your Render Internal Database URL to the `DATABASE_URL` environment variable.
   - Add a strong `JWT_SECRET`.
   - Set `NODE_ENV` to `production`.
4. **Build Command**: The root `package.json` contains a `postinstall` script that automatically builds the React frontend.
5. **Start Command**: `node backend/server.js`

## 📂 Project Structure

```
StudySync/
├── backend/
│   ├── server.js        # Express application & Socket.io server
│   ├── db.js            # PostgreSQL connection pool and initialization
├── frontend/
│   ├── index.html       # Entry HTML
│   ├── vite.config.js   # Vite configuration
│   ├── src/
│   │   ├── App.jsx      # Main application routing and navigation
│   │   ├── index.css    # Global CSS and design system
│   │   ├── components/  # React components (Dashboard, Login, StudyRoom, etc.)
├── package.json         # Root package manager script for easy deployment
└── render.yaml          # Render Infrastructure as Code (IaC) configuration
```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.
