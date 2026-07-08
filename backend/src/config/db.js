// -----------------------------------------------------------------------------
// db.js — sets up the MongoDB connection using Mongoose.
//
// Design note: many students/interviewers will spin this project up without a
// MongoDB Atlas account handy. Rather than crash on a missing MONGO_URI, we
// log a clear warning and let the server keep running in DEMO_MODE (the seed
// script + in-memory friendly data still work through the same Mongoose
// models once a real connection is supplied later).
// -----------------------------------------------------------------------------

const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn(
      '[db] MONGO_URI is not set. The API will start, but any request that ' +
      'touches the database will fail until you set MONGO_URI in your .env ' +
      '(see .env.example). Get a free cluster at https://www.mongodb.com/atlas'
    );
    return;
  }

  try {
    // Mongoose 8 no longer needs useNewUrlParser/useUnifiedTopology flags,
    // they are the default behaviour now.
    const conn = await mongoose.connect(uri);
    console.log(`[db] MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`[db] MongoDB connection error: ${err.message}`);
    // We intentionally do not process.exit() here during development so
    // that the rest of the API (health checks, static routes) stays up.
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
