const express = require('express');
const {
  createIncident,
  getIncidents,
  getIncidentById,
  updateIncidentStatus,
  crowdVerify,
  authorityVerify,
} = require('../controllers/incidentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect); // every incident route requires a logged-in user

router.post('/', createIncident);
router.get('/', getIncidents);
router.get('/:id', getIncidentById);
router.patch('/:id/status', authorize('eoc', 'admin', 'rescue_team'), updateIncidentStatus);
router.post('/:id/crowd-verify', crowdVerify);
router.patch('/:id/authority-verify', authorize('eoc', 'admin', 'rescue_team'), authorityVerify);

module.exports = router;
