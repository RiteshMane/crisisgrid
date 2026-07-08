// -----------------------------------------------------------------------------
// aiService.js — analyzes an incident report and returns:
//   { summary, suggestedSeverity, suggestedCategory, confidence,
//     recommendedResources, etaMinutes, source }
//
// Two modes for the *classification* (summary/severity/category/confidence):
//   1. Gemini mode  — used when GEMINI_API_KEY is set and DEMO_MODE=false.
//      We ask Gemini to return STRICT JSON so we can parse it directly
//      (this is the "structured JSON outputs" pattern from the spec).
//   2. Mock mode    — a small keyword-based classifier. This is what keeps
//      the whole app runnable and demoable with zero external accounts.
//
// Resource recommendations are DELIBERATELY always deterministic (a rule
// table keyed by category+severity), never left to the LLM to invent —
// see computeResourceRecommendation() for why that's a safety decision,
// not a shortcut.
//
// Interview talking point: this is a simple "strategy pattern" — the
// controller never knows which mode ran, it just awaits analyzeIncident().
// -----------------------------------------------------------------------------

const KEYWORD_RULES = [
  { keywords: ['flood', 'water', 'drowning', 'submerged'], category: 'flood', severity: 'high' },
  { keywords: ['fire', 'burning', 'smoke', 'flames'], category: 'fire', severity: 'critical' },
  { keywords: ['earthquake', 'collapsed', 'trapped', 'rubble', 'building fell'], category: 'structural', severity: 'critical' },
  { keywords: ['injured', 'bleeding', 'unconscious', 'medical', 'heart attack', 'labor', 'pregnant'], category: 'medical', severity: 'high' },
];

const CATEGORY_LABELS = {
  flood: 'Flood',
  fire: 'Fire',
  earthquake: 'Earthquake',
  structural: 'Structural collapse',
  medical: 'Medical emergency',
  other: 'Unclassified incident',
};

// ---------------------------------------------------------------------------
// Short, punchy summary generation — EOC staff triaging a queue of 30
// incidents need one line, not a reproduction of the citizen's paragraph.
// We extract a person-count if the report mentions one (a very common,
// high-value detail: "40 people trapped") and pick an action phrase from
// severity, rather than summarizing arbitrary free text — this keeps the
// output short, consistent, and honest about what it actually knows.
// ---------------------------------------------------------------------------
const ACTION_BY_SEVERITY = {
  critical: 'Immediate evacuation recommended.',
  high: 'Urgent response recommended.',
  medium: 'Monitor situation closely.',
  low: 'No immediate action required, continue monitoring.',
};

function extractAffectedCount(text) {
  const match = text.match(/\b(\d{1,5})\s*(?:people|persons|residents|families|stranded|trapped|injured)\b/i);
  return match ? Number(match[1]) : null;
}

function buildShortSummary({ text, category, severity }) {
  const label = CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
  const affected = extractAffectedCount(text);
  const parts = [`${label} reported.`];
  if (affected) parts.push(`Approximately ${affected} people affected.`);
  parts.push(ACTION_BY_SEVERITY[severity] || ACTION_BY_SEVERITY.medium);
  return parts.join(' ');
}

function mockAnalyze({ title = '', description = '' }) {
  const text = `${title} ${description}`;
  const lowerText = text.toLowerCase();
  const wordCount = lowerText.trim().split(/\s+/).filter(Boolean).length;

  const match = KEYWORD_RULES.find((rule) => rule.keywords.some((kw) => lowerText.includes(kw)));
  const category = match?.category || 'other';
  let severity = match?.severity || 'medium';

  // Escalate to critical when the report signals people are trapped or a
  // large number of people are affected — these are the details a human
  // triager would weight most heavily, regardless of category.
  const affectedCount = extractAffectedCount(text);
  if (/\btrapped\b|\bstranded\b/.test(lowerText) || (affectedCount && affectedCount >= 15)) {
    severity = 'critical';
  }

  // Confidence heuristic feeding the trust score's AI component: a report
  // that matches a known disaster-keyword pattern AND has enough detail to
  // not look like a one-line spam/prank entry scores higher. This is
  // deliberately simple and explainable (no black-box score) — a real
  // upgrade path is swapping this for Gemini's own confidence, but keeping
  // a transparent baseline matters for a fake-report defense you can explain.
  let confidence = 35; // baseline for unmatched/vague text
  if (match) confidence += 35;
  if (wordCount >= 8) confidence += 15;
  if (wordCount >= 20) confidence += 10;
  confidence = Math.min(confidence, 95); // never claim full certainty from keywords alone

  return {
    summary: buildShortSummary({ text, category, severity }),
    suggestedSeverity: severity,
    suggestedCategory: category,
    confidence,
    source: 'mock',
  };
}

