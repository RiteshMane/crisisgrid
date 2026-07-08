// -----------------------------------------------------------------------------
// facilityController.js — CRUD for shelters and hospitals shown as map
// markers, plus a capacity-update endpoint used by shelter/hospital staff.
// -----------------------------------------------------------------------------

const asyncHandler = require('express-async-handler');
const Facility = require('../models/Facility');
const { getIO } = require('../services/socketService');

// @route GET /api/facilities?type=shelter
const getFacilities = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  const facilities = await Facility.find(filter).sort({ name: 1 });
  res.json({ success: true, count: facilities.length, facilities });
});

// @route GET /api/facilities/mine
// @access hospital, shelter — lets a facility's own staff account find (or
// discover they haven't yet created) their facility record.
const getMyFacility = asyncHandler(async (req, res) => {
  const facility = await Facility.findOne({ managedBy: req.user._id });
  res.json({ success: true, facility: facility || null });
});

// @route POST /api/facilities
// @access eoc, admin (registering any facility) OR hospital/shelter staff
// registering their own — enforced by role, managedBy always forced to self
// unless the requester is eoc/admin.
const createFacility = asyncHandler(async (req, res) => {
  const { type, name, lng, lat, address, capacityTotal, resources, contactPhone } = req.body;

  if (!type || !name || lng === undefined || lat === undefined) {
    res.status(400);
    throw new Error('type, name, lng and lat are required');
  }

  // Hospital/shelter staff can only ever create a facility of their own type,
  // and it's always attributed to them — prevents a hospital account from
  // registering a shelter (or someone else's facility) through this route.
  if (['hospital', 'shelter'].includes(req.user.role) && type !== req.user.role) {
    res.status(403);
    throw new Error(`A ${req.user.role} account can only register a ${req.user.role} facility`);
  }

  const facility = await Facility.create({
    type,
    name,
    location: { coordinates: [Number(lng), Number(lat)], address },
    capacityTotal,
    resources,
    contactPhone,
    managedBy: req.user._id,
  });

  getIO().emit('facility:new', facility);
  res.status(201).json({ success: true, facility });
});

// @route PATCH /api/facilities/:id/capacity
// @access shelter, hospital staff updating live occupancy
const updateCapacity = asyncHandler(async (req, res) => {
  const { capacityUsed, status } = req.body;
  const facility = await Facility.findById(req.params.id);

  if (!facility) {
    res.status(404);
    throw new Error('Facility not found');
  }

  const isPrivileged = ['eoc', 'admin'].includes(req.user.role);
  const isOwner = facility.managedBy && facility.managedBy.toString() === req.user._id.toString();
  if (!isPrivileged && !isOwner) {
    res.status(403);
    throw new Error('You can only update capacity for a facility you manage');
  }

  if (capacityUsed !== undefined) facility.capacityUsed = capacityUsed;
  if (status) facility.status = status;
  await facility.save();

  getIO().emit('facility:update', facility);
  res.json({ success: true, facility });
});

module.exports = { getFacilities, getMyFacility, createFacility, updateCapacity };
