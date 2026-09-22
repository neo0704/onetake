const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/homepageController');
const { protect, authorize } = require('../middleware/auth');

// Public
router.get('/', ctrl.getContent);
router.get('/reviews', ctrl.getReviews);

// Admin only
router.put('/video',                    protect, authorize('admin'), ctrl.updateVideo);
router.post('/portfolio',               protect, authorize('admin'), ctrl.addProject);
router.put('/portfolio/reorder',        protect, authorize('admin'), ctrl.reorderProjects);
router.put('/portfolio/:projectId',     protect, authorize('admin'), ctrl.updateProject);
router.delete('/portfolio/:projectId',  protect, authorize('admin'), ctrl.deleteProject);

module.exports = router;