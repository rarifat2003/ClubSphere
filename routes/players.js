const express = require('express');
const db = require('../db').promise();

const router = express.Router();

// READ ONLY: the regional player pool, with signing status (LEFT JOINs).
// Club owners cannot add, edit or delete pool players.
// They can only sign free players (see routes/squad.js).
// GET /players?search=ali&position=Forward&status=Free
router.get('/', async (req, res) => {
  const { search, position, status } = req.query;
  let sql = `SELECT p.player_id, p.name, p.position, p.rating, p.region,
                    c.club_name,
                    CASE WHEN s.club_id IS NULL THEN 'Free'
                         WHEN s.club_id = ?     THEN 'MySquad'
                         ELSE 'Signed' END AS status
             FROM players p
             LEFT JOIN squad s ON s.player_id = p.player_id
             LEFT JOIN clubs c ON c.club_id   = s.club_id
             WHERE 1 = 1`;
  const params = [req.session.clubId];

  if (search) {
    sql += ' AND p.name LIKE ?';
    params.push(`%${search}%`);
  }
  if (position) {
    sql += ' AND p.position = ?';
    params.push(position);
  }
  if (status === 'Free') {
    sql += ' AND s.club_id IS NULL';
  }
  sql += ' ORDER BY p.rating DESC, p.name';

  const [rows] = await db.query(sql, params);
  res.json(rows);
});

module.exports = router;