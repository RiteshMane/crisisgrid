// -----------------------------------------------------------------------------
// userController.js — powers two EOC-only features:
//   1. A live directory of every responder org (hospitals, shelters, rescue
//      teams, NGOs) with contact info, so dispatch never has to leave the
//      dashboard to find a phone number.
//   2. Reviewing the "verification document" each of those orgs uploaded at
//      signup — approve/reject stands in for a government official's check.
// -----------------------------------------------------------------------------

const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Facility = require('../models/Facility');

const DIRECTORY_ROLES = ['eoc', 'hospital', 'shelter', 'rescue_team', 'ngo', 'volunteer'];

// @route GET /api/users/directory
// @access eoc, admin
const getDirectory = asyncHandler(async (req, res) => {
  const users = await User.find({ role: { $in: DIRECTORY_ROLES } }).sort({ role: 1, name: 1 });

  // Attach each hospital/shelter's live facility record (capacity, status)
  // so the directory doubles as a live capacity board, not just a phonebook.
  const facilities = await Facility.find({ managedBy: { $in: users.map((u) => u._id) } });
  const facilityByManager = new Map(facilities.map((f) => [f.managedBy.toString(), f]));

  const directory = users.map((user) => ({
    _id: user._id,
    name: user.name,
    role: user.role,
    organizationName: user.organizationName,
    phone: user.phone,
    documentStatus: user.verificationDocument?.status || 'not_submitted',
    facility: facilityByManager.get(user._id.toString()) || null,
  }));

  res.json({ success: true, count: directory.length, directory });
});

// @route GET /api/users/:id/document
// @access eoc, admin — separate from the directory list so the (potentially
// large) base64 image is only fetched when someone actually opens it.
const getVerificationDocument = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name organizationName verificationDocument');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }
  res.json({ success: true, user });
});

// @route PATCH /api/users/:id/verify-document
// @access eoc, admin
const reviewVerificationDocument = asyncHandler(async (req, res) => {
  const { status, note } = req.body; // 'approved' | 'rejected'
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400);
    throw new Error("status must be 'approved' or 'rejected'");
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  user.verificationDocument.status = status;
  user.verificationDocument.reviewedBy = req.user._id;
  user.verificationDocument.reviewNote = note || '';
  user.verificationDocument.reviewedAt = new Date();
  await user.save();

  res.json({ success: true, user });
});

module.exports = { getDirectory, getVerificationDocument, reviewVerificationDocument };
