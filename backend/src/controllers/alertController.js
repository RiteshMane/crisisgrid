// -----------------------------------------------------------------------------
// alertController.js — the EOC's "top bar" broadcast notification, e.g. a
// flash-flood warning. Broadcasts instantly over Socket.IO to every open
// dashboard, and is also fetchable on page load so a fresh page load still
// shows an active alert someone missed.
// -----------------------------------------------------------------------------

const asyncHandler = require('express-async-handler');
const Alert = require('../models/Alert');
const { getIO } = require('../services/socketService');

// @route GET /api/alerts/active
// @access any authenticated user
const getActiveAlerts = asyncHandler(async (req, res) => {
  const alerts = await Alert.find({ active: true }).sort({ createdAt: -1 }).limit(5);
  res.json({ success: true, alerts });
});

// @route POST /api/alerts
// @access eoc, admin
const issueAlert = asyncHandler(async (req, res) => {
  const { message, severity } = req.body;
  if (!message) {
    res.status(400);
    throw new Error('message is required');
  }

  const alert = await Alert.create({
    message,
    severity: severity || 'warning',
    issuedBy: req.user._id,
  });

  getIO().emit('alert:new', alert);
  res.status(201).json({ success: true, alert });
});

// @route PATCH /api/alerts/:id/dismiss
// @access eoc, admin — retracts a broadcast (e.g. the warning has passed)
const dismissAlert = asyncHandler(async (req, res) => {
  const alert = await Alert.findById(req.params.id);
  if (!alert) {
    res.status(404);
    throw new Error('Alert not found');
  }
  alert.active = false;
  await alert.save();

  getIO().emit('alert:dismissed', { _id: alert._id });
  res.json({ success: true, alert });
});

module.exports = { getActiveAlerts, issueAlert, dismissAlert };
