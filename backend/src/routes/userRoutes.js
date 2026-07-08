const express = require('express');
const {
  getDirectory,
  getVerificationDocument,
  reviewVerificationDocument,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect, authorize('eoc', 'admin'));

router.get('/directory', getDirectory);
router.get('/:id/document', getVerificationDocument);
router.patch('/:id/verify-document', reviewVerificationDocument);

module.exports = router;
