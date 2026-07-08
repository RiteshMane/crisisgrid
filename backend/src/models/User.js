// -----------------------------------------------------------------------------
// User.js — Mongoose schema for every account type in CrisisGrid.
//
// Rather than a separate collection per role (Citizen, Hospital, etc.) we use
// a single "User" collection with a `role` field. This is a common real-world
// pattern (one auth identity, many possible roles) and keeps login/JWT logic
// simple, while `organizationName` / `location` cover the extra fields that
// non-citizen roles (hospitals, shelters, rescue teams, NGOs) need.
// -----------------------------------------------------------------------------

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = [
  'citizen',
  'eoc', // Emergency Operations Center (dispatcher/admin for a region)
  'rescue_team',
  'hospital',
  'shelter',
  'volunteer',
  'ngo',
  'admin',
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'citizen', required: true },

    // Optional org name for non-citizen roles, e.g. "Sion Hospital", "NDRF Team 4"
    organizationName: { type: String, trim: true },

    // Used for "nearby services" queries and for plotting the user on the map
    // GeoJSON Point: [longitude, latitude] — note Mongo expects lng first.
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },

    phone: { type: String, trim: true },

    // Simple presence/safety flag citizens can toggle for the "family safety
    // status" feature described in the product roadmap.
    safetyStatus: {
      type: String,
      enum: ['unknown', 'safe', 'needs_help'],
      default: 'unknown',
    },

    // ---- Organization verification (stand-in for government ID checks) ----
    // Non-citizen roles (hospital, shelter, rescue_team, ngo, volunteer)
    // upload some proof of identity/registration at signup. In production
    // this would be reviewed by a government official; for this project any
    // image works and an EOC/admin account plays that reviewer role instead.
    // Stored as a base64 data URI directly on the user document — no paid
    // file-storage service required, which is fine at this scale (a handful
    // of small images).
    verificationDocument: {
      dataUrl: { type: String, default: null }, // base64 data URI, e.g. "data:image/png;base64,..."
      fileName: { type: String, default: '' },
      status: { type: String, enum: ['not_submitted', 'pending', 'approved', 'rejected'], default: 'not_submitted' },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      reviewNote: { type: String, default: '' },
      uploadedAt: { type: Date },
      reviewedAt: { type: Date },
    },
    // ------------------------------------------------------------------------

    refreshTokenHash: { type: String, select: false },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });

// Hash the password automatically whenever it is created/changed.
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Instance method used by the login controller.
userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never leak the password hash even if a document is accidentally serialized.
userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokenHash;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
