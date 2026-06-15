require('dotenv').config({ path: '../.env' });
const { db } = require('./db.js');

async function checkSchema() {
  try {
    const client = await db.connect();
    const res = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users';
    `);
    console.log(res.rows);
    
    // Also check what a newly inserted user gets
    await client.query(`INSERT INTO users (id, username, email, password_hash) VALUES ('test_id', 'test_user', 'test@example.com', 'hash') ON CONFLICT DO NOTHING;`);
    const userRes = await client.query(`SELECT has_seen_welcome FROM users WHERE id = 'test_id';`);
    console.log("Test user has_seen_welcome:", userRes.rows);
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
