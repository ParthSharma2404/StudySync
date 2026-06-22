const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { db, dbGet, dbAll, dbRun } = require('./db');
const { AccessToken } = require('livekit-server-sdk');



const app = express();
app.use(cors({ origin: true, credentials: true })); // Allow cookies
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'studysync_secret_key_123456';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'studysync_refresh_secret_123456';

// --- LiveKit API Helpers ---
const getLiveKitConfig = () => {
  return {
    apiKey: process.env.LIVEKIT_API_KEY?.replace(/['"]/g, '').trim(),
    apiSecret: process.env.LIVEKIT_API_SECRET?.replace(/['"]/g, '').trim(),
    url: process.env.LIVEKIT_URL?.replace(/['"]/g, '').trim()
  };
};

const generateLiveKitToken = async (roomId, participantName) => {
  const { apiKey, apiSecret } = getLiveKitConfig();
  
  if (!apiKey || !apiSecret) return null;

  // For very short lived tokens
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: participantName,
    ttl: '24h' // 24 hours
  });
  
  at.addGrant({ roomJoin: true, room: roomId, canPublish: true, canSubscribe: true });
  return await at.toJwt();
};


// Helper to send email via Resend API
const sendVerificationEmail = async (email, verifyUrl) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('MOCK EMAIL VERIFIER - Click here to verify:', verifyUrl);
    return { mock: true, url: verifyUrl };
  }

  const fromEmail = process.env.EMAIL_FROM || 'StudySync <onboarding@resend.dev>';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromEmail,
      to: email,
      subject: 'Verify your StudySync Account ✉️',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #fdfbf7; border: 2px solid #2b2b2b; border-radius: 16px; overflow: hidden;">
          <div style="background: #2b2b2b; padding: 24px 32px; text-align: center;">
            <h1 style="color: #fdfbf7; font-size: 22px; margin: 0; letter-spacing: 1px;">📚 STUDYSYNC</h1>
          </div>
          <div style="padding: 40px 32px; text-align: center;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(16,185,129,0.12); border: 2px solid rgba(16,185,129,0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; line-height: 64px;">✉️</div>
            <h2 style="color: #2b2b2b; font-size: 20px; margin-bottom: 8px;">Verify Your Email</h2>
            <p style="color: #5e5e5e; font-size: 14px; line-height: 1.6; margin-bottom: 28px;">Welcome to StudySync! Click the button below to verify your email address and start your study journey.</p>
            <a href="${verifyUrl}" style="display: inline-block; background: #2b2b2b; color: #fdfbf7; padding: 14px 36px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 3px 3px 0px rgba(0,0,0,0.15);">Verify My Email →</a>
            <p style="color: #999; font-size: 12px; margin-top: 28px; line-height: 1.5;">If the button doesn't work, copy and paste this link in your browser:<br><a href="${verifyUrl}" style="color: #6366f1; word-break: break-all;">${verifyUrl}</a></p>
          </div>
          <div style="background: #f5f5ec; padding: 16px 32px; text-align: center; border-top: 1px solid #e5e5d5;">
            <p style="color: #999; font-size: 11px; margin: 0;">© ${new Date().getFullYear()} StudySync. Study smarter, together.</p>
          </div>
        </div>
      `
    })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Failed to send email via Resend.');
  }
  return data;
};

// Verify Resend configuration at startup
if (process.env.RESEND_API_KEY) {
  console.log('✅ EMAIL SERVICE READY - Resend API Key configured');
} else {
  console.log('⚠️ EMAIL SERVICE IN MOCK MODE - RESEND_API_KEY not set');
}

// Login Rate Limiter (5 attempts per 15 mins)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

// --- MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired access token.' });
    req.user = user;
    next();
  });
};

// In-memory active state trackers (Moved to top for API access)
const roomsState = {};
const onlineUsers = {}; // maps userId -> { socketId, username }

// --- AUTH ROUTES ---
// --- AUTH ROUTES ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Bcrypt 12 rounds
    const password_hash = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();
    const verificationToken = crypto.randomUUID();

    await dbRun(
      'INSERT INTO users (id, username, email, password_hash, last_active_date, xp, is_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username, email, password_hash, new Date().toISOString().split('T')[0], 50, 0, verificationToken]
    );

    // Send Verification Email
    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify/${verificationToken}`;
    sendVerificationEmail(email, verifyUrl)
      .then((result) => {
        if (result && result.mock) {
          console.log('MOCK EMAIL VERIFIER - Click here to verify:', verifyUrl);
        } else {
          console.log('Verification email sent to:', email);
        }
      })
      .catch((emailErr) => console.error('Email sending failed:', emailErr.message));

    res.status(201).json({ message: 'User registered successfully! Please check your email to verify your account.' });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username or Email already exists.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

app.get('/api/auth/verify/:token', async (req, res) => {
  const verifyPageHTML = (success, message) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${success ? 'Email Verified' : 'Verification Failed'} - StudySync</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #fdfbf7;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
        }
        /* Notebook lines background */
        body::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: repeating-linear-gradient(
            transparent, transparent 31px,
            rgba(180, 210, 240, 0.3) 31px, rgba(180, 210, 240, 0.3) 32px
          );
          pointer-events: none;
        }
        /* Red margin line */
        body::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 80px;
          width: 2px;
          background: rgba(239, 68, 68, 0.2);
          pointer-events: none;
        }
        .card {
          background: rgba(253, 251, 247, 0.95);
          border: 2px solid #2b2b2b;
          border-radius: 16px;
          padding: 48px 40px;
          max-width: 460px;
          width: 90%;
          text-align: center;
          position: relative;
          z-index: 1;
          box-shadow: 4px 4px 0px #2b2b2b;
          animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(30px);
        }
        @keyframes slideUp {
          to { opacity: 1; transform: translateY(0); }
        }
        .icon-circle {
          width: 80px; height: 80px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 24px;
          font-size: 36px;
          animation: popIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
          opacity: 0;
          transform: scale(0.5);
        }
        @keyframes popIn {
          to { opacity: 1; transform: scale(1); }
        }
        .icon-success {
          background: rgba(16, 185, 129, 0.12);
          border: 2px solid rgba(16, 185, 129, 0.3);
          color: #10b981;
        }
        .icon-error {
          background: rgba(239, 68, 68, 0.1);
          border: 2px solid rgba(239, 68, 68, 0.25);
          color: #ef4444;
        }
        h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
          color: #2b2b2b;
          margin-bottom: 8px;
        }
        p {
          color: #5e5e5e;
          font-size: 0.95rem;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .btn {
          display: inline-block;
          background: #2b2b2b;
          color: #fdfbf7;
          padding: 12px 32px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          font-size: 0.95rem;
          border: 2px solid #2b2b2b;
          transition: all 0.2s ease;
          box-shadow: 3px 3px 0px rgba(0,0,0,0.15);
        }
        .btn:hover {
          background: #000;
          transform: translateY(-2px);
          box-shadow: 4px 5px 0px rgba(0,0,0,0.2);
        }
        .brand {
          margin-top: 32px;
          font-family: 'Outfit', sans-serif;
          font-size: 0.8rem;
          color: #aaa;
          letter-spacing: 1px;
        }
        .confetti { position: absolute; font-size: 20px; animation: fall 3s ease-in forwards; opacity: 0; }
        @keyframes fall {
          0% { opacity: 1; transform: translateY(-40px) rotate(0deg); }
          100% { opacity: 0; transform: translateY(120px) rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon-circle ${success ? 'icon-success' : 'icon-error'}">
          ${success ? '✓' : '✕'}
        </div>
        <h1>${success ? 'Email Verified!' : 'Verification Failed'}</h1>
        <p>${message}</p>
        <a href="/" class="btn">${success ? 'Go to Login →' : 'Back to Home →'}</a>
        <div class="brand">STUDYSYNC</div>
      </div>
      ${success ? `<script>
        const emojis = ['🎉','✨','📚','🎓','⭐','💡','🔥'];
        for (let i = 0; i < 12; i++) {
          const el = document.createElement('div');
          el.className = 'confetti';
          el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
          el.style.left = Math.random() * 100 + '%';
          el.style.top = Math.random() * 40 + '%';
          el.style.animationDelay = (Math.random() * 1.5) + 's';
          el.style.fontSize = (16 + Math.random() * 16) + 'px';
          document.body.appendChild(el);
        }
      </script>` : ''}
    </body>
    </html>
  `;

  try {
    const { token } = req.params;
    const user = await dbGet('SELECT id FROM users WHERE verification_token = ?', [token]);
    if (!user) return res.status(400).send(verifyPageHTML(false, 'This verification link is invalid or has already been used. Please try logging in or request a new verification email.'));

    await dbRun('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [user.id]);
    res.send(verifyPageHTML(true, 'Your email has been verified successfully. You can now sign in to your StudySync account and start studying!'));
  } catch (err) {
    console.error(err);
    res.status(500).send(verifyPageHTML(false, 'Something went wrong on our end. Please try again later.'));
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(400).json({ error: 'No account found with this email.' });
    if (user.is_verified === 1) return res.status(400).json({ error: 'This account is already verified.' });

    // Generate a fresh verification token
    const newToken = crypto.randomUUID();
    await dbRun('UPDATE users SET verification_token = ? WHERE id = ?', [newToken, user.id]);

    const verifyUrl = `${req.protocol}://${req.get('host')}/api/auth/verify/${newToken}`;
    try {
      const result = await sendVerificationEmail(email, verifyUrl);
      if (result && result.mock) {
        res.json({ message: 'Verification link generated in mock mode (printed to server console).' });
      } else {
        res.json({ message: 'Verification email sent! Please check your inbox (and spam folder).' });
      }
    } catch (emailErr) {
      console.error('Resend email failed:', emailErr);
      res.status(500).json({ error: `Email delivery failed: ${emailErr.message}` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(400).json({ error: 'No account found with this email. Please register.' });
    }

    // Account Lockout Check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account is locked due to too many failed attempts. Try again later.' });
    }

    // Email Verification Check
    if (user.is_verified === 0) {
      return res.status(403).json({ error: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const newAttempts = (user.failed_login_attempts || 0) + 1;
      let lockedUntil = null;
      if (newAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // Lock for 15 mins
      }
      await dbRun('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?', [newAttempts, lockedUntil, user.id]);
      
      if (lockedUntil) {
        return res.status(403).json({ error: 'Account locked due to 5 failed attempts. Please try again in 15 minutes.' });
      }
      return res.status(400).json({ error: 'Incorrect password. Please try again.' });
    }

    // Reset failed attempts on successful login
    await dbRun('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);

    // Streak logic has been moved to timer-heartbeat (Study Streak)
    const newStreak = user.current_streak || 0;
    const newXp = user.xp || 0;

    // Generate Tokens
    const accessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = uuidv4();
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await dbRun('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [refreshToken, user.id, refreshExpires.toISOString()]);

    // Set HttpOnly Cookies
    res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        current_streak: newStreak,
        total_study_seconds: user.total_study_seconds,
        xp: newXp
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required.' });

  try {
    const tokenRecord = await dbGet('SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP', [refreshToken]);
    if (!tokenRecord) {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
      return res.status(403).json({ error: 'Invalid or expired refresh token.' });
    }

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [tokenRecord.user_id]);
    if (!user) return res.status(403).json({ error: 'User no longer exists.' });

    // Rotate refresh token
    const newRefreshToken = uuidv4();
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await dbRun('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    await dbRun('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)', [newRefreshToken, user.id, refreshExpires.toISOString()]);

    const newAccessToken = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '15m' });

    res.cookie('accessToken', newAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth/refresh', maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json({ message: 'Token refreshed successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, email, current_streak, total_study_seconds, xp FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    dbRun('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]).catch(console.error);
  }
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
  res.json({ message: 'Logged out successfully.' });
});

// --- LEADERBOARD API ---
app.get('/api/users/leaderboard', authenticateToken, async (req, res) => {
  try {
    const topUsers = await dbAll(
      `SELECT id, username, total_study_seconds, xp 
       FROM users 
       ORDER BY total_study_seconds DESC 
       LIMIT 10`
    );

    const userRankData = await dbGet(
      `SELECT COUNT(*) as higher_users 
       FROM users 
       WHERE total_study_seconds > (SELECT total_study_seconds FROM users WHERE id = ?)`
      , [req.user.id]
    );
    
    const rank = parseInt(userRankData?.higher_users || 0) + 1;
    
    const currentUserIndex = topUsers.findIndex(u => u.id === req.user.id);
    let currentUserData = null;
    if (currentUserIndex === -1) {
      currentUserData = await dbGet(
        `SELECT id, username, total_study_seconds, xp FROM users WHERE id = ?`, 
        [req.user.id]
      );
    }

    res.json({ topUsers, currentUserRank: rank, currentUserData });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to load leaderboard.' });
  }
});

// --- DASHBOARD API ---
const syncUserStreak = async (userId) => {
  try {
    const user = await dbGet('SELECT longest_streak, last_active_date FROM users WHERE id = ?', [userId]);
    if (!user) return;

    const sessions = await dbAll(`
      SELECT DISTINCT TO_CHAR(start_time, 'YYYY-MM-DD') as day_date
      FROM study_sessions
      WHERE user_id = ?
    `, [userId]);

    const activeDates = new Set(sessions.map(s => s.day_date));
    if (user.last_active_date) {
      activeDates.add(user.last_active_date);
    }

    const sortedDates = Array.from(activeDates).sort((a, b) => new Date(a) - new Date(b));

    if (sortedDates.length === 0) return;

    let tempStreak = 0;
    let maxStreak = user.longest_streak || 0;
    let prevDate = null;

    for (const dStr of sortedDates) {
      if (!prevDate) {
        tempStreak = 1;
      } else {
        const d1 = new Date(prevDate);
        const d2 = new Date(dStr);
        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          tempStreak = 1;
        }
      }
      if (tempStreak > maxStreak) maxStreak = tempStreak;
      prevDate = dStr;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let currentStreak = 0;
    const lastActive = sortedDates[sortedDates.length - 1];
    
    if (lastActive === todayStr || lastActive === yesterdayStr) {
      currentStreak = tempStreak;
    } else {
      currentStreak = 0;
    }

    await dbRun(
      'UPDATE users SET current_streak = ?, longest_streak = ? WHERE id = ?',
      [currentStreak, maxStreak, userId]
    );
  } catch (err) {
    console.error('Error syncing user streak:', err);
  }
};

app.get('/api/user/dashboard', authenticateToken, async (req, res) => {
  try {
    await syncUserStreak(req.user.id);
    const user = await dbGet('SELECT username, email, current_streak, longest_streak, total_study_seconds, xp, has_seen_welcome, created_at FROM users WHERE id = ?', [req.user.id]);
    const roomsJoined = await dbAll(
      'SELECT DISTINCT r.id, r.name, r.description, r.created_at FROM study_sessions s JOIN rooms r ON s.room_id = r.id WHERE s.user_id = ?',
      [req.user.id]
    );

    // Fetch past 7 days study data
    const analyticsQuery = `
      SELECT TO_CHAR(start_time, 'YYYY-MM-DD') as day_date, SUM(duration_seconds) as total_seconds 
      FROM study_sessions 
      WHERE user_id = ? AND start_time >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY TO_CHAR(start_time, 'YYYY-MM-DD')
    `;
    const analyticsRaw = await dbAll(analyticsQuery, [req.user.id]);
    
    // Process into 7 days array
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const studyAnalytics = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayName = daysOfWeek[d.getDay()];
      
      const record = analyticsRaw.find(r => r.day_date === dateString);
      const hours = record ? Number((record.total_seconds / 3600).toFixed(1)) : 0;
      studyAnalytics.push({ day: dayName, hours });
    }

    res.json({
      user,
      roomsJoined,
      studyAnalytics
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching dashboard data.' });
  }
});

// --- WELCOME SEEN ---
app.post('/api/user/welcome-seen', authenticateToken, async (req, res) => {
  try {
    await dbRun('UPDATE users SET has_seen_welcome = 1 WHERE id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error updating welcome status.' });
  }
});

// --- ROOM API ---
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, passcode } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name is required.' });

    const roomId = crypto.randomUUID();

    await dbRun(
      'INSERT INTO rooms (id, name, description, creator_id, passcode, hms_room_id) VALUES (?, ?, ?, ?, ?, ?)',
      [roomId, name, description || '', req.user.id, passcode || null, null]
    );

    res.status(201).json({ roomId, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating study room.' });
  }
});

// Endpoint to generate a LiveKit Token for joining a room
app.get('/api/rooms/:id/token', authenticateToken, async (req, res) => {
  try {
    const room = await dbGet('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    // Ensure the env vars are available
    const { apiKey, apiSecret, url } = getLiveKitConfig();
    if (!apiKey || !apiSecret || !url) {
      return res.status(500).json({ error: `LiveKit config missing -> API_KEY: ${!!apiKey}, SECRET: ${!!apiSecret}, URL: ${!!url}` });
    }

    const token = await generateLiveKitToken(room.id, req.user.username);
    
    if (!token) {
      return res.status(500).json({ error: 'Failed to generate LiveKit token.' });
    }

    res.json({ token, serverUrl: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generating token.' });
  }
});

app.get('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rooms = await dbAll(`
      SELECT DISTINCT r.id, r.name, r.description, r.creator_id, u.username as creator_name, r.created_at 
      FROM rooms r 
      LEFT JOIN users u ON r.creator_id = u.id 
      LEFT JOIN study_sessions ss ON r.id = ss.room_id
      WHERE r.creator_id = ? OR ss.user_id = ?
      ORDER BY r.created_at DESC
    `, [userId, userId]);
    res.json(rooms);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching rooms.' });
  }
});

app.get('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const room = await dbGet('SELECT r.id, r.name, r.description, r.creator_id, u.username as creator_name FROM rooms r LEFT JOIN users u ON r.creator_id = u.id WHERE r.id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    const tasks = await dbAll('SELECT t.id, t.title, t.is_completed, t.time_spent_seconds, t.owner_id, u_owner.username as owner_name, u.username as completed_by_name FROM tasks t LEFT JOIN users u ON t.completed_by = u.id LEFT JOIN users u_owner ON t.owner_id = u_owner.id WHERE t.room_id = ?', [req.params.id]);
    
    // Inject active participants from memory
    const activeParticipants = roomsState[req.params.id] 
      ? Object.values(roomsState[req.params.id].participants).map(p => ({ username: p.username })) 
      : [];

    res.json({ room, tasks, activeParticipants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching room details.' });
  }
});

app.delete('/api/rooms/:id', authenticateToken, async (req, res) => {
  try {
    const room = await dbGet('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found.' });

    if (room.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the host can end this room session.' });
    }

    await dbRun('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    io.to(req.params.id).emit('room-closed');

    res.json({ message: 'Room ended successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error ending room session.' });
  }
});

app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await dbAll(
      `SELECT n.*, f.status as friendship_status 
       FROM notifications n 
       LEFT JOIN friendships f ON n.related_id = f.id 
       WHERE n.user_id = ? 
       ORDER BY n.created_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching notifications.' });
  }
});

app.post('/api/notifications/mark-read', authenticateToken, async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error marking notifications read.' });
  }
});

app.post('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error marking notification read.' });
  }
});

