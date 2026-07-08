// -----------------------------------------------------------------------------
// auth.js — two middlewares:
//   protect        -> requires a valid access token, attaches req.user
//   authorize(...roles) -> requires protect() to have run first, then checks
//                          the user's role against an allow-list
// -----------------------------------------------------------------------------

const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    res.status(401);
    throw new Error('Not authorized — no access token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // We look the user up so req.user reflects the *current* role/data,
    // not whatever was true when the token was issued.
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      res.status(401);
      throw new Error('User for this token no longer exists');
    }
    next();
  } catch (err) {
    res.status(401);
    throw new Error('Not authorized — token invalid or expired');
  }
});

// Usage: router.post('/dispatch', protect, authorize('eoc', 'admin'), handler)
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    res.status(403);
    throw new Error(
      `Role '${req.user ? req.user.role : 'guest'}' is not permitted to perform this action`
    );
  }
  next();
};

module.exports = { protect, authorize };
