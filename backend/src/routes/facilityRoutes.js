const express = require('express');
const { getFacilities, getMyFacility, createFacility, updateCapacity } = require('../controllers/facilityController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', getFacilities); // public-ish: anyone logged in can see shelters/hospitals
router.use(protect);
router.get('/mine', authorize('hospital', 'shelter'), getMyFacility);
router.post('/', authorize('eoc', 'admin', 'hospital', 'shelter'), createFacility);
router.patch('/:id/capacity', authorize('eoc', 'admin', 'shelter', 'hospital'), updateCapacity);

module.exports = router;
