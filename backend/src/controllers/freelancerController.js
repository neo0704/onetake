const User = require('../models/User');
const Event = require('../models/Event');

exports.getFreelancers = async (req, res) => {
  try {
    const { skill, available } = req.query;
    let query = { role: 'freelancer', isActive: true };
    if (skill) query.skills = { $in: [skill] };
    const freelancers = await User.find(query).select('-password');
    res.json({ success: true, freelancers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFreelancer = async (req, res) => {
  try {
    const freelancer = await User.findById(req.params.id).select('-password');
    if (!freelancer || freelancer.role !== 'freelancer') {
      return res.status(404).json({ success: false, message: 'Freelancer not found' });
    }
    res.json({ success: true, freelancer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFreelancerEvents = async (req, res) => {
  try {
    const events = await Event.find({
      'assignedFreelancers.freelancer': req.params.id
    })
      .populate('client', 'name email')
      .sort({ eventDate: -1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMySchedule = async (req, res) => {
  try {
    const events = await Event.find({
      'assignedFreelancers.freelancer': req.user.id,
      status: { $in: ['confirmed', 'assigned', 'in_progress'] }
    }).populate('client', 'name').sort({ eventDate: 1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Admin: edit a freelancer's profile
const EDITABLE_FIELDS = [
  'name', 'email', 'phone', 'age', 'address', 'rate', 'rateType',
  'skills', 'bio', 'availability', 'emergencyContact', 'emergencyPhone',
];
const NUMERIC_FIELDS = ['age', 'rate'];

exports.updateFreelancer = async (req, res) => {
  try {
    const freelancer = await User.findById(req.params.id);
    if (!freelancer || freelancer.role !== 'freelancer') {
      return res.status(404).json({ success: false, message: 'Freelancer not found' });
    }

    const set = {};
    const unset = {};

    for (const key of EDITABLE_FIELDS) {
      if (req.body[key] === undefined) continue;
      let val = req.body[key];

      if (NUMERIC_FIELDS.includes(key)) {
        if (val === '' || val === null) { unset[key] = 1; continue; }
        val = Number(val);
        if (Number.isNaN(val) || val < 0) {
          return res.status(400).json({ success: false, message: `Invalid ${key}` });
        }
      } else if (key === 'skills') {
        val = Array.isArray(val)
          ? val.map(s => String(s).trim()).filter(Boolean)
          : [];
      } else if (typeof val === 'string') {
        val = val.trim();
      }

      if (key === 'name' && !val) {
        return res.status(400).json({ success: false, message: 'Name is required' });
      }
      if (key === 'email') {
        val = String(val).toLowerCase();
        if (!val) {
          return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const taken = await User.findOne({ email: val, _id: { $ne: freelancer._id } });
        if (taken) {
          return res.status(400).json({ success: false, message: 'That email is already in use' });
        }
      }
      set[key] = val;
    }

    const update = {};
    if (Object.keys(set).length)   update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: 'No changes provided' });
    }

    const updated = await User.findByIdAndUpdate(freelancer._id, update, {
      new: true,
      runValidators: true,
    }).select('-password');

    res.json({ success: true, freelancer: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};