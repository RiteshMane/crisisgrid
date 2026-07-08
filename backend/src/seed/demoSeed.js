// -----------------------------------------------------------------------------
// demoSeed.js — populates the database with a reproducible "Mumbai Flood"
// demo scenario: a handful of users (one per role), shelters, a hospital,
// and several incidents at real Mumbai coordinates.
//
// Run with:  npm run seed   (from the backend/ folder, with MONGO_URI set)
//
// Safe to re-run: it wipes only documents flagged isDemoData:true / demo
// accounts, so it won't touch real user data if you later reuse this DB.
// -----------------------------------------------------------------------------

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Incident = require('../models/Incident');
const Facility = require('../models/Facility');
const { computeTrustScore, shouldEscalate } = require('../services/trustScoreService');
const { computeResourceRecommendation, buildShortSummary } = require('../services/aiService');

// Reuses the exact same short-summary logic as production reports (see
// aiService.js) so seeded demo incidents read identically to a real
// AI-classified report — no separate/fake summary format for the demo.
function buildDemoSummary(seedIncident) {
  return buildShortSummary({
    text: `${seedIncident.title} ${seedIncident.description}`,
    category: seedIncident.category,
    severity: seedIncident.severity,
  });
}

const DEMO_EMAILS = [
  'citizen@demo.crisisgrid.app',
  'eoc@demo.crisisgrid.app',
  'rescue@demo.crisisgrid.app',
  'hospital@demo.crisisgrid.app',
  'shelter@demo.crisisgrid.app',
];
const DEMO_PASSWORD = 'Demo@1234';

