const router = require('express').Router();
const { protectAdmin, requirePermission } = require('../../middleware/adminAuth');
const { getTeam, createTeamMember, updateTeamMember, mergeTeamMember, deleteTeamMember } = require('../../controllers/admin/adminTeamController');

router.use(protectAdmin);
router.get('/', getTeam);
router.post('/', requirePermission('teamManagement', 'add'), createTeamMember);
router.put('/:id', requirePermission('teamManagement', 'edit'), updateTeamMember);
router.post('/:id/merge', requirePermission('teamManagement', 'edit'), mergeTeamMember);
router.delete('/:id', requirePermission('teamManagement', 'delete'), deleteTeamMember);

module.exports = router;