// --- FRIEND ROUTES ---
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const { targetUsername } = req.body;
    if (!targetUsername) return res.status(400).json({ error: 'Username required.' });
    if (targetUsername === req.user.username) return res.status(400).json({ error: 'Cannot add yourself.' });

    const targetUser = await dbGet('SELECT id FROM users WHERE username = ?', [targetUsername]);
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const existing = await dbGet(
      'SELECT * FROM friendships WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [req.user.id, targetUser.id, targetUser.id, req.user.id]
    );

    if (existing) {
      if (existing.status === 'accepted') return res.status(400).json({ error: 'Already friends.' });
      return res.status(400).json({ error: 'Friend request already exists.' });
    }

    const reqId = crypto.randomUUID();
    await dbRun(
      'INSERT INTO friendships (id, sender_id, receiver_id) VALUES (?, ?, ?)',
      [reqId, req.user.id, targetUser.id]
    );

    const notifId = crypto.randomUUID();
    await dbRun(
      "INSERT INTO notifications (id, user_id, message, type, related_id) VALUES (?, ?, ?, 'friend_request', ?)",
      [notifId, targetUser.id, `New friend request from ${req.user.username}!`, reqId]
    );

    const targetSocket = onlineUsers[targetUser.id];
    if (targetSocket) {
      io.to(targetSocket.socketId).emit('notification', { message: `New friend request from ${req.user.username}!` });
      io.to(targetSocket.socketId).emit('friend-request-received');
      io.to(targetSocket.socketId).emit('new-notification');
    }

    res.status(200).json({ message: 'Friend request sent!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error sending friend request.' });
  }
});

