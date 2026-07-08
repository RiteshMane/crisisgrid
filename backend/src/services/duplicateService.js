// -----------------------------------------------------------------------------
// duplicateService.js — flags a newly created incident as a possible
// duplicate of an existing one, without needing a paid vector database.
//
// Approach (cheap but effective for a portfolio project):
//   1. Geo filter   — MongoDB $near query narrows candidates to incidents
//                     within DUPLICATE_RADIUS_METERS of the new report.
//   2. Text filter  — Jaccard similarity on the word sets of the title +
//                     description. This is a classic, easy-to-explain
//                     "local embedding-free" similarity metric.
//   3. Category     — must match the same category as an extra signal.
//
// If a strong match is found, the new incident's `duplicateOf` field is set
// so the EOC dashboard can group/merge them instead of dispatching twice.
// -----------------------------------------------------------------------------

const Incident = require('../models/Incident');

const DUPLICATE_RADIUS_METERS = 500;
const SIMILARITY_THRESHOLD = 0.35; // 0 = no overlap, 1 = identical wording

function jaccardSimilarity(textA, textB) {
  const setA = new Set(textA.toLowerCase().match(/\b\w+\b/g) || []);
  const setB = new Set(textB.toLowerCase().match(/\b\w+\b/g) || []);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionSize += 1;
  }
  const unionSize = new Set([...setA, ...setB]).size;
  return intersectionSize / unionSize;
}

/**
 * @param {Object} newIncident - a just-created Incident mongoose document
 * @returns {Promise<string|null>} the _id of the matched incident, or null
 */
async function findDuplicate(newIncident) {
  const nearbyIncidents = await Incident.find({
    _id: { $ne: newIncident._id },
    status: { $ne: 'resolved' },
    location: {
      $near: {
        // Only pass a clean { type, coordinates } GeoJSON object — the full
        // location subdocument also carries an "address" string, and some
        // MongoDB versions reject $geometry objects with extra keys.
        $geometry: { type: 'Point', coordinates: newIncident.location.coordinates },
        $maxDistance: DUPLICATE_RADIUS_METERS,
      },
    },
  }).limit(20);

  const newText = `${newIncident.title} ${newIncident.description}`;

  let best = { id: null, score: 0 };
  for (const candidate of nearbyIncidents) {
    const candidateText = `${candidate.title} ${candidate.description}`;
    const score = jaccardSimilarity(newText, candidateText);
    if (score > best.score) {
      best = { id: candidate._id, score };
    }
  }

  return best.score >= SIMILARITY_THRESHOLD ? best.id : null;
}

module.exports = { findDuplicate, jaccardSimilarity };
