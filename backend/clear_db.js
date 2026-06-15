require('dotenv').config({ path: '../.env' });
const { db } = require('./db.js');

async function clearDatabase() {
  try {
    console.log('Connecting to database...');
    const client = await db.connect();
    
    console.log('Truncating tables...');
    await client.query(`
      TRUNCATE TABLE 
        users, 
        refresh_tokens, 
        rooms, 
        tasks, 
        study_sessions, 
        friendships, 
        user_badges 
      CASCADE;
    `);
    
    console.log('Database successfully cleared!');
    client.release();
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  }
}

clearDatabase();
