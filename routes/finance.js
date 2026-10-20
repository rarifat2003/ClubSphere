const express = require('express');
const db = require('../db').promise();

const router = express.Router();

// READ: transaction history, optional filter
// GET /finance?type=income
router.get('/', async (req, res) => {
  let sql = `SELECT txn_id, type, category, amount, description, txn_date
             FROM finance
             WHERE club_id = ?`;
  const params = [req.session.clubId];

  if (req.query.type) {
    sql += ' AND type = ?';
    params.push(req.query.type);
  }
  sql += ' ORDER BY txn_date DESC, txn_id DESC';

  const [rows] = await db.query(sql, params);
  res.json(rows);
});

// READ: totals + per-category breakdown (SUM, COUNT, GROUP BY)
router.get('/summary', async (req, res) => {
  const club = req.session.clubId;

  const [[totals]] = await db.query(
    `SELECT COALESCE(SUM(CASE WHEN type = 'income'  THEN amount END), 0) AS income,
            COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) AS expense
     FROM finance WHERE club_id = ?`,
    [club]
  );

  const [byCategory] = await db.query(
    `SELECT type, category, COUNT(*) AS count, SUM(amount) AS total
     FROM finance
     WHERE club_id = ?
     GROUP BY type, category
     ORDER BY type, total DESC`,
    [club]
  );

  res.json({ income: totals.income, expense: totals.expense, byCategory });
});

// CREATE
router.post('/', async (req, res) => {
  const { type, category, amount, description, txn_date } = req.body;
  const [result] = await db.query(
    `INSERT INTO finance (club_id, type, category, amount, description, txn_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.session.clubId, type, category, amount, description || null, txn_date]
  );
  res.json({ txn_id: result.insertId });
});

// UPDATE
router.put('/:id', async (req, res) => {
  const { type, category, amount, description, txn_date } = req.body;
  const [result] = await db.query(
    `UPDATE finance
     SET type = ?, category = ?, amount = ?, description = ?, txn_date = ?
     WHERE txn_id = ? AND club_id = ?`,
    [type, category, amount, description || null, txn_date, req.params.id, req.session.clubId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ message: 'Updated' });
});

// DELETE
router.delete('/:id', async (req, res) => {
  const [result] = await db.query(
    'DELETE FROM finance WHERE txn_id = ? AND club_id = ?',
    [req.params.id, req.session.clubId]
  );
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ message: 'Deleted' });
});

module.exports = router;