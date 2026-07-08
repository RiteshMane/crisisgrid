# Original full-scope vision (for reference)

The original brief described a much larger platform: 8 user roles (citizen,
EOC, rescue team, hospital, shelter, volunteer, NGO, admin), offline-first
PWA behavior, BullMQ/Redis background jobs, 6 predefined disaster demo
scenarios, a donations/funding module, and multi-language support.

This repository implements a focused subset — 3 roles, one demo scenario,
core AI triage and real-time coordination — built completely and correctly
rather than attempting the full scope with less reliability. See the
"Roadmap" section in the root README.md for what was deferred and why, and
for how the current architecture already supports extending it (e.g. new
roles just need a new dashboard page; the auth/role system already handles
all 8 role values).