// A tiny 1x1 transparent PNG used as a stand-in "ID/registration document"
// for demo accounts — keeps the seed file self-contained with no need to
// read an actual image file from disk.
const PLACEHOLDER_DOC =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function seed() {
  await connectDB();
  console.log('[seed] Connected. Clearing previous demo data...');

  await User.deleteMany({ email: { $in: DEMO_EMAILS } });
  await Incident.deleteMany({ isDemoData: true });
  await Facility.deleteMany({ isDemoData: true });

  const [citizen, eoc, rescue, hospitalUser, shelterUser] = await User.create([
    { name: 'Aarav Sharma', email: DEMO_EMAILS[0], password: DEMO_PASSWORD, role: 'citizen', phone: '9820000001' },
    { name: 'EOC Mumbai Control', email: DEMO_EMAILS[1], password: DEMO_PASSWORD, role: 'eoc', organizationName: 'Mumbai Disaster Management Cell' },
    {
      name: 'NDRF Team 4',
      email: DEMO_EMAILS[2],
      password: DEMO_PASSWORD,
      role: 'rescue_team',
      organizationName: 'NDRF Team 4',
      phone: '9820000099',
      // Left "pending" on purpose so the EOC directory demo has a live
      // approve/reject example ready to click through.
      verificationDocument: { dataUrl: PLACEHOLDER_DOC, fileName: 'ndrf-id.png', status: 'pending', uploadedAt: new Date() },
    },
    {
      name: 'Sion Hospital Admin',
      email: DEMO_EMAILS[3],
      password: DEMO_PASSWORD,
      role: 'hospital',
      organizationName: 'Sion Hospital',
      phone: '9820000011',
      verificationDocument: {
        dataUrl: PLACEHOLDER_DOC,
        fileName: 'hospital-license.png',
        status: 'approved',
        uploadedAt: new Date(),
        reviewedAt: new Date(),
      },
    },
    {
      name: 'BKC Relief Camp',
      email: DEMO_EMAILS[4],
      password: DEMO_PASSWORD,
      role: 'shelter',
      organizationName: 'BKC Relief Camp',
      phone: '9820000022',
      verificationDocument: {
        dataUrl: PLACEHOLDER_DOC,
        fileName: 'shelter-registration.png',
        status: 'approved',
        uploadedAt: new Date(),
        reviewedAt: new Date(),
      },
    },
  ]);

  console.log('[seed] Created demo users for every role (password: %s)', DEMO_PASSWORD);

  const facilities = await Facility.create([
    {
      type: 'shelter',
      name: 'BKC Relief Camp',
      location: { coordinates: [72.8656, 19.0669], address: 'Bandra Kurla Complex, Mumbai' },
      capacityTotal: 200,
      capacityUsed: 140,
      managedBy: shelterUser._id,
      isDemoData: true,
    },
    {
      type: 'shelter',
      name: 'Dadar Community Hall Shelter',
      location: { coordinates: [72.8437, 19.0176], address: 'Dadar, Mumbai' },
      capacityTotal: 120,
      capacityUsed: 45,
      isDemoData: true,
    },
    {
      type: 'hospital',
      name: 'Sion Hospital',
      location: { coordinates: [72.8619, 19.0448], address: 'Sion, Mumbai' },
      capacityTotal: 80,
      capacityUsed: 61,
      resources: ['ICU', 'ambulance', 'oxygen'],
      managedBy: hospitalUser._id,
      isDemoData: true,
    },
    {
      type: 'hospital',
      name: 'KEM Hospital',
      location: { coordinates: [72.8417, 19.0006], address: 'Parel, Mumbai' },
      capacityTotal: 100,
      capacityUsed: 88,
      resources: ['ICU', 'oxygen', 'blood bank'],
      isDemoData: true,
    },
  ]);
  console.log(`[seed] Created ${facilities.length} facilities`);

  const incidentSeeds = [
    {
      type: 'sos',
      title: 'Family trapped on rooftop, rising water',
      description: 'Water level rising fast near Hindmata, a family of 4 including an infant is stuck on the roof.',
      category: 'flood',
      severity: 'critical',
      coords: [72.8339, 19.0016],
      address: 'Hindmata, Dadar, Mumbai',
      // Demo: a strong, corroborated report — GPS matches, crowd confirms,
      // authority has verified it. Also left in "reported" status so it
      // shows up as escalated on the EOC dashboard.
      demoVerification: { authorityStatus: 'confirmed', crowdConfirms: 3, crowdDisputes: 0, gpsMatch: true, aiConfidence: 90 },
    },
    {
      type: 'incident_report',
      title: 'Waterlogging blocking main road',
      description: 'Knee-deep water on the main road near Sion Circle, vehicles stalled, traffic gridlocked.',
      category: 'flood',
      severity: 'medium',
      coords: [72.8610, 19.0430],
      address: 'Sion Circle, Mumbai',
      // Demo: freshly reported, nobody has verified it yet — "pending" state.
      demoVerification: { authorityStatus: 'pending', crowdConfirms: 0, crowdDisputes: 0, gpsMatch: null, aiConfidence: 55 },
    },
    {
      type: 'resource_request',
      title: 'Need drinking water and food supplies',
      description: 'Relief camp at BKC is running low on drinking water and dry rations for ~140 people.',
      category: 'flood',
      severity: 'high',
      coords: [72.8656, 19.0669],
      address: 'Bandra Kurla Complex, Mumbai',
      // Demo: crowd has confirmed it but authority hasn't looked yet — "verified".
      demoVerification: { authorityStatus: 'pending', crowdConfirms: 2, crowdDisputes: 0, gpsMatch: true, aiConfidence: 70 },
    },
    {
      type: 'sos',
      title: 'Elderly person needs medical evacuation',
      description: 'An elderly man with breathing difficulty is stranded, water has surrounded the building entrance.',
      category: 'medical',
      severity: 'critical',
      coords: [72.8500, 19.0550],
      address: 'Kurla, Mumbai',
      // Demo: second escalated/highly-trusted example.
      demoVerification: { authorityStatus: 'confirmed', crowdConfirms: 2, crowdDisputes: 0, gpsMatch: true, aiConfidence: 85 },
    },
    {
      type: 'incident_report',
      title: 'Short-circuit sparks reported near flooded market',
      description: 'Sparks seen from an electric pole standing in floodwater near Dadar market, risk of electrocution.',
      category: 'other',
      severity: 'high',
      coords: [72.8450, 19.0190],
      address: 'Dadar Market, Mumbai',
      // Demo: this is the "caught a bad report" example — crowd disputed it
      // and authority rejected it, exactly the fake/mistaken-report defense
      // the verification system exists for.
      demoVerification: { authorityStatus: 'rejected', crowdConfirms: 0, crowdDisputes: 2, gpsMatch: false, aiConfidence: 40 },
    },
  ];

  const incidentDocs = incidentSeeds.map((seedIncident) => {
    const { demoVerification: dv } = seedIncident;

    const crowdVotes = [
      ...Array(dv.crowdConfirms).fill({ user: eoc._id, vote: 'confirm' }),
      ...Array(dv.crowdDisputes).fill({ user: rescue._id, vote: 'dispute' }),
    ];

    const authorityVerification = {
      status: dv.authorityStatus,
      verifiedBy: dv.authorityStatus === 'pending' ? null : eoc._id,
      at: dv.authorityStatus === 'pending' ? undefined : new Date(),
    };

    const { recommendedResources, etaMinutes } = computeResourceRecommendation({
      category: seedIncident.category,
      severity: seedIncident.severity,
    });

    const aiAnalysis = {
      summary: buildDemoSummary(seedIncident),
      suggestedSeverity: seedIncident.severity,
      suggestedCategory: seedIncident.category,
      suggestedResources: [],
      recommendedResources,
      etaMinutes,
      confidence: dv.aiConfidence,
      generatedAt: new Date(),
      source: 'mock',
    };

    const verification = computeTrustScore({
      incidentCoords: seedIncident.coords,
      reporterCoords: dv.gpsMatch === null ? null : dv.gpsMatch ? seedIncident.coords : [72.9, 19.2], // far away = mismatch
      votes: crowdVotes,
      authorityVerification,
      aiAnalysis,
    });

    const status = dv.authorityStatus === 'rejected' ? 'rejected' : 'reported';

    return {
      type: seedIncident.type,
      title: seedIncident.title,
      description: seedIncident.description,
      category: seedIncident.category,
      severity: seedIncident.severity,
      status,
      location: { coordinates: seedIncident.coords, address: seedIncident.address },
      reportedBy: citizen._id,
      aiAnalysis,
      crowdVotes,
      authorityVerification,
      verification,
      escalated: shouldEscalate({ severity: seedIncident.severity, status, trustState: verification.trustState }),
      timeline: [{ status: 'reported', note: 'Seeded demo report', actor: citizen._id }],
      isDemoData: true,
    };
  });

  const incidents = await Incident.create(incidentDocs);
  console.log(`[seed] Created ${incidents.length} incidents for the Mumbai Flood scenario`);

  console.log('\n[seed] Demo login credentials (same password for all):');
  console.log(`  password: ${DEMO_PASSWORD}`);
  DEMO_EMAILS.forEach((email) => console.log(`  - ${email}`));

  await mongoose.disconnect();
  console.log('\n[seed] Done.');
}

seed().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
