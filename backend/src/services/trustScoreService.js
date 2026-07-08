// -----------------------------------------------------------------------------
// trustScoreService.js — computes CrisisGrid's fake-report defense: a 0-100
// trust score built from four independent signals, so no single fooled
// signal (e.g. a convincing paragraph of AI-fooling text) can fully fake a
// "verified" report on its own.
//
// Weights (matches the product spec): GPS 30%, Crowd 25%, Authority 25%, AI 20%
// -----------------------------------------------------------------------------

const { distanceMeters } = require('../utils/geo');

const WEIGHTS = { gps: 0.3, crowd: 0.25, authority: 0.25, ai: 0.2 };

// GPS score: full marks if the reporter's device was within 150m of the
// claimed incident location (GPS drift + "reporting from just outside the
// hazard zone" are both normal), decaying linearly to 0 by 5km away.
// If no reporter location was captured (permission denied / no support),
// we return a neutral middle score rather than punishing or rewarding it —
// we simply don't have that signal.
function computeGpsScore(reporterCoords, incidentCoords) {
  if (!reporterCoords) return 50;
  const dist = distanceMeters(reporterCoords, incidentCoords);
  if (dist <= 150) return 100;
  if (dist >= 5000) return 0;
  return Math.round(100 - ((dist - 150) / (5000 - 150)) * 100);
}

// Crowd score: net confirmations vs disputes, scaled into 0-100 with a
// neutral 50 baseline until enough votes come in (avoids one early dispute
// tanking the score to 0 before anyone else has weighed in).
function computeCrowdScore(votes = []) {
  if (votes.length === 0) return 50;
  const confirms = votes.filter((v) => v.vote === 'confirm').length;
  const disputes = votes.filter((v) => v.vote === 'dispute').length;
  const net = confirms - disputes;
  const total = confirms + disputes;
  // net/total ranges -1..1; map to 0..100
  return Math.round(50 + (net / total) * 50);
}

// Authority score: binary in practice (a trained responder either confirmed
// it or hasn't looked at it yet) — explicit rejection scores 0.
function computeAuthorityScore(authorityVerification) {
  if (!authorityVerification || authorityVerification.status === 'pending') return 40;
  if (authorityVerification.status === 'confirmed') return 100;
  return 0; // 'rejected'
}

// AI score: reuses the confidence value the AI classifier already returns
// (see aiService.js) — how confidently it could match the report text to a
// known incident pattern. Vague/contradictory/spammy text scores lower.
function computeAiScore(aiAnalysis) {
  if (!aiAnalysis || aiAnalysis.confidence === undefined) return 50;
  return aiAnalysis.confidence;
}

function trustStateFromScore(score, authorityVerification) {
  if (authorityVerification?.status === 'rejected') return 'suspicious';
  if (score >= 85 && authorityVerification?.status === 'confirmed') return 'highly_trusted';
  if (score >= 60) return 'verified';
  if (score <= 30) return 'suspicious';
  return 'pending';
}

/**
 * Recomputes the full verification block for an incident. Call this after
 * ANY of the four signals changes (new crowd vote, authority action, or at
 * creation time). Mutates and returns the `verification` object to assign
 * back onto the incident document.
 */
function computeTrustScore({ incidentCoords, reporterCoords, votes, authorityVerification, aiAnalysis }) {
  const gpsScore = computeGpsScore(reporterCoords, incidentCoords);
  const crowdScore = computeCrowdScore(votes);
  const authorityScore = computeAuthorityScore(authorityVerification);
  const aiScore = computeAiScore(aiAnalysis);

  const trustScore = Math.round(
    gpsScore * WEIGHTS.gps +
      crowdScore * WEIGHTS.crowd +
      authorityScore * WEIGHTS.authority +
      aiScore * WEIGHTS.ai
  );

  return {
    gpsScore,
    crowdScore,
    authorityScore,
    aiScore,
    trustScore,
    trustState: trustStateFromScore(trustScore, authorityVerification),
  };
}

// Simple escalation rule, run right after every trust-score recompute:
// a high-trust CRITICAL incident that hasn't been dispatched yet should
// grab a human's attention immediately rather than wait in a queue.
function shouldEscalate({ severity, status, trustState }) {
  return severity === 'critical' && trustState !== 'suspicious' && ['reported', 'acknowledged'].includes(status);
}

module.exports = { computeTrustScore, shouldEscalate };
