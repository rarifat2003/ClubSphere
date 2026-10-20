const express = require('express');
const db = require('../db').promise();

const router = express.Router();

// GET /dashboard-data -> summary numbers built from aggregate queries
router.get('/', async (req, res) => {
  const club = req.session.clubId;

  const [[squad]] = await db.query(
    `SELECT COUNT(*) AS total, ROUND(AVG(p.rating), 1) AS avg_rating
     FROM squad s JOIN players p ON p.player_id = s.player_id
     WHERE s.club_id = ?`,
    [club]
  );

  const [[record]] = await db.query(
    `SELECT COUNT(*) AS played,
            COALESCE(SUM(goals_for > goals_against), 0)  AS wins,
            COALESCE(SUM(goals_for = goals_against), 0)  AS draws,
            COALESCE(SUM(goals_for < goals_against), 0)  AS losses,
            COALESCE(SUM(goals_for), 0)                  AS scored,
            COALESCE(SUM(goals_against), 0)              AS conceded
     FROM matches
     WHERE club_id = ? AND goals_for IS NOT NULL`,
    [club]
  );

  const [[money]] = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM finance WHERE club_id = ?`,
    [club]
  );

  const [topScorer] = await db.query(
    `SELECT g.name, g.total_goals AS goals
     FROM squad s JOIN v_player_goals g ON g.player_id = s.player_id
     WHERE s.club_id = ? AND g.total_goals > 0
     ORDER BY g.total_goals DESC LIMIT 1`,
    [club]
  );

  const [nextMatch] = await db.query(
    `SELECT opponent, match_date FROM matches
     WHERE club_id = ? AND goals_for IS NULL AND match_date >= CURDATE()
     ORDER BY match_date LIMIT 1`,
    [club]
  );

  res.json({
    squad,
    record,
    money,
    topScorer: topScorer[0] || null,
    nextMatch: nextMatch[0] || null
  });
});

module.exports = router;