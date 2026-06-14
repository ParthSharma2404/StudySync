const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../database.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Run migrations inside a transaction/serialize block
db.serialize(() => {
  // Users Table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_active_date TEXT,
      total_study_seconds INTEGER DEFAULT 0,
      xp INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Rooms Table
  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      creator_id TEXT,
      passcode TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(creator_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Tasks Table
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      completed_by TEXT,
      time_spent_seconds INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(completed_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Study Sessions Table
  db.run(`
    CREATE TABLE IF NOT EXISTS study_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      room_id TEXT,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP,
      duration_seconds INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(room_id) REFERENCES rooms(id) ON DELETE SET NULL
    )
  `);

  // Friendships Table
  db.run(`
    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(sender_id, receiver_id)
    )
  `);

  // Migrations for XP System
  db.run("ALTER TABLE users ADD COLUMN xp INTEGER DEFAULT 0", (err) => {});
  db.run("ALTER TABLE tasks ADD COLUMN owner_id TEXT", (err) => {});
  db.run(`
    CREATE TABLE IF NOT EXISTS user_badges (
      user_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, badge_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
});

// Helper wrapper functions for Promisified DB queries
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // returns 'lastID' and 'changes'
    });
  });
};

module.exports = {
  db,
  dbGet,
  dbAll,
  dbRun
};
