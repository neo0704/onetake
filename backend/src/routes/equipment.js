const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/equipmentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/',                    protect,                    ctrl.getEquipment);
router.post('/',                   protect, authorize('admin'), ctrl.createEquipment);
router.put('/:id',                 protect, authorize('admin'), ctrl.updateEquipment);
router.patch('/:id/serials',       protect, authorize('admin'), ctrl.updateSerials);
router.patch('/:id/unit-details',  protect, authorize('admin'), ctrl.updateUnitDetails);
router.delete('/:id',              protect, authorize('admin'), ctrl.deleteEquipment);

module.exports = router;