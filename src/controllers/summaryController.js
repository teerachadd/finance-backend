const { db } = require('../config/database');

function getDailySummary(req, res) {
    try {
        const { date } = req.query;
        const targetDate = date || new Date().toISOString().split('T')[0];

        const user = db.prepare('SELECT daily_amount FROM users WHERE id = ?').get(req.user.id);

        const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND date = ?
    `).get(req.user.id, targetDate);

        const byCategory = db.prepare(`
      SELECT c.name, c.color, c.icon, COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date = ?
      GROUP BY c.id
      ORDER BY total DESC
    `).all(req.user.id, targetDate);

        res.json({
            date: targetDate,
            daily_amount: user.daily_amount,
            total_spent: expenses.total,
            remaining: user.daily_amount - expenses.total,
            by_category: byCategory
        });
    } catch (err) {
        console.error('Daily summary error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function getMonthlySummary(req, res) {
    try {
        const { month } = req.query;
        const targetMonth = month || new Date().toISOString().slice(0, 7);
        const monthStart = targetMonth + '-01';
        const monthEnd = targetMonth + '-31';

        const user = db.prepare('SELECT daily_amount FROM users WHERE id = ?').get(req.user.id);

        // Days in month
        const [year, mon] = targetMonth.split('-').map(Number);
        const daysInMonth = new Date(year, mon, 0).getDate();

        const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(req.user.id, monthStart, monthEnd);

        const byCategory = db.prepare(`
      SELECT c.name, c.color, c.icon, COALESCE(SUM(t.amount), 0) as total, COUNT(t.id) as count
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
      GROUP BY c.id
      ORDER BY total DESC
    `).all(req.user.id, monthStart, monthEnd);

        const dailyBreakdown = db.prepare(`
      SELECT date, COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ? AND date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date
    `).all(req.user.id, monthStart, monthEnd);

        res.json({
            month: targetMonth,
            monthly_budget: user.daily_amount * daysInMonth,
            total_spent: expenses.total,
            transaction_count: expenses.count,
            daily_average: expenses.count > 0 ? expenses.total / daysInMonth : 0,
            remaining: (user.daily_amount * daysInMonth) - expenses.total,
            by_category: byCategory,
            daily_breakdown: dailyBreakdown
        });
    } catch (err) {
        console.error('Monthly summary error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

function getOverview(req, res) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = today.slice(0, 7);
        const monthStart = currentMonth + '-01';
        const monthEnd = currentMonth + '-31';

        const user = db.prepare('SELECT daily_amount FROM users WHERE id = ?').get(req.user.id);

        const todaySpent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions WHERE user_id = ? AND date = ?
    `).get(req.user.id, today);

        const monthSpent = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions WHERE user_id = ? AND date >= ? AND date <= ?
    `).get(req.user.id, monthStart, monthEnd);

        const recentTransactions = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT 5
    `).all(req.user.id);

        // Budget alerts
        const budgets = db.prepare(`
      SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM budgets b
      JOIN categories c ON b.category_id = c.id
      WHERE b.user_id = ? AND b.month = ?
    `).all(req.user.id, currentMonth);

        const alerts = budgets.map(b => {
            const spent = db.prepare(`
        SELECT COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE user_id = ? AND category_id = ? AND date >= ? AND date <= ?
      `).get(req.user.id, b.category_id, monthStart, monthEnd);

            const percentage = b.amount > 0 ? (spent.total / b.amount) * 100 : 0;
            return {
                category_name: b.category_name,
                category_color: b.category_color,
                category_icon: b.category_icon,
                budget: b.amount,
                spent: spent.total,
                percentage: Math.round(percentage),
                over_budget: spent.total > b.amount
            };
        }).filter(a => a.percentage >= 80);

        const topCategories = db.prepare(`
      SELECT c.name, c.color, c.icon, COALESCE(SUM(t.amount), 0) as total
      FROM transactions t
      JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
      GROUP BY c.id
      ORDER BY total DESC
      LIMIT 5
    `).all(req.user.id, monthStart, monthEnd);

        res.json({
            today: {
                date: today,
                daily_amount: user.daily_amount,
                spent: todaySpent.total,
                remaining: user.daily_amount - todaySpent.total
            },
            month: {
                month: currentMonth,
                spent: monthSpent.total
            },
            recent_transactions: recentTransactions,
            budget_alerts: alerts,
            top_categories: topCategories
        });
    } catch (err) {
        console.error('Overview error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
}

module.exports = { getDailySummary, getMonthlySummary, getOverview };
