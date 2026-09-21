const DamageReport = require('../models/DamageReport');

// ── CREATE
exports.createDamageReport = async (req, res) => {
  try {
    const {
      equipment,
      event,
      damageType,
      description,
      estimatedRepairCost,
      notes
    } = req.body;

    // handle uploaded files
    const photos = req.files?.map(file => file.path) || [];

    const report = await DamageReport.create({
      equipment,
      event,
      reportedBy: req.user.id,
      reportedByName: req.user.name,
      damageType,
      description,
      estimatedRepairCost,
      notes,
      photos
    });

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET ALL
exports.getDamageReports = async (req, res) => {
  try {
    const reports = await DamageReport.find()
      .populate('equipment')
      .populate('reportedBy', 'name');

    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── GET ONE
exports.getDamageReport = async (req, res) => {
  try {
    const report = await DamageReport.findById(req.params.id)
      .populate('equipment')
      .populate('reportedBy', 'name');

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── RESOLVE
exports.resolveDamageReport = async (req, res) => {
  try {
    const report = await DamageReport.findById(req.params.id);

    report.status = 'resolved';
    report.resolvedBy = req.user.id;
    report.resolvedByName = req.user.name;
    report.resolvedAt = new Date();

    await report.save();

    res.json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};