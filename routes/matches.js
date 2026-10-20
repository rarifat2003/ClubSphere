const express = require('express');
const db = require('../db').promise();

const router = express.Router();

// READ: all matches, result computed in SQL with CASE
router.get('/', async (req, res) => {
  const [rows] = await db.query(
    `SELECT match_id, opponent, match_date, venue, goals_for, goals_against,
            CASE
              WHEN goals_for IS NULL            THEN 'Upcoming'
              WHEN goals_for > goals_against    THEN 'Win'
              WHEN goals_for = goals_against    THEN 'Draw'
              ELSE 'Loss'
            END AS result
     FROM matches
     WHERE club_id = ?
     ORDER BY match_date DESC`,
    [req.session.clubId]
  );
  res.json(rows);
});

// CREATE
router.post('/', async (req, res) => {
  const { opponent, match_date, venue, goals_for, goals_against } = req.body;
  const [result] = await db.query(
    `INSERT INTO matches (club_id, opponent, match_date, venue, goals_for, goals_against)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.session.clubId, opponent, match_date, venue || null, goals_for ?? null, goals_against ?? null]
  );
  res.json({ match_id: result.insertId });
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { opponent, match_date, venue, goals_for, goals_against } = req.body;
  const [result] = await db.query(
    `UPDATE matches
     SET opponent = ?, match_date = ?, venue = ?, goals_for = ?, goals_against = ?
     WHERE match_id = ? AND club_id = ?`,
    [opponent, match_date, venue || null, goals_for ?? null, goals_against ?? null,
      req.params.id, req.session.clubId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Match not found' });
  res.json({ message: 'Updated' });
});

// DELETE (player_matches rows cascade)
router.delete('/:id', async (req, res) => {
  const [result] = await db.query(
    'DELETE FROM matches WHERE match_id = ? AND club_id = ?',
    [req.params.id, req.session.clubId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Match not found' });
  res.json({ message: 'Deleted' });
});

// ---------- Player goals in a match (player_matches table) ----------

// READ: who scored in this match (JOIN player_matches + players + matches)
router.get('/:id/goals', async (req, res) => {
  const [rows] = await db.query(
    `SELECT pm.player_id, p.name, p.position, pm.goals
     FROM player_matches pm
     JOIN players p ON p.player_id = pm.player_id
     JOIN matches m ON m.match_id  = pm.match_id
     WHERE pm.match_id = ? AND m.club_id = ?
     ORDER BY pm.goals DESC, p.name`,
    [req.params.id, req.session.clubId]
  );
  res.json(rows);
});

// CREATE or UPDATE a player's goals (upsert on the composite primary key)
router.post('/:id/goals', async (req, res) => {
  const { player_id, goals } = req.body;

  // the match must be mine AND the player must be in my squad
  const [ok] = await db.query(
    `SELECT 1
     FROM squad s JOIN matches m ON m.club_id = s.club_id
     WHERE s.player_id = ? AND m.match_id = ? AND s.club_id = ?`,
    [player_id, req.params.id, req.session.clubId]
  );
  if (ok.length === 0) {
    return res.status(404).json({ error: 'Match not found, or player is not in your squad' });
  }

  await db.query(
    `INSERT INTO player_matches (player_id, match_id, goals)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE goals = VALUES(goals)`,
    [player_id, req.params.id, goals || 0]
  );
  res.json({ message: 'Saved' });
});

// DELETE one player's goal record for the match
router.delete('/:id/goals/:playerId', async (req, res) => {
  const [result] = await db.query(
    `DELETE pm FROM player_matches pm
     JOIN matches m ON m.match_id = pm.match_id
     WHERE pm.match_id = ? AND pm.player_id = ? AND m.club_id = ?`,
    [req.params.id, req.params.playerId, req.session.clubId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Removed' });
});

module.exports = router;