app.post('/api/friends/accept', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await dbGet('SELECT * FROM friendships WHERE id = ?', [requestId]);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    
    if (request.receiver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });

    await dbRun("UPDATE friendships SET status = 'accepted' WHERE id = ?", [requestId]);

    const notifId = crypto.randomUUID();
    await dbRun(
      "INSERT INTO notifications (id, user_id, message, type) VALUES (?, ?, ?, 'friend_accept')",
      [notifId, request.sender_id, `${req.user.username} accepted your friend request!`]
    );

    await dbRun("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = 'friend_request' AND related_id = ?", [req.user.id, requestId]);

    const senderSocket = onlineUsers[request.sender_id];
    if (senderSocket) {
      io.to(senderSocket.socketId).emit('notification', { message: `${req.user.username} accepted your friend request!` });
      io.to(senderSocket.socketId).emit('friend-request-accepted');
      io.to(senderSocket.socketId).emit('new-notification');
    }

    res.status(200).json({ message: 'Friend request accepted!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error accepting friend request.' });
  }
});

app.post('/api/friends/reject', authenticateToken, async (req, res) => {
  try {
    const { requestId } = req.body;
    const request = await dbGet('SELECT * FROM friendships WHERE id = ?', [requestId]);
    if (!request) return res.status(404).json({ error: 'Request not found.' });
    
    if (request.receiver_id !== req.user.id && request.sender_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized.' });

    await dbRun('DELETE FROM friendships WHERE id = ?', [requestId]);
    res.status(200).json({ message: 'Friend request removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error rejecting friend request.' });
  }
});

app.post('/api/friends/remove', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.body;
    const friendship = await dbGet(
      "SELECT * FROM friendships WHERE status = 'accepted' AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))",
      [req.user.id, friendId, friendId, req.user.id]
    );
    
    if (!friendship) return res.status(404).json({ error: 'Friendship not found.' });

    await dbRun('DELETE FROM friendships WHERE id = ?', [friendship.id]);
    
    const otherSocket = onlineUsers[friendId];
    if (otherSocket) {
      io.to(otherSocket.socketId).emit('friend-removed');
    }
    
    res.status(200).json({ message: 'Friend removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error removing friend.' });
  }
});

