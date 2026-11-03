const router = require('express').Router();
const { protectAdmin, superAdminOnly } = require('../../middleware/adminAuth');
const { getTeam, createTeamMember, updateTeamMember, mergeTeamMember, deleteTeamMember } = require('../../controllers/admin/adminTeamController');

router.use(protectAdmin);
router.get('/', getTeam);
router.post('/', superAdminOnly, createTeamMember);
router.put('/:id', superAdminOnly, updateTeamMember);
router.post('/:id/merge', superAdminOnly, mergeTeamMember);
router.delete('/:id', superAdminOnly, deleteTeamMember);

module.exports = router;
