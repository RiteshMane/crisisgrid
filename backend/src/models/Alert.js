// -----------------------------------------------------------------------------
// Alert.js — a broadcast notification the EOC can issue to every connected
// user (e.g. "Flash flood warning — evacuate low-lying areas near Hindmata").
// Kept intentionally simple: no per-user targeting/geofencing yet (see
// README roadmap — SMS/push geofencing was flagged as a bigger feature).
// -----------------------------------------------------------------------------

const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    message: { type: String, required: true, trim: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'warning' },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Alert', alertSchema);
