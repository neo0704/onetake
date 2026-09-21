const Event = require('../models/Event');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Quotation = require('../models/Quotation');

exports.getEventReport = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('client', 'name email phone address')
      .populate('assignedFreelancers.freelancer', 'name email skills')
      .populate('assignedEquipment.equipment', 'name category dailyRate');

    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });

    const quotation = await Quotation.findOne({ event: event._id, status: 'approved' });
    const payments = await Payment.find({ event: event._id, status: 'verified' });
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    const report = {
      event,
      quotation,
      payments,
      totalPaid,
      balance: quotation ? quotation.totalAmount - totalPaid : 0,
      generatedAt: new Date()
    };

    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getFinancialSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let dateQuery = {};
    if (startDate && endDate) {
      dateQuery = { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } };
    }

    const payments = await Payment.find({ status: 'verified', ...dateQuery })
      .populate('event', 'eventName eventDate');

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const downpayments = payments.filter(p => p.type === 'downpayment').reduce((sum, p) => sum + p.amount, 0);
    const balances = payments.filter(p => p.type === 'balance').reduce((sum, p) => sum + p.amount, 0);

    const pendingPayments = await Payment.find({ status: 'pending' }).populate('event', 'eventName');
    const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      summary: { totalRevenue, downpayments, balances, pendingAmount, totalTransactions: payments.length },
      payments, pendingPayments
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAdminDashboard = async (req, res) => {
  try {
    const [
      totalEvents, activeEvents, completedEvents, pendingInquiries,
      totalClients, totalFreelancers,
      recentEvents, pendingPayments
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: { $in: ['confirmed', 'assigned', 'in_progress'] } }),
      Event.countDocuments({ status: { $in: ['completed_paid', 'completed_pending_balance'] } }),
      Event.countDocuments({ status: 'inquiry_received' }),
      User.countDocuments({ role: 'client' }),
      User.countDocuments({ role: 'freelancer' }),
      Event.find().sort({ createdAt: -1 }).limit(5).populate('client', 'name email'),
      Payment.find({ status: 'pending' }).populate('event', 'eventName').populate('client', 'name').limit(5)
    ]);

    const verifiedPayments = await Payment.find({ status: 'verified' });
    const totalRevenue = verifiedPayments.reduce((sum, p) => sum + p.amount, 0);

    res.json({
      success: true,
      stats: { totalEvents, activeEvents, completedEvents, pendingInquiries, totalClients, totalFreelancers, totalRevenue },
      recentEvents,
      pendingPayments
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
