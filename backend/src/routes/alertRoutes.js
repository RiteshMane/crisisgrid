const express = require('express');
const { getActiveAlerts, issueAlert, dismissAlert } = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/active', getActiveAlerts); // any logged-in role can see active alerts
router.post('/', authorize('eoc', 'admin'), issueAlert);
router.patch('/:id/dismiss', authorize('eoc', 'admin'), dismissAlert);

module.exports = router;
