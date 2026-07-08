const express = require('express');
const { getSituationSummary, classifyDraft, chat } = require('../controllers/aiController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/situation-summary', authorize('eoc', 'admin'), getSituationSummary);
router.post('/classify', classifyDraft); // any logged-in role can preview a classification
router.post('/chat', chat); // any logged-in role — behavior branches by role inside the controller

module.exports = router;
