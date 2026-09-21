const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/freelancerController');
const { protect, authorize } = require('../middleware/auth');
router.get('/', protect, ctrl.getFreelancers);
router.get('/my-schedule', protect, authorize('freelancer'), ctrl.getMySchedule);
router.get('/:id', protect, ctrl.getFreelancer);
router.get('/:id/events', protect, ctrl.getFreelancerEvents);
module.exports = router;
