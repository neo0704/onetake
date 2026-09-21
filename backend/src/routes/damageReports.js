const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');
const DamageReport = require('../models/DamageReport');
const Equipment    = require('../models/Equipment');
const { protect, authorize }              = require('../middleware/auth');
const { sendNotification, notifyAdmins } = require('../services/notificationService');

// Multer for damage photos
const uploadDir = path.join(__dirname, '../../uploads/damage');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename:    (req, file, cb) => cb(null, `dmg-${Date.now()}-${file.originalname.replace(/\s/g,'_')}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null,true) : cb(new Error('Images only')) });

// GET all damage reports (admin)
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const query = {};
    if (req.query.eventId) query.event  = req.query.eventId;
    if (req.query.status)  query.status = req.query.status;
    const reports = await DamageReport.find(query)
      .populate('event',      'eventName eventDate')
      .populate('equipment',  'name category')
      .populate('freelancer', 'name email')
      .populate('reportedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET damage reports for the logged-in freelancer
router.get('/my', protect, authorize('freelancer'), async (req, res) => {
  try {
    const reports = await DamageReport.find({ freelancer: req.user.id })
      .populate('event',     'eventName eventDate')
      .populate('equipment', 'name category')
      .populate('reportedBy','name')
      .sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single damage report
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const report = await DamageReport.findById(req.params.id)
      .populate('event',      'eventName eventDate')
      .populate('equipment',  'name category')
      .populate('freelancer', 'name email')
      .populate('reportedBy', 'name')
      .populate('resolvedBy', 'name');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST — file a new damage report
router.post('/', protect, authorize('admin'), upload.array('photos', 5), async (req, res) => {
  try {
    const { eventId, equipmentId, freelancerId, damageType, description, repairCost, deductFromPayroll } = req.body;
    if (!eventId || !equipmentId || !freelancerId)
      return res.status(400).json({ success: false, message: 'eventId, equipmentId, freelancerId required' });

    const photos = (req.files || []).map(f => `/uploads/damage/${f.filename}`);

    const report = await DamageReport.create({
      event: eventId, equipment: equipmentId, freelancer: freelancerId,
      reportedBy: req.user.id, damageType, description,
      repairCost:        parseFloat(repairCost) || 0,
      deductFromPayroll: deductFromPayroll === 'true',
      deductionAmount:   parseFloat(repairCost) || 0,
      photos, status: 'open',
    });

    // Update equipment status
    const newAvail = ['destroyed','lost'].includes(damageType) ? 'retired' : 'maintenance';
    const newCond  = damageType === 'minor' ? 'fair' : 'poor';
    await Equipment.findByIdAndUpdate(equipmentId, { availability: newAvail, condition: newCond });

    // Notify freelancer
    try {
      await sendNotification({
        recipient: freelancerId, type: 'damage_report', title: 'Damage Report Filed',
        message: `A damage report has been filed for equipment you used. Damage type: ${damageType}. Contact admin for details.`,
        data: { reportId: report._id, eventId }, link: `/freelancer/events/${eventId}`,
      });
    } catch (e) { console.log('Notify err:', e.message); }

    await report.populate([
      { path: 'event',      select: 'eventName' },
      { path: 'equipment',  select: 'name category' },
      { path: 'freelancer', select: 'name email' },
      { path: 'reportedBy', select: 'name' },
    ]);
    res.status(201).json({ success: true, report });
  } catch (err) {
    console.error('[POST /damage-reports]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// PUT /:id/resolve
router.put('/:id/resolve', protect, authorize('admin'), async (req, res) => {
  try {
    const { resolution, deductFromPayroll, deductionAmount } = req.body;
    const report = await DamageReport.findById(req.params.id)
      .populate('equipment',  'name')
      .populate('freelancer', 'name email');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    report.status           = 'resolved';
    report.resolution       = resolution || '';
    report.resolvedBy       = req.user.id;
    report.resolvedAt       = new Date();
    report.deductFromPayroll = deductFromPayroll === 'true' || deductFromPayroll === true;
    report.deductionAmount  = parseFloat(deductionAmount) || report.repairCost || 0;
    await report.save();

    // Return equipment to available unless destroyed/lost
    if (!['destroyed','lost'].includes(report.damageType))
      await Equipment.findByIdAndUpdate(report.equipment._id, { availability: 'available' });

    try {
      const deductMsg = report.deductFromPayroll && report.deductionAmount > 0
        ? ` A deduction of ₱${report.deductionAmount.toLocaleString()} will be applied to your payroll.` : '';
      await sendNotification({
        recipient: report.freelancer._id, type: 'general', title: 'Damage Report Resolved',
        message: `The damage report for ${report.equipment.name} has been resolved.${deductMsg}`,
        data: { reportId: report._id }, link: `/freelancer/events/${report.event}`,
      });
    } catch (e) { console.log('Notify err:', e.message); }

    res.json({ success: true, report });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
