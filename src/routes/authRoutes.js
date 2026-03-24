const express = require('express');
const { register, login, updateDailyAmount, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.put('/daily-amount', authenticate, updateDailyAmount);

module.exports = router;
