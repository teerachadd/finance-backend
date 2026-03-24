const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, seedDefaultCategories } = require('../config/database');

function register(req, res) {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
        if (existing) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        const salt = bcrypt.genSaltSync(10);
        const password_hash = bcrypt.hashSync(password, salt);

        const result = db.prepare(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
        ).run(username, email, password_hash);

        // Seed default categories for new user
        seedDefaultCategories(result.lastInsertRowid);

        const token = jwt.sign(
            { id: result.lastInsertRowid, username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Account created successfully.',
            token,
            user: { id: result.lastInsertRowid, username, email, daily_amount: 0 }
        });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login successful.',
            token,
            user: { id: user.id, username: user.username, email: user.email, daily_amount: user.daily_amount }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function updateDailyAmount(req, res) {
    try {
        const { daily_amount } = req.body;
        if (daily_amount === undefined || daily_amount < 0) {
            return res.status(400).json({ error: 'Valid daily amount is required.' });
        }

        db.prepare('UPDATE users SET daily_amount = ? WHERE id = ?').run(daily_amount, req.user.id);

        res.json({ message: 'Daily amount updated.', daily_amount });
    } catch (err) {
        console.error('Update daily amount error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function getProfile(req, res) {
    try {
        const user = db.prepare('SELECT id, username, email, daily_amount, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { register, login, updateDailyAmount, getProfile };
