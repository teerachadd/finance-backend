const express = require('express');
const { getDailySummary, getMonthlySummary, getOverview } = require('../controllers/summaryController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/daily', getDailySummary);
router.get('/monthly', getMonthlySummary);
router.get('/overview', getOverview);

module.exports = router;
