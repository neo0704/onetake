const Payroll = require('../models/Payroll');
const { protect, authorize } = require('../middleware/auth');
const { sendNotification } = require('../services/notificationService');

exports.createPayroll = async (req, res) => {
  try {
    const payrollData = {
      ...req.body,
      freelancer: req.body.freelancerId,
      createdBy: req.user.id,
      period: {
        from: req.body.periodFrom ? new Date(req.body.periodFrom) : undefined,
        to: req.body.periodTo ? new Date(req.body.periodTo) : undefined
      }
    };
    delete payrollData.freelancerId;
    delete payrollData.periodFrom;
    delete payrollData.periodTo;
    
    const payroll = await Payroll.create(payrollData);

    await payroll.populate([
      { path: 'freelancer', select: 'name email phone role' },
      { path: 'event', select: 'eventName eventDate' },
      { path: 'createdBy', select: 'name' }
    ]);
    
    if (payroll.freelancer) {
      await sendNotification({
        recipient: payroll.freelancer._id,
        type: 'payroll_created',
        title: 'New Payroll',
        message: `Payroll ${payroll.payrollNumber} created. Net Pay: ₱${payroll.netPay?.toLocaleString()}`,
        data: { payrollId: payroll._id }
      });
    }

    res.status(201).json({ success: true, payroll });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getMyPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find({ freelancer: req.user.id })
      .populate('event', 'eventName eventDate')
      .sort({ 'period.to': -1, createdAt: -1 });
    res.json({ success: true, payrolls });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPayrolls = async (req, res) => {
  try {
    const { status, freelancerId, periodFrom, periodTo } = req.query;
    let query = {};
    if (status) query.status = status;
    if (freelancerId) query.freelancer = freelancerId;
    if (periodFrom || periodTo) {
      query.period = {};
      if (periodFrom) query.period.from = { $gte: new Date(periodFrom) };
      if (periodTo) query.period.to = { $lte: new Date(periodTo) };
    }

    const payrolls = await Payroll.find(query)
      .populate('freelancer', 'name email phone role')
      .populate('event', 'eventName client')
      .populate('createdBy', 'name')
      .sort({ 'period.to': -1, createdAt: -1 });
    
    const totalNetPay = payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0);
    
    res.json({ success: true, payrolls, totalNetPay });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getPayroll = async (req, res) => {
  try {
    const payroll = await Payroll.findById(req.params.id).populate([
      'freelancer', 'event', 'createdBy'
    ]);
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    res.json({ success: true, payroll });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updatePayroll = async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      freelancer: req.body.freelancerId,
      period: {
        from: req.body.periodFrom ? new Date(req.body.periodFrom) : undefined,
        to: req.body.periodTo ? new Date(req.body.periodTo) : undefined
      }
    };
    delete updateData.freelancerId;
    delete updateData.periodFrom;
    delete updateData.periodTo;
    
    const payroll = await Payroll.findByIdAndUpdate(req.params.id, updateData, { 
      new: true, 
      runValidators: true 
    }).populate('freelancer', 'name email');
    
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    
    if (payroll.status === 'pending' && req.body.status === 'pending' && payroll.freelancer) {
      await sendNotification({
        recipient: payroll.freelancer._id,
        type: 'payroll_pending',
        title: 'Payroll Ready',
        message: `Payroll ${payroll.payrollNumber} ready for payment`,
        data: { payrollId: payroll._id }
      });
    }
    
    res.json({ success: true, payroll });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.markPaid = async (req, res) => {
  try {
    const { referenceNumber = '', paymentMethod = 'gcash', notes = '' } = req.body;
    const payroll = await Payroll.findByIdAndUpdate(req.params.id, {
      status: 'paid',
      paidAt: new Date(),
      referenceNumber,
      paymentMethod,
      notes
    }, { new: true }).populate('freelancer', 'name email');
    
    if (!payroll) return res.status(404).json({ success: false, message: 'Payroll not found' });
    
    if (payroll.freelancer) {
      await sendNotification({
        recipient: payroll.freelancer._id,
        type: 'payroll_paid',
        title: 'Payroll Paid',
        message: `Payroll ${payroll.payrollNumber} paid ₱${payroll.netPay?.toLocaleString()}`,
        data: { payrollId: payroll._id }
      });
    }
    
    res.json({ success: true, payroll });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.getStatsSummary = async (req, res) => {
  try {
    const paidCount = await Payroll.countDocuments({ status: 'paid' });
    const pendingCount = await Payroll.countDocuments({ status: 'pending' });
    const pendingDraftCount = await Payroll.countDocuments({ $or: [{ status: 'pending' }, { status: 'draft' }] });
    const totalReleasedAgg = await Payroll.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$netPay' } } }
    ]);

    const totalReleased = totalReleasedAgg[0]?.total || 0;

    res.json({
      success: true,
      stats: {
        totalReleased,
        totalPending: pendingCount,
        paid: paidCount,
        pending: pendingDraftCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



