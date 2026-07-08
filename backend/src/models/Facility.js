// -----------------------------------------------------------------------------
// Facility.js — Shelters and Hospitals both boil down to "a place on the map
// with a capacity and a status", so we model them with one schema and a
// `type` discriminator instead of duplicating near-identical collections.
// -----------------------------------------------------------------------------

const mongoose = require('mongoose');

const facilitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['shelter', 'hospital'], required: true },
    name: { type: String, required: true, trim: true },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true }, // [lng, lat]
      address: { type: String, trim: true },
    },

    // Shelters: total occupants; Hospitals: total beds.
    capacityTotal: { type: Number, default: 0 },
    capacityUsed: { type: Number, default: 0 },

    // Hospitals only — free-text list is enough for a portfolio project.
    resources: [{ type: String }], // e.g. ["oxygen", "ambulance", "ICU"]

    contactPhone: { type: String, trim: true },
    managedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    status: {
      type: String,
      enum: ['operational', 'full', 'closed'],
      default: 'operational',
    },

    isDemoData: { type: Boolean, default: false },
  },
  { timestamps: true }
);

facilitySchema.index({ location: '2dsphere' });

// Convenience virtual used by the frontend to show a capacity bar.
facilitySchema.virtual('occupancyPercent').get(function occupancyPercent() {
  if (!this.capacityTotal) return 0;
  return Math.round((this.capacityUsed / this.capacityTotal) * 100);
});
facilitySchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Facility', facilitySchema);