app.get('/api/friends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const friendsQuery = `
      SELECT u.id, u.username, u.xp
      FROM users u
      JOIN friendships f ON (f.sender_id = u.id OR f.receiver_id = u.id)
      WHERE f.status = 'accepted' AND (f.sender_id = ? OR f.receiver_id = ?) AND u.id != ?
    `;
    const friends = await dbAll(friendsQuery, [userId, userId, userId]);

    const incomingQuery = `
      SELECT f.id as request_id, u.id as user_id, u.username 
      FROM friendships f
      JOIN users u ON f.sender_id = u.id
      WHERE f.receiver_id = ? AND f.status = 'pending'
    `;
    const incomingRequests = await dbAll(incomingQuery, [userId]);

    res.json({ friends, incomingRequests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching friends.' });
  }
});

// Serve frontend in production (Render)
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
  res.sendFile(path.resolve(__dirname, '../frontend/dist', 'index.html'));
});

// --- HTTP SERVER & SOCKET.IO SETUP ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// In-memory active state trackers moved to top of file
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Identify global active user for invitations
  socket.on('identify', ({ userId, username }) => {
    onlineUsers[userId] = { socketId: socket.id, username };
    socket.userId = userId;
    socket.username = username;

    // Broadcast updated online list to all dashboards
    const onlineList = Object.keys(onlineUsers).map(id => ({
      userId: id,
      username: onlineUsers[id].username
    }));
    io.emit('online-users-updated', onlineList);
  });

  // Relay real-time invitations to targeted users
  socket.on('send-invite', async ({ targetUserId, roomId, roomName, hostName }) => {
    const notifId = crypto.randomUUID();
    await dbRun(
      "INSERT INTO notifications (id, user_id, message, type, related_id) VALUES (?, ?, ?, 'room_invite', ?)",
      [notifId, targetUserId, `${hostName} invited you to join: ${roomName}`, roomId]
    ).catch(console.error);

    const targetSocket = onlineUsers[targetUserId];
    if (targetSocket) {
      io.to(targetSocket.socketId).emit('room-invite-received', {
        roomId,
        roomName,
        hostName
      });
      io.to(targetSocket.socketId).emit('new-notification');
    }
  });

  socket.on('send-invite-username', async ({ targetUsername, roomId, roomName, hostName }) => {
    const targetEntry = Object.entries(onlineUsers).find(([id, u]) => u.username === targetUsername);
    if (targetEntry) {
      const targetUserId = targetEntry[0];
      const targetSocketId = targetEntry[1].socketId;

      const notifId = crypto.randomUUID();
      await dbRun(
        "INSERT INTO notifications (id, user_id, message, type, related_id) VALUES (?, ?, ?, 'room_invite', ?)",
        [notifId, targetUserId, `${hostName} invited you to join: ${roomName}`, roomId]
      ).catch(console.error);

      io.to(targetSocketId).emit('room-invite-received', {
        roomId,
        roomName,
        hostName
      });
      io.to(targetSocketId).emit('new-notification');
      socket.emit('notification', { message: `Invite sent to ${targetUsername}!` });
    } else {
      socket.emit('notification', { message: `User ${targetUsername} is not online or doesn't exist.` });
    }
  });

  socket.on('join-room', async ({ roomId, userId, username, peerId }) => {
    console.log(`[join-room] roomId: ${roomId}, userId: ${userId}, username: ${username}, peerId: ${peerId}`);
    socket.join(roomId);

    if (!roomsState[roomId]) {
      roomsState[roomId] = {
        moderatorId: userId,
        timerStarted: false,
        roomStartTime: null,
        ambientAudio: 'none',
        participants: {}
      };
    }

    let userXp = 0;
    try {
      const u = await dbGet('SELECT xp FROM users WHERE id = ?', [userId]);
      if (u) userXp = u.xp || 0;
    } catch (err) {
      console.error('Error fetching xp on join-room', err);
    }

    roomsState[roomId].participants[socket.id] = {
      userId,
      username,
      peerId,
      xp: userXp,
      status: 'Joined 💤',
      studySeconds: 0,
      activeTaskId: null,
      lastHeartbeat: Date.now()
    };

    const sessionId = crypto.randomUUID();
    socket.sessionId = sessionId;
    socket.roomId = roomId;
    socket.userId = userId;
    socket.username = username;

    try {
      await dbRun(
        'INSERT INTO study_sessions (id, user_id, room_id, start_time, duration_seconds) VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)',
        [sessionId, userId, roomId]
      );
    } catch (err) {
      console.error('Error inserting study_session on join-room:', err);
    }

    // Broadcast current participants and state
    const participantsList = Object.values(roomsState[roomId].participants);
    io.to(roomId).emit('room-state-updated', {
      moderatorId: roomsState[roomId].moderatorId,
      timerStarted: roomsState[roomId].timerStarted,
      roomStartTime: roomsState[roomId].roomStartTime,
      ambientAudio: roomsState[roomId].ambientAudio,
      participants: participantsList
    });

    socket.to(roomId).emit('notification', {
      message: `${username} joined the room.`
    });
  });

  // Synchronized Room Timer Control
  socket.on('start-room-timer', () => {
    const { roomId } = socket;
    if (!roomId || !roomsState[roomId]) return;

    if (!roomsState[roomId].timerStarted) {
      roomsState[roomId].timerStarted = true;
      roomsState[roomId].roomStartTime = Date.now();
      io.to(roomId).emit('room-timer-started', { roomStartTime: roomsState[roomId].roomStartTime });
    }
  });

  // Ambient Audio Sync
  socket.on('change-ambient-audio', ({ trackId }) => {
    const { roomId, userId } = socket;
    if (!roomId || !roomsState[roomId]) return;
    
    if (roomsState[roomId].moderatorId === userId) {
      roomsState[roomId].ambientAudio = trackId;
      io.to(roomId).emit('ambient-audio-updated', { trackId });
    }
  });


  // Heartbeat for Solo Mode - records active progress without broadcasting
  socket.on('solo-heartbeat', async ({ incrementSeconds }) => {
    const { userId, sessionId } = socket;
    if (!userId || !sessionId) return;

    try {
      await dbRun(
        'UPDATE study_sessions SET duration_seconds = COALESCE(duration_seconds, 0) + ? WHERE id = ?',
        [incrementSeconds, sessionId]
      );

      const userOld = await dbGet('SELECT total_study_seconds FROM users WHERE id = ?', [userId]);
      const oldMinutes = Math.floor((userOld?.total_study_seconds || 0) / 60);

      await dbRun(
        'UPDATE users SET total_study_seconds = COALESCE(total_study_seconds, 0) + ? WHERE id = ?',
        [incrementSeconds, userId]
      );

      const userNew = await dbGet('SELECT total_study_seconds, current_streak, longest_streak, last_active_date FROM users WHERE id = ?', [userId]);
      const newMinutes = Math.floor((userNew?.total_study_seconds || 0) / 60);

      if (newMinutes > oldMinutes) {
        const xpEarned = newMinutes - oldMinutes;
        let totalXpEarned = xpEarned;
        
        // --- Study Streak Logic ---
        const todayStr = new Date().toISOString().split('T')[0];
        let newStreak = userNew.current_streak || 0;
        let longestStreak = userNew.longest_streak || 0;
        let streakBonusXp = 0;

        if (userNew.last_active_date !== todayStr) {
          if (userNew.last_active_date) {
            const lastActive = new Date(userNew.last_active_date);
            const today = new Date(todayStr);
            const diffTime = Math.abs(today - lastActive);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              newStreak += 1;
              streakBonusXp = 20; // Streak maintained
            } else {
              newStreak = 1;
              streakBonusXp = 10; // Streak broken, start new
            }
          } else {
            newStreak = 1;
            streakBonusXp = 10; // First time ever studying
          }

          if (newStreak > longestStreak) {
            longestStreak = newStreak;
          }

          await dbRun(
            'UPDATE users SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = ?',
            [newStreak, longestStreak, todayStr, userId]
          );
          
          totalXpEarned += streakBonusXp;
        }

        await dbRun('UPDATE users SET xp = xp + ? WHERE id = ?', [totalXpEarned, userId]);
        socket.emit('xp-earned', { amount: xpEarned, reason: 'Solo Focus Session' });
        
        if (streakBonusXp === 20) {
          socket.emit('xp-earned', { amount: 20, reason: 'Streak Bonus!' });
          socket.emit('streak-updated', { streak: newStreak });
        } else if (streakBonusXp === 10) {
          socket.emit('xp-earned', { amount: 10, reason: 'Daily Study Bonus' });
          socket.emit('streak-updated', { streak: newStreak });
        }
      }

      if (userNew && userNew.total_study_seconds >= 18000) {
        const badgeEarned = await dbGet('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?', [userId, 'badge_focus_champion']);
        if (!badgeEarned) {
          await dbRun('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', [userId, 'badge_focus_champion']);
          socket.emit('badge-earned', {
            name: 'Focus Champion',
            description: 'Accumulated 5 hours of total active study time.',
            icon_name: '👑'
          });
        }
      }
    } catch (err) {
      console.error('Error processing solo-heartbeat:', err);
    }
  });

  // Heartbeat - records active progress
  socket.on('timer-heartbeat', async ({ incrementSeconds, activeTaskId }) => {
    const { roomId, userId, sessionId } = socket;
    if (!roomId || !userId || !sessionId || !roomsState[roomId]) return;

    const participant = roomsState[roomId].participants[socket.id];
    if (participant) {
      participant.studySeconds += incrementSeconds;
      participant.activeTaskId = activeTaskId;
      participant.lastHeartbeat = Date.now();

      await dbRun(
        'UPDATE study_sessions SET duration_seconds = COALESCE(duration_seconds, 0) + ? WHERE id = ?',
        [incrementSeconds, sessionId]
      );

      const userOld = await dbGet('SELECT total_study_seconds FROM users WHERE id = ?', [userId]);
      const oldMinutes = Math.floor((userOld?.total_study_seconds || 0) / 60);

      await dbRun(
        'UPDATE users SET total_study_seconds = COALESCE(total_study_seconds, 0) + ? WHERE id = ?',
        [incrementSeconds, userId]
      );

      const userNew = await dbGet('SELECT total_study_seconds, current_streak, longest_streak, last_active_date FROM users WHERE id = ?', [userId]);
      const newMinutes = Math.floor((userNew?.total_study_seconds || 0) / 60);

      if (newMinutes > oldMinutes) {
        const xpEarned = newMinutes - oldMinutes;
        let totalXpEarned = xpEarned;
        
        // --- Study Streak Logic ---
        const todayStr = new Date().toISOString().split('T')[0];
        let newStreak = userNew.current_streak || 0;
        let longestStreak = userNew.longest_streak || 0;
        let streakBonusXp = 0;

        if (userNew.last_active_date !== todayStr) {
          if (userNew.last_active_date) {
            const lastActive = new Date(userNew.last_active_date);
            const today = new Date(todayStr);
            const diffTime = Math.abs(today - lastActive);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              newStreak += 1;
              streakBonusXp = 20; // Streak maintained
            } else {
              newStreak = 1;
              streakBonusXp = 10; // Streak broken, start new
            }
          } else {
            newStreak = 1;
            streakBonusXp = 10; // First time ever studying
          }

          if (newStreak > longestStreak) {
            longestStreak = newStreak;
          }

          await dbRun(
            'UPDATE users SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = ?',
            [newStreak, longestStreak, todayStr, userId]
          );
          
          totalXpEarned += streakBonusXp;
        }

        await dbRun('UPDATE users SET xp = xp + ? WHERE id = ?', [totalXpEarned, userId]);
        socket.emit('xp-earned', { amount: xpEarned, reason: 'Focus Session' });
        
        if (streakBonusXp === 20) {
          socket.emit('xp-earned', { amount: 20, reason: 'Streak Bonus!' });
          socket.emit('streak-updated', { streak: newStreak });
        } else if (streakBonusXp === 10) {
          socket.emit('xp-earned', { amount: 10, reason: 'Daily Study Bonus' });
          socket.emit('streak-updated', { streak: newStreak });
        }
      }

      if (userNew && userNew.total_study_seconds >= 18000) {
        const badgeEarned = await dbGet('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?', [userId, 'badge_focus_champion']);
        if (!badgeEarned) {
          await dbRun('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', [userId, 'badge_focus_champion']);
          socket.emit('badge-earned', {
            name: 'Focus Champion',
            description: 'Accumulated 5 hours of total active study time.',
            icon_name: '👑'
          });
        }
      }

      if (activeTaskId) {
        await dbRun(
          'UPDATE tasks SET time_spent_seconds = COALESCE(time_spent_seconds, 0) + ? WHERE id = ?',
          [incrementSeconds, activeTaskId]
        );
        const tasks = await dbAll('SELECT t.id, t.title, t.is_completed, t.time_spent_seconds, t.owner_id, u_owner.username as owner_name, u.username as completed_by_name FROM tasks t LEFT JOIN users u ON t.completed_by = u.id LEFT JOIN users u_owner ON t.owner_id = u_owner.id WHERE t.room_id = ?', [roomId]);
        io.to(roomId).emit('tasks-updated', tasks);
      }

      const participantsList = Object.values(roomsState[roomId].participants);
      io.to(roomId).emit('room-state-updated', {
        moderatorId: roomsState[roomId].moderatorId,
        timerStarted: roomsState[roomId].timerStarted,
        roomStartTime: roomsState[roomId].roomStartTime,
        participants: participantsList
      });
    }
  });

  socket.on('status-update', ({ status }) => {
    const { roomId } = socket;
    if (!roomId || !roomsState[roomId]) return;

    const participant = roomsState[roomId].participants[socket.id];
    if (participant) {
      participant.status = status;

      const participantsList = Object.values(roomsState[roomId].participants);
      io.to(roomId).emit('room-state-updated', {
        moderatorId: roomsState[roomId].moderatorId,
        timerStarted: roomsState[roomId].timerStarted,
        roomStartTime: roomsState[roomId].roomStartTime,
        participants: participantsList
      });
    }
  });

  socket.on('task-create', async (payload) => {
    // payload could be { title } or { id, title }
    const title = payload.title;
    const id = payload.id;
    const { roomId, userId } = socket;
    if (!roomId) return;

    const taskId = id || crypto.randomUUID();
    await dbRun(
      'INSERT INTO tasks (id, room_id, owner_id, title, is_completed) VALUES (?, ?, ?, ?, 0)',
      [taskId, roomId, userId, title]
    );

    const tasks = await dbAll('SELECT t.id, t.title, t.is_completed, t.time_spent_seconds, t.owner_id, u_owner.username as owner_name, u.username as completed_by_name FROM tasks t LEFT JOIN users u ON t.completed_by = u.id LEFT JOIN users u_owner ON t.owner_id = u_owner.id WHERE t.room_id = ?', [roomId]);
    io.to(roomId).emit('tasks-updated', tasks);
  });

  socket.on('task-toggle', async ({ taskId }) => {
    const { roomId, userId } = socket;
    if (!roomId || !userId || !roomsState[roomId]) return;

    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return;

    const newStatus = task.is_completed ? 0 : 1;

    await dbRun(
      'UPDATE tasks SET is_completed = ?, completed_by = ? WHERE id = ?',
      [newStatus, newStatus ? userId : null, taskId]
    );

    const participant = roomsState[roomId].participants[socket.id];
    const username = participant ? participant.username : 'Someone';

    const tasks = await dbAll('SELECT t.id, t.title, t.is_completed, t.time_spent_seconds, t.owner_id, u_owner.username as owner_name, u.username as completed_by_name FROM tasks t LEFT JOIN users u ON t.completed_by = u.id LEFT JOIN users u_owner ON t.owner_id = u_owner.id WHERE t.room_id = ?', [roomId]);
    io.to(roomId).emit('tasks-updated', tasks);

    if (newStatus === 1) {
      const timeSpent = task.time_spent_seconds;
      const minutes = Math.floor(timeSpent / 60);
      const seconds = timeSpent % 60;
      const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      io.to(roomId).emit('task-announcement', {
        username,
        taskTitle: task.title,
        timeSpentString: timeString
      });
    }

    const activeParticipantsCount = Object.keys(roomsState[roomId].participants).length;
    if (activeParticipantsCount >= 2) {
      const badgeEarned = await dbGet('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?', [userId, 'badge_coop_hero']);
      if (!badgeEarned) {
        await dbRun('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', [userId, 'badge_coop_hero']);
        socket.emit('badge-earned', {
          name: 'Co-op Hero',
          description: 'Successfully completed a Group Quest with friends.',
          icon_name: '🤝'
        });
      }
    }

    const localHour = new Date().getHours();
    if (localHour < 8) {
      const badgeEarned = await dbGet('SELECT 1 FROM user_badges WHERE user_id = ? AND badge_id = ?', [userId, 'badge_early_bird']);
      if (!badgeEarned) {
        await dbRun('INSERT INTO user_badges (user_id, badge_id) VALUES (?, ?)', [userId, 'badge_early_bird']);
        socket.emit('badge-earned', {
          name: 'Early Bird',
          description: 'Completed a study task before 8:00 AM.',
          icon_name: '🌅'
        });
      }
    }
  });

  socket.on('leave-room', async () => {
    const { roomId, userId, sessionId } = socket;
    if (roomId && roomsState[roomId]) {
      const participant = roomsState[roomId].participants[socket.id];
      const username = participant ? participant.username : 'A user';

      if (sessionId) {
        await dbRun(
          'UPDATE study_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = ?',
          [sessionId]
        ).catch(err => console.error('Error ending study session:', err));
      }

      delete roomsState[roomId].participants[socket.id];
      socket.leave(roomId);
      
      // Clean up socket instance variables
      socket.roomId = null;
      socket.sessionId = null;

      const activeSockets = Object.keys(roomsState[roomId].participants);
      if (activeSockets.length > 0) {
        if (roomsState[roomId].moderatorId === userId) {
          const firstSocketId = activeSockets[0];
          const newMod = roomsState[roomId].participants[firstSocketId];
          roomsState[roomId].moderatorId = newMod.userId;
        }
      }

      const participantsList = Object.values(roomsState[roomId].participants);
      io.to(roomId).emit('room-state-updated', {
        moderatorId: roomsState[roomId].moderatorId,
        timerStarted: roomsState[roomId].timerStarted,
        roomStartTime: roomsState[roomId].roomStartTime,
        ambientAudio: roomsState[roomId].ambientAudio,
        participants: participantsList
      });

      io.to(roomId).emit('notification', {
        message: `${username} left the room.`
      });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    const { roomId, userId, sessionId } = socket;

    // Clean up online list
    if (userId && onlineUsers[userId] && onlineUsers[userId].socketId === socket.id) {
      delete onlineUsers[userId];
      const onlineList = Object.keys(onlineUsers).map(id => ({
        userId: id,
        username: onlineUsers[id].username
      }));
      io.emit('online-users-updated', onlineList);
    }

    if (roomId && roomsState[roomId]) {
      const participant = roomsState[roomId].participants[socket.id];
      const username = participant ? participant.username : 'A user';

      if (sessionId) {
        await dbRun(
          'UPDATE study_sessions SET end_time = CURRENT_TIMESTAMP WHERE id = ?',
          [sessionId]
        );
      }

      delete roomsState[roomId].participants[socket.id];
      const activeSockets = Object.keys(roomsState[roomId].participants);

      if (activeSockets.length > 0) {
        if (roomsState[roomId].moderatorId === userId) {
          const firstSocketId = activeSockets[0];
          const newMod = roomsState[roomId].participants[firstSocketId];
          roomsState[roomId].moderatorId = newMod.userId;
        }
      }

      const participantsList = Object.values(roomsState[roomId].participants);
      io.to(roomId).emit('room-state-updated', {
        moderatorId: roomsState[roomId].moderatorId,
        timerStarted: roomsState[roomId].timerStarted,
        roomStartTime: roomsState[roomId].roomStartTime,
        ambientAudio: roomsState[roomId].ambientAudio,
        participants: participantsList
      });

      io.to(roomId).emit('notification', {
        message: `${username} left the room.`
      });
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`StudySync Server running on port ${PORT}`);
});
