// -----------------------------------------------------------------------------
// chatService.js — powers the bottom-right assistant widget. Deliberately
// rule-based (not a Gemini call) for the same reason resource recommendation
// is deterministic: the citizen-facing safety advice is life-safety content,
// and the EOC query parser only needs to map a handful of common phrasings
// onto a MongoDB filter — a keyword parser is transparent, instant, and
// free, and it's easy to explain exactly why it matched what it matched.
// (Swapping in Gemini for a fuzzier natural-language parse is a clean
// upgrade path — see the README roadmap.)
// -----------------------------------------------------------------------------

const CITIZEN_ADVICE_RULES = [
  {
    keywords: ['water', 'flood', 'flooding', 'drowning'],
    reply: 'Move to higher ground immediately. Avoid walking or driving through moving water — 15cm can knock you off your feet.',
  },
  {
    keywords: ['fire', 'smoke', 'burning'],
    reply: 'Evacuate immediately. Do not use elevators. Stay low if there is smoke, and cover your nose and mouth with a damp cloth.',
  },
  {
    keywords: ['earthquake', 'shaking', 'building collapse', 'collapsed', 'trapped'],
    reply: 'Take cover under sturdy furniture and stay away from windows. Do not use elevators. If trapped, tap on a pipe or wall to signal your location.',
  },
  {
    keywords: ['injured', 'bleeding', 'unconscious', 'medical', 'heart attack', 'labor', 'pregnant'],
    reply: 'Call for medical help immediately using the SOS button. Keep the person still, calm, and warm while help is on the way.',
  },
];

const DEFAULT_ADVICE =
  'Stay calm and follow official advisories. If you are in immediate danger, use the SOS button to alert emergency services now.';

/**
 * Returns plain safety guidance text for a citizen's free-text message.
 * Pure function — no DB access — so it's trivially testable.
 */
function generateCitizenAdvice(message) {
  const text = (message || '').toLowerCase();
  const match = CITIZEN_ADVICE_RULES.find((rule) => rule.keywords.some((kw) => text.includes(kw)));
  return match ? match.reply : DEFAULT_ADVICE;
}

// ---------------------------------------------------------------------------
// EOC natural-language query parser — converts a handful of common phrasings
// ("show all unverified flood reports", "critical incidents that are still
// active") into a MongoDB filter object for the Incident collection.
// ---------------------------------------------------------------------------
const CATEGORY_SYNONYMS = {
  flood: ['flood', 'water', 'flooding'],
  fire: ['fire', 'burning', 'blaze'],
  earthquake: ['earthquake', 'quake'],
  medical: ['medical', 'injury', 'injured'],
  structural: ['structural', 'collapse', 'collapsed', 'building'],
};

function parseEOCQuery(message) {
  const text = (message || '').toLowerCase();
  const filter = {};
  const descriptionParts = [];

  // Severity
  for (const severity of ['critical', 'high', 'medium', 'low']) {
    if (text.includes(severity)) {
      filter.severity = severity;
      descriptionParts.push(`${severity} severity`);
      break;
    }
  }

  // Category (checked via synonym lists so "water" matches "flood" reports)
  for (const [category, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    if (synonyms.some((s) => text.includes(s))) {
      filter.category = category;
      descriptionParts.push(category);
      break;
    }
  }

  // Trust/verification state — check "unverified"/"not verified" BEFORE the
  // plain "verified" check, since the substring "verified" appears in both.
  if (/\bunverified\b|\bnot verified\b|\bpending\b/.test(text)) {
    filter['verification.trustState'] = 'pending';
    descriptionParts.push('unverified');
  } else if (/\bsuspicious\b|\bfake\b/.test(text)) {
    filter['verification.trustState'] = 'suspicious';
    descriptionParts.push('suspicious');
  } else if (/\bhighly trusted\b/.test(text)) {
    filter['verification.trustState'] = 'highly_trusted';
    descriptionParts.push('highly trusted');
  } else if (/\bverified\b|\bconfirmed\b/.test(text)) {
    filter['verification.trustState'] = { $in: ['verified', 'highly_trusted'] };
    descriptionParts.push('verified');
  }

  // Status / lifecycle
  if (/\bresolved\b/.test(text)) {
    filter.status = 'resolved';
    descriptionParts.push('resolved');
  } else if (/\brejected\b|\bfake reports?\b/.test(text)) {
    filter.status = 'rejected';
    descriptionParts.push('rejected');
  } else if (/\bactive\b|\bopen\b|\bongoing\b/.test(text)) {
    filter.status = { $nin: ['resolved', 'rejected', 'merged'] };
    descriptionParts.push('active');
  } else if (/\bescalated\b/.test(text)) {
    filter.escalated = true;
    descriptionParts.push('escalated');
  }

  const description = descriptionParts.length ? descriptionParts.join(', ') : 'all incidents';
  return { filter, description };
}

module.exports = { generateCitizenAdvice, parseEOCQuery };
