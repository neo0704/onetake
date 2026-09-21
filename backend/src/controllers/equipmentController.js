const Equipment = require('../models/Equipment');

exports.getEquipment = async (req, res) => {
  try {
    const { category, available } = req.query;
    let query = { isActive: true };
    if (category) query.category = category;
    if (available === 'true') query.availableQuantity = { $gt: 0 };
    const equipment = await Equipment.find(query).sort({ name: 1 }).lean();
    res.json({ success: true, equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createEquipment = async (req, res) => {
  try {
    const data = { ...req.body };
    const qty = parseInt(data.quantity) || 1;

    // Pre-populate per-unit arrays to match quantity
    if (!data.serialNumbers || data.serialNumbers.length === 0) {
      data.serialNumbers = Array(qty).fill('');
    }
    if (!data.unitConditions || data.unitConditions.length === 0) {
      data.unitConditions = Array(qty).fill(data.condition || 'good');
    }
    if (!data.unitAvailabilities || data.unitAvailabilities.length === 0) {
      data.unitAvailabilities = Array(qty).fill(data.availability || 'available');
    }

    const equipment = await Equipment.create(data);
    res.status(201).json({ success: true, equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateEquipment = async (req, res) => {
  try {
    const data = { ...req.body };

    // If quantity changed, resize all per-unit arrays to match
    if (data.quantity !== undefined) {
      const current = await Equipment.findById(req.params.id).lean();
      if (current) {
        const newQty           = parseInt(data.quantity) || 1;
        const existingSerials  = current.serialNumbers      || [];
        const existingConds    = current.unitConditions     || [];
        const existingAvails   = current.unitAvailabilities || [];

        data.serialNumbers      = Array.from({ length: newQty }, (_, i) => existingSerials[i] || '');
        data.unitConditions     = Array.from({ length: newQty }, (_, i) => existingConds[i]   || data.condition    || current.condition    || 'good');
        data.unitAvailabilities = Array.from({ length: newQty }, (_, i) => existingAvails[i]  || data.availability || current.availability || 'available');
      }
    }

    const equipment = await Equipment.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json({ success: true, equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /equipment/:id/serials
// Body: { serialNumbers: ['SN001', 'SN002', ''] }
exports.updateSerials = async (req, res) => {
  try {
    const { serialNumbers } = req.body;
    if (!Array.isArray(serialNumbers)) {
      return res.status(400).json({ success: false, message: 'serialNumbers must be an array' });
    }

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    if (serialNumbers.length !== equipment.quantity) {
      return res.status(400).json({
        success: false,
        message: `Expected ${equipment.quantity} serial numbers, got ${serialNumbers.length}`
      });
    }

    equipment.serialNumbers = serialNumbers.map(s => (s || '').trim());
    await equipment.save();

    res.json({ success: true, equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /equipment/:id/unit-details
// Body: { unitConditions: ['good', 'fair', ...], unitAvailabilities: ['available', 'in_use', ...] }
exports.updateUnitDetails = async (req, res) => {
  try {
    const { unitConditions, unitAvailabilities } = req.body;

    const equipment = await Equipment.findById(req.params.id);
    if (!equipment) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    const qty = equipment.quantity;

    if (unitConditions !== undefined) {
      if (!Array.isArray(unitConditions) || unitConditions.length !== qty) {
        return res.status(400).json({
          success: false,
          message: `Expected ${qty} unit conditions, got ${unitConditions?.length ?? 'none'}`
        });
      }
      const validConds = ['excellent', 'good', 'fair', 'needs_repair'];
      for (const c of unitConditions) {
        if (!validConds.includes(c)) {
          return res.status(400).json({ success: false, message: `Invalid condition value: "${c}"` });
        }
      }
      equipment.unitConditions = unitConditions;
    }

    if (unitAvailabilities !== undefined) {
      if (!Array.isArray(unitAvailabilities) || unitAvailabilities.length !== qty) {
        return res.status(400).json({
          success: false,
          message: `Expected ${qty} unit availabilities, got ${unitAvailabilities?.length ?? 'none'}`
        });
      }
      const validAvails = ['available', 'in_use', 'maintenance', 'retired'];
      for (const a of unitAvailabilities) {
        if (!validAvails.includes(a)) {
          return res.status(400).json({ success: false, message: `Invalid availability value: "${a}"` });
        }
      }
      equipment.unitAvailabilities = unitAvailabilities;

      // Recompute global availableQuantity from unit-level data
      equipment.availableQuantity = unitAvailabilities.filter(a => a === 'available').length;

      // Sync global availability: if all units share the same status, reflect it globally
      const unique = [...new Set(unitAvailabilities)];
      if (unique.length === 1) equipment.availability = unique[0];
      else if (unitAvailabilities.every(a => a !== 'available')) equipment.availability = 'in_use';
      else equipment.availability = 'available';
    }

    await equipment.save();
    res.json({ success: true, equipment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteEquipment = async (req, res) => {
  try {
    await Equipment.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};