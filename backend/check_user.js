require('dotenv').config({ path: '../.env' });
const { db } = require('./db.js');

async function checkUser() {
  try {
    const client = await db.connect();
    const res = await client.query(`SELECT * FROM users;`);
    console.log("Users in DB:", res.rows);
    client.release();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUser();
