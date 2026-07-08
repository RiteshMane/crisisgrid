// -----------------------------------------------------------------------------
// generateTokens.js — issues the short-lived access token (sent to the client
// in the JSON response, kept in memory / React state) and the long-lived
// refresh token (stored as an httpOnly cookie so client-side JS can't read
// it, which mitigates XSS token theft).
// -----------------------------------------------------------------------------

const jwt = require('jsonwebtoken');

function generateAccessToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

module.exports = { generateAccessToken, generateRefreshToken };
