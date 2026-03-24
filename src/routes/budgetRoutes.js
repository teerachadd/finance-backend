const express = require('express');
const { getAll, createOrUpdate, remove } = require('../controllers/budgetController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);
router.get('/', getAll);
router.post('/', createOrUpdate);
router.delete('/:id', remove);

module.exports = router;
