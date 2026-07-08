// -----------------------------------------------------------------------------
// Incident.js — the central entity of CrisisGrid.
//
// An "incident" covers SOS calls, disaster reports, and resource requests —
// they all share the same shape (who, where, what, how urgent) so we model
// them as one collection distinguished by `type`. This mirrors how a real
// emergency-dispatch system (e.g. CAD software) typically works.
// -----------------------------------------------------------------------------

const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['sos', 'incident_report', 'missing_person', 'resource_request'],
      default: 'incident_report',
    },

    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    // Set by the citizen initially, then possibly overridden by AI / EOC staff.
    category: {
      type: String,
      enum: ['flood', 'fire', 'earthquake', 'medical', 'structural', 'other'],
      default: 'other',
    },

    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    status: {
      type: String,
      enum: ['reported', 'acknowledged', 'dispatched', 'in_progress', 'resolved', 'merged', 'rejected'],
      default: 'reported',
    },

    // GeoJSON Point so we can run $near / $geoWithin queries (duplicate
    // detection, "incidents near me", map bounding-box queries, etc.)
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      address: { type: String, trim: true },
    },

    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Populated by the AI service (Gemini or the offline mock fallback).
    aiAnalysis: {
      summary: { type: String, default: '' },
      suggestedSeverity: { type: String, default: '' },
      suggestedCategory: { type: String, default: '' },
      suggestedResources: [{ type: String }], // legacy free-text list, superseded by recommendedResources below
      recommendedResources: [{ name: String, qty: Number }], // deterministic dispatch checklist, see aiService.js
      etaMinutes: { type: Number, default: null },
      confidence: { type: Number, default: 50 }, // 0-100, feeds the trust score
      generatedAt: { type: Date },
      source: { type: String, enum: ['gemini', 'mock', 'none'], default: 'none' },
    },

    // ---- Multi-layer verification (fake-report defense) -------------------
    // The device location captured (with permission) when the report was
    // submitted, used only to sanity-check it against the claimed incident
    // location — never shown publicly, only to EOC/trust-score logic.
    reporterLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: null },
    },

    crowdVotes: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        vote: { type: String, enum: ['confirm', 'dispute'] },
        at: { type: Date, default: Date.now },
      },
    ],

    authorityVerification: {
      status: { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      note: { type: String, default: '' },
      at: { type: Date },
    },

    verification: {
      gpsScore: { type: Number, default: 50 },
      crowdScore: { type: Number, default: 50 },
      authorityScore: { type: Number, default: 40 },
      aiScore: { type: Number, default: 50 },
      trustScore: { type: Number, default: 45 },
      trustState: {
        type: String,
        enum: ['pending', 'suspicious', 'verified', 'highly_trusted'],
        default: 'pending',
      },
    },

    // Set automatically when a critical, non-suspicious incident hasn't
    // been acknowledged/dispatched yet — surfaced prominently on the EOC
    // dashboard so it can't get lost in a long incident queue.
    escalated: { type: Boolean, default: false },
    // ------------------------------------------------------------------------

    // If this incident was auto-detected as a duplicate of another one.
    duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },

    imageUrl: { type: String, default: '' },

    // A running log of status changes for the "incident timeline" feature.
    timeline: [
      {
        status: String,
        note: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],

    // Marks records created by the demo seed script so they can be reset/wiped
    // independently of real user data.
    isDemoData: { type: Boolean, default: false },
  },
  { timestamps: true }
);

incidentSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Incident', incidentSchema);
