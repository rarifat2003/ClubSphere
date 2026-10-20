const express = require('express');
const crypto = require('crypto');
const db = require('../db').promise();

const router = express.Router();

// ---- password helpers (built-in crypto, no extra package) ----
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

// POST /auth/register  -> creates a club AND its first user (one transaction)
router.post('/register', async (req, res) => {
  const { name, club_name, email, password } = req.body;
  if (!name || !club_name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [club] = await conn.query('INSERT INTO clubs (club_name) VALUES (?)', [club_name]);
    const [user] = await conn.query(
      'INSERT INTO users (club_id, name, email, password) VALUES (?, ?, ?, ?)',
      [club.insertId, name, email, hashPassword(password)]
    );
    await conn.commit();

    req.session.userId = user.insertId;
    req.session.clubId = club.insertId;
    res.json({ message: 'Registered' });
  } catch (err) {
    await conn.rollback();   // if the user insert fails, the club insert is undone too
    throw err;
  } finally {
    conn.release();
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (rows.length === 0 || !verifyPassword(password || '', rows[0].password)) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  req.session.userId = rows[0].user_id;
  req.session.clubId = rows[0].club_id;
  res.json({ message: 'Logged in' });
});

// GET /auth/me  -> who is logged in (JOIN users + clubs)
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  const [rows] = await db.query(
    `SELECT u.name, u.email, c.club_name
     FROM users u JOIN clubs c ON c.club_id = u.club_id
     WHERE u.user_id = ?`,
    [req.session.userId]
  );
  res.json(rows[0]);
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

module.exports = router;