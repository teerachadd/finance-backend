const { db } = require('../config/database');

function getAll(req, res) {
    try {
        const { category_id, start_date, end_date } = req.query;
        let query = `
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
    `;
        const params = [req.user.id];

        if (category_id) {
            query += ' AND t.category_id = ?';
            params.push(category_id);
        }
        if (start_date) {
            query += ' AND t.date >= ?';
            params.push(start_date);
        }
        if (end_date) {
            query += ' AND t.date <= ?';
            params.push(end_date);
        }

        query += ' ORDER BY t.date DESC, t.created_at DESC';

        const transactions = db.prepare(query).all(...params);
        res.json(transactions);
    } catch (err) {
        console.error('Get transactions error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function getById(req, res) {
    try {
        const transaction = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ? AND t.user_id = ?
    `).get(req.params.id, req.user.id);

        if (!transaction) return res.status(404).json({ error: 'Transaction not found.' });
        res.json(transaction);
    } catch (err) {
        console.error('Get transaction error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function create(req, res) {
    try {
        const { category_id, amount, note, date } = req.body;

        if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount is required.' });
        if (!date) return res.status(400).json({ error: 'Date is required.' });

        if (category_id) {
            const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.id);
            if (!cat) return res.status(400).json({ error: 'Invalid category.' });
        }

        const result = db.prepare(
            'INSERT INTO transactions (user_id, category_id, amount, note, date) VALUES (?, ?, ?, ?, ?)'
        ).run(req.user.id, category_id || null, amount, note || '', date);

        const transaction = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

        res.status(201).json(transaction);
    } catch (err) {
        console.error('Create transaction error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function update(req, res) {
    try {
        const { category_id, amount, note, date } = req.body;
        const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Transaction not found.' });

        if (category_id) {
            const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.id);
            if (!cat) return res.status(400).json({ error: 'Invalid category.' });
        }

        db.prepare(
            'UPDATE transactions SET category_id = ?, amount = ?, note = ?, date = ? WHERE id = ? AND user_id = ?'
        ).run(
            category_id !== undefined ? category_id : existing.category_id,
            amount || existing.amount,
            note !== undefined ? note : existing.note,
            date || existing.date,
            req.params.id,
            req.user.id
        );

        const transaction = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(req.params.id);

        res.json(transaction);
    } catch (err) {
        console.error('Update transaction error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function remove(req, res) {
    try {
        const existing = db.prepare('SELECT * FROM transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Transaction not found.' });

        db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Transaction deleted.' });
    } catch (err) {
        console.error('Delete transaction error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getAll, getById, create, update, remove };
