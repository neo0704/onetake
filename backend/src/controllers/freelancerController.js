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
