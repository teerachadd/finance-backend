const { db } = require('../config/database');

function getAll(req, res) {
    try {
        const categories = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY name').all(req.user.id);
        res.json(categories);
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function getById(req, res) {
    try {
        const category = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!category) return res.status(404).json({ error: 'Category not found.' });
        res.json(category);
    } catch (err) {
        console.error('Get category error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function create(req, res) {
    try {
        const { name, color, icon } = req.body;
        if (!name) return res.status(400).json({ error: 'Category name is required.' });

        const result = db.prepare(
            'INSERT INTO categories (user_id, name, color, icon) VALUES (?, ?, ?, ?)'
        ).run(req.user.id, name, color || '#6366f1', icon || '📁');

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(category);
    } catch (err) {
        console.error('Create category error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function update(req, res) {
    try {
        const { name, color, icon } = req.body;
        const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Category not found.' });

        db.prepare(
            'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ? AND user_id = ?'
        ).run(name || existing.name, color || existing.color, icon || existing.icon, req.params.id, req.user.id);

        const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
        res.json(category);
    } catch (err) {
        console.error('Update category error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function remove(req, res) {
    try {
        const existing = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        if (!existing) return res.status(404).json({ error: 'Category not found.' });

        db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ message: 'Category deleted.' });
    } catch (err) {
        console.error('Delete category error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getAll, getById, create, update, remove };
