const { db } = require('../config/database');

function getAll(req, res) {
    try {
        const { month } = req.query;
        let query = `
      SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ?
    `;
        const params = [req.user.id];

        if (month) {
            query += ' AND b.month = ?';
            params.push(month);
        }

        query += ' ORDER BY c.name';

        const budgets = db.prepare(query).all(...params);

        // Enrich each budget with spent amount
        const enriched = budgets.map(b => {
            const monthStart = b.month + '-01';
            const monthEnd = b.month + '-31';
            const spent = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ? AND category_id = ? AND date >= ? AND date <= ?
      `).get(req.user.id, b.category_id, monthStart, monthEnd);

            return {
                ...b,
                spent: spent.total,
                remaining: b.amount - spent.total,
                over_budget: spent.total > b.amount
            };
        });

        res.json(enriched);
    } catch (err) {
        console.error('Get budgets error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function createOrUpdate(req, res) {
    try {
        const { category_id, amount, month } = req.body;

        if (!category_id || !amount || !month) {
            return res.status(400).json({ error: 'Category, amount, and month are required.' });
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Budget amount must be greater than 0.' });
        }

        const cat = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.id);
        if (!cat) return res.status(400).json({ error: 'Invalid category.' });

        // Upsert
        db.prepare(`
      INSERT INTO budgets (user_id, category_id, amount, month)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, category_id, month)
      DO UPDATE SET amount = excluded.amount
    `).run(req.user.id, category_id, amount, month);

        const budget = db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.category_id = ? AND b.month = ?
    `).get(req.user.id, category_id, month);

        // Add spent info
        const monthStart = month + '-01';
        const monthEnd = month + '-31';
        const spent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND category_id = ? AND date >= ? AND date <= ?
    `).get(req.user.id, category_id, monthStart, monthEnd);

        res.status(201).json({
            ...budget,
            spent: spent.total,
            remaining: budget.amount - spent.total,
            over_budget: spent.total > budget.amount
        });
    } catch (err) {
        console.error('Create/update budget error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function remove(req, res) {
    try {
        const existing = db.prepare('SELECT * FROM budgets WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Budget not found.' });

        db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Budget deleted.' });
    } catch (err) {
        console.error('Delete budget error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getAll, createOrUpdate, remove };
