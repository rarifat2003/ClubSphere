const express = require('express');
const db = require('../db').promise();

const router = express.Router();

// READ: my club's current squad + goal totals (JOIN with the view)
router.get('/', async (req, res) => {
    const [rows] = await db.query(
        `SELECT p.player_id, p.name, p.position, p.rating, p.region,
            s.signed_date, s.fee,
            g.matches_played, g.total_goals
     FROM squad s
     JOIN players p        ON p.player_id = s.player_id
     JOIN v_player_goals g ON g.player_id = s.player_id
     WHERE s.club_id = ?
     ORDER BY g.total_goals DESC, p.rating DESC, p.name`,
        [req.session.clubId]
    );
    res.json(rows);
});

// CREATE: sign an existing free player from the pool into my squad
router.post('/', async (req, res) => {
    const { player_id } = req.body;

    const [exists] = await db.query('SELECT 1 FROM players WHERE player_id = ?', [player_id]);
    if (exists.length === 0) return res.status(404).json({ error: 'Player not found' });

    const [taken] = await db.query('SELECT club_id FROM squad WHERE player_id = ?', [player_id]);
    if (taken.length > 0) {
        return res.status(400).json({ error: 'This player is already signed to a club' });
    }

    await db.query(
        'INSERT INTO squad (player_id, club_id, signed_date) VALUES (?, ?, CURDATE())',
        [player_id, req.session.clubId]
    );
    res.json({ message: 'Player signed' });
});

// CREATE: add a brand-new player straight into my squad, with a signing fee.
// One transaction does three things:
//   1. adds the player to the RegionX pool (players table)
//   2. puts him in my squad with the fee (squad table)
//   3. records the fee as an expense (finance table)
// If any step fails, everything is rolled back.
router.post('/new', async (req, res) => {
    const { name, position, rating, fee } = req.body;
    if (!name || !position || !rating) {
        return res.status(400).json({ error: 'Name, position and rating are required' });
    }
    const feeAmount = Number(fee) || 0;
    if (feeAmount < 0) return res.status(400).json({ error: 'Fee cannot be negative' });

    const [dup] = await db.query(
        'SELECT 1 FROM players WHERE name = ? AND region = ?',
        [name, 'RegionX']
    );
    if (dup.length > 0) {
        return res.status(400).json({
            error: 'A player with this name already exists in RegionX. Sign him from the Player Pool instead.'
        });
    }

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [player] = await conn.query(
            'INSERT INTO players (name, position, rating, region) VALUES (?, ?, ?, ?)',
            [name, position, rating, 'RegionX']
        );

        await conn.query(
            'INSERT INTO squad (player_id, club_id, signed_date, fee) VALUES (?, ?, CURDATE(), ?)',
            [player.insertId, req.session.clubId, feeAmount]
        );

        if (feeAmount > 0) {
            await conn.query(
                `INSERT INTO finance (club_id, type, category, amount, description, txn_date)
         VALUES (?, 'expense', 'Player fee', ?, ?, CURDATE())`,
                [req.session.clubId, feeAmount, 'Signing fee: ' + name]
            );
        }

        await conn.commit();
        res.json({ player_id: player.insertId });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

// DELETE: release a player from my squad (he stays in the pool as a free agent)
router.delete('/:playerId', async (req, res) => {
    const [result] = await db.query(
        'DELETE FROM squad WHERE player_id = ? AND club_id = ?',
        [req.params.playerId, req.session.clubId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Player is not in your squad' });
    res.json({ message: 'Player released' });
});

module.exports = router;