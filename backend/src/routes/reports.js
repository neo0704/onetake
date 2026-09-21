const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/auth');
router.get('/dashboard', protect, authorize('admin'), ctrl.getAdminDashboard);
router.get('/financial', protect, authorize('admin'), ctrl.getFinancialSummary);
router.get('/event/:id', protect, ctrl.getEventReport);
module.exports = router;
