const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { db, dbGet, dbAll, dbRun } = require('./db');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
app.use(cors({ origin: true, credentials: true })); // Allow cookies
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'studysync_secret_key_123456';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'studysync_refresh_secret_123456';

// Email Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your StudySync Account',
      html: `<p>Welcome to StudySync!</p><p>Please verify your email by clicking the link below:</p><a href="${verifyUrl}">${verifyUrl}</a>`
    };

    try {
      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        await transporter.sendMail(mailOptions);
        console.log('Verification email sent to:', email);
      } else {
        console.log('MOCK EMAIL VERIFIER - Click here to verify:', verifyUrl);
      }
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr);
    }

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
  try {
    const { token } = req.params;
    const user = await dbGet('SELECT id FROM users WHERE verification_token = ?', [token]);
    if (!user) return res.status(400).send('Invalid or expired verification link.');

    await dbRun('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?', [user.id]);
    res.send('<h1>Email Verified Successfully!</h1><p>You can now log in to StudySync.</p><a href="/">Go to Login</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
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

    // Update Streak check on login
    const todayStr = new Date().toISOString().split('T')[0];
    let newStreak = user.current_streak;
    let newXp = user.xp || 0;

    if (user.last_active_date) {
      const lastActive = new Date(user.last_active_date);
      const today = new Date(todayStr);
      const diffTime = Math.abs(today - lastActive);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreak += 1;
        newXp += 20; // 20 XP streak bonus
      } else if (diffDays > 1) {
        newStreak = 1; // Streak reset
        newXp += 10; // 10 XP daily login
      }
    } else {
      newStreak = 1;
      newXp += 10;
    }

    let longestStreak = user.longest_streak;
    if (newStreak > longestStreak) {
      longestStreak = newStreak;
    }

    await dbRun(
      'UPDATE users SET current_streak = ?, longest_streak = ?, last_active_date = ?, xp = ? WHERE id = ?',
      [newStreak, longestStreak, todayStr, newXp, user.id]
    );

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

// --- DASHBOARD API ---
app.get('/api/user/dashboard', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT username, email, current_streak, longest_streak, total_study_seconds, xp, created_at FROM users WHERE id = ?', [req.user.id]);
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

// --- ROOM API ---
app.post('/api/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, description, passcode } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name is required.' });

    const roomId = crypto.randomUUID();
    await dbRun(
      'INSERT INTO rooms (id, name, description, creator_id, passcode) VALUES (?, ?, ?, ?, ?)',
      [roomId, name, description || '', req.user.id, passcode || null]
    );

    res.status(201).json({ roomId, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creating study room.' });
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

    res.json({ room, tasks });
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

// --- FRIENDS ROUTES ---
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

    const targetSocket = onlineUsers[targetUser.id];
    if (targetSocket) {
      io.to(targetSocket.socketId).emit('notification', { message: `New friend request from ${req.user.username}!` });
      io.to(targetSocket.socketId).emit('friend-request-received');
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

    await dbRun('UPDATE friendships SET status = "accepted" WHERE id = ?', [requestId]);

    const senderSocket = onlineUsers[request.sender_id];
    if (senderSocket) {
      io.to(senderSocket.socketId).emit('notification', { message: `${req.user.username} accepted your friend request!` });
      io.to(senderSocket.socketId).emit('friend-request-accepted');
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

// In-memory active state trackers
const roomsState = {};
const onlineUsers = {}; // maps userId -> { socketId, username }

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
  socket.on('send-invite', ({ targetUserId, roomId, roomName, hostName }) => {
    const targetSocket = onlineUsers[targetUserId];
    if (targetSocket) {
      io.to(targetSocket.socketId).emit('room-invite-received', {
        roomId,
        roomName,
        hostName
      });
    }
  });

  socket.on('send-invite-username', ({ targetUsername, roomId, roomName, hostName }) => {
    const targetUser = Object.values(onlineUsers).find(u => u.username === targetUsername);
    if (targetUser) {
      io.to(targetUser.socketId).emit('room-invite-received', {
        roomId,
        roomName,
        hostName
      });
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
        'UPDATE study_sessions SET duration_seconds = duration_seconds + ? WHERE id = ?',
        [incrementSeconds, sessionId]
      );

      const userOld = await dbGet('SELECT total_study_seconds FROM users WHERE id = ?', [userId]);
      const oldMinutes = Math.floor((userOld?.total_study_seconds || 0) / 60);

      await dbRun(
        'UPDATE users SET total_study_seconds = total_study_seconds + ? WHERE id = ?',
        [incrementSeconds, userId]
      );

      const userNew = await dbGet('SELECT total_study_seconds FROM users WHERE id = ?', [userId]);
      const newMinutes = Math.floor((userNew?.total_study_seconds || 0) / 60);

      if (newMinutes > oldMinutes) {
        const xpEarned = newMinutes - oldMinutes;
        await dbRun('UPDATE users SET xp = xp + ? WHERE id = ?', [xpEarned, userId]);
        socket.emit('xp-earned', { amount: xpEarned, reason: 'Focus Session' });
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
          'UPDATE tasks SET time_spent_seconds = time_spent_seconds + ? WHERE id = ?',
          [incrementSeconds, activeTaskId]
        );
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

  socket.on('task-create', async ({ title }) => {
    const { roomId, userId } = socket;
    if (!roomId) return;

    const taskId = crypto.randomUUID();
    await dbRun(
      'INSERT INTO tasks (id, room_id, owner_id, title, is_completed) VALUES (?, ?, ?, ?, 0)',
      [taskId, roomId, userId, title]
    );

    const tasks = await dbAll('SELECT t.id, t.title, t.is_completed, t.time_spent_seconds, t.owner_id, u_owner.username as owner_name, u.username as completed_by_name FROM tasks t LEFT JOIN users u ON t.completed_by = u.id LEFT JOIN users u_owner ON t.owner_id = u_owner.id WHERE t.room_id = ?', [roomId]);
    io.to(roomId).emit('tasks-updated', tasks);
  });

  socket.on('task-complete', async ({ taskId }) => {
    const { roomId, userId } = socket;
    if (!roomId || !userId || !roomsState[roomId]) return;

    const task = await dbGet('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (!task) return;

    await dbRun(
      'UPDATE tasks SET is_completed = 1, completed_by = ? WHERE id = ?',
      [userId, taskId]
    );

    const participant = roomsState[roomId].participants[socket.id];
    const username = participant ? participant.username : 'Someone';

    const tasks = await dbAll('SELECT t.id, t.title, t.is_completed, t.time_spent_seconds, t.owner_id, u_owner.username as owner_name, u.username as completed_by_name FROM tasks t LEFT JOIN users u ON t.completed_by = u.id LEFT JOIN users u_owner ON t.owner_id = u_owner.id WHERE t.room_id = ?', [roomId]);
    io.to(roomId).emit('tasks-updated', tasks);

    const timeSpent = task.time_spent_seconds;
    const minutes = Math.floor(timeSpent / 60);
    const seconds = timeSpent % 60;
    const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

    io.to(roomId).emit('task-announcement', {
      username,
      taskTitle: task.title,
      timeSpentString: timeString
    });

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