async function geminiAnalyze({ title, description }) {
  // Node 18+ (our documented minimum, see package.json "engines") ships a
  // built-in global fetch, so no extra HTTP client dependency is needed.
  const prompt = `You are an emergency dispatch triage assistant. Analyze this
citizen incident report and respond with STRICT JSON only, no markdown fences,
matching exactly this shape:
{"summary": string (MAX 20 words, terse and actionable, e.g. "Flood affecting residential area. Approximately 40 people stranded. Immediate evacuation recommended."), "suggestedSeverity": "low"|"medium"|"high"|"critical", "suggestedCategory": "flood"|"fire"|"earthquake"|"medical"|"structural"|"other", "confidence": number (0-100, how confident you are this is a genuine, coherent, non-spam report)}

Title: ${title}
Description: ${description}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API responded with status ${res.status}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  const parsed = JSON.parse(rawText);

  return { ...parsed, source: 'gemini' };
}

// ---------------------------------------------------------------------------
// Resource recommendation — deliberately a deterministic rule table, NOT an
// LLM output. An emergency dispatcher trusting an LLM's freely-generated
// guess of "how many ambulances" is a real safety risk (models can and do
// invent plausible-sounding numbers). Instead: a transparent, auditable
// table keyed by (category, severity), with a fixed ETA per row. The AI's
// job is upstream of this — classifying category/severity from free text —
// which is a good fit for an LLM; converting that into a dispatch count is
// not, until this table is validated against real response data.
// ---------------------------------------------------------------------------
const RESOURCE_RULES = {
  flood: {
    critical: { resources: [{ name: 'Ambulances', qty: 3 }, { name: 'Rescue boats', qty: 2 }, { name: 'Police unit', qty: 1 }, { name: 'Temporary shelter', qty: 1 }], etaMinutes: 15 },
    high: { resources: [{ name: 'Ambulance', qty: 1 }, { name: 'Rescue boat', qty: 1 }, { name: 'Police patrol', qty: 1 }], etaMinutes: 20 },
    medium: { resources: [{ name: 'Field assessment team', qty: 1 }], etaMinutes: 30 },
    low: { resources: [{ name: 'Advisory notice', qty: 1 }], etaMinutes: 45 },
  },
  fire: {
    critical: { resources: [{ name: 'Fire trucks', qty: 2 }, { name: 'Ambulances', qty: 2 }, { name: 'Police unit', qty: 1 }, { name: 'Evacuation team', qty: 1 }], etaMinutes: 10 },
    high: { resources: [{ name: 'Fire truck', qty: 1 }, { name: 'Ambulance', qty: 1 }], etaMinutes: 15 },
    medium: { resources: [{ name: 'Fire safety inspection team', qty: 1 }], etaMinutes: 30 },
    low: { resources: [{ name: 'Advisory notice', qty: 1 }], etaMinutes: 45 },
  },
  structural: {
    critical: { resources: [{ name: 'Search & rescue team', qty: 1 }, { name: 'Heavy machinery unit', qty: 1 }, { name: 'Ambulances', qty: 2 }, { name: 'Police unit', qty: 1 }], etaMinutes: 20 },
    high: { resources: [{ name: 'Structural engineer', qty: 1 }, { name: 'Ambulance', qty: 1 }], etaMinutes: 25 },
    medium: { resources: [{ name: 'Field assessment team', qty: 1 }], etaMinutes: 35 },
    low: { resources: [{ name: 'Advisory notice', qty: 1 }], etaMinutes: 45 },
  },
  earthquake: {
    critical: { resources: [{ name: 'Search & rescue team', qty: 2 }, { name: 'Heavy machinery unit', qty: 1 }, { name: 'Ambulances', qty: 3 }, { name: 'Temporary shelter', qty: 1 }], etaMinutes: 20 },
    high: { resources: [{ name: 'Search & rescue team', qty: 1 }, { name: 'Ambulance', qty: 1 }], etaMinutes: 25 },
    medium: { resources: [{ name: 'Field assessment team', qty: 1 }], etaMinutes: 35 },
    low: { resources: [{ name: 'Advisory notice', qty: 1 }], etaMinutes: 45 },
  },
  medical: {
    critical: { resources: [{ name: 'Ambulances', qty: 2 }, { name: 'Paramedic team', qty: 1 }], etaMinutes: 8 },
    high: { resources: [{ name: 'Ambulance', qty: 1 }, { name: 'Paramedic team', qty: 1 }], etaMinutes: 12 },
    medium: { resources: [{ name: 'Ambulance', qty: 1 }], etaMinutes: 20 },
    low: { resources: [{ name: 'Advisory notice', qty: 1 }], etaMinutes: 30 },
  },
  other: {
    critical: { resources: [{ name: 'Field assessment team', qty: 1 }, { name: 'Police unit', qty: 1 }], etaMinutes: 20 },
    high: { resources: [{ name: 'Field assessment team', qty: 1 }], etaMinutes: 25 },
    medium: { resources: [{ name: 'Field assessment team', qty: 1 }], etaMinutes: 35 },
    low: { resources: [{ name: 'Advisory notice', qty: 1 }], etaMinutes: 45 },
  },
};

function computeResourceRecommendation({ category, severity }) {
  const table = RESOURCE_RULES[category] || RESOURCE_RULES.other;
  const row = table[severity] || table.medium;
  return { recommendedResources: row.resources, etaMinutes: row.etaMinutes };
}

/**
 * Public entry point used by controllers. Falls back to mock classification
 * on ANY failure (missing key, network error, malformed JSON) so a flaky
 * free-tier API never breaks a demo — then ALWAYS overlays a deterministic
 * resource recommendation on top, regardless of which classifier ran.
 */
async function analyzeIncident({ title, description }) {
  const useGemini = process.env.DEMO_MODE !== 'true' && !!process.env.GEMINI_API_KEY;

  let classification;
  if (!useGemini) {
    classification = mockAnalyze({ title, description });
  } else {
    try {
      classification = await geminiAnalyze({ title, description });
    } catch (err) {
      console.warn(`[aiService] Gemini call failed, falling back to mock: ${err.message}`);
      classification = mockAnalyze({ title, description });
    }
  }

  const { recommendedResources, etaMinutes } = computeResourceRecommendation({
    category: classification.suggestedCategory,
    severity: classification.suggestedSeverity,
  });

  return { ...classification, recommendedResources, etaMinutes };
}

module.exports = { analyzeIncident, mockAnalyze, computeResourceRecommendation, buildShortSummary };
