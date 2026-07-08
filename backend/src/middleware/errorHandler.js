// -----------------------------------------------------------------------------
// errorHandler.js — a single place that turns thrown errors (from
// express-async-handler-wrapped controllers) into consistent JSON responses.
// This avoids try/catch boilerplate in every controller.
// -----------------------------------------------------------------------------

// Catches requests to routes that don't exist.
const notFound = (req, res, next) => {
  res.status(404);
  next(new Error(`Route not found — ${req.originalUrl}`));
};

// Must be registered LAST in server.js (after all routes).
// Express recognises this as an error handler because it takes 4 arguments.
const errorHandler = (err, req, res, next) => {
  // If a controller forgot to set a status code, default to 500.
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    // Only leak stack traces outside production, to help debugging locally.
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};

module.exports = { notFound, errorHandler };
