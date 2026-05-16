const express = require('express');
const router = express.Router();
const admin = require('../controllers/admin.controller');
const { authenticate } = require('../middleware/auth');
const { roleCheck } = require('../middleware/roleCheck');

// All admin routes require authentication + admin/master_admin role
router.use(authenticate, roleCheck('admin', 'master_admin'));

router.get('/users', admin.listUsers);
router.get('/stats', admin.stats);
router.post('/create-admin', admin.createAdmin);
router.patch('/users/:id/role', admin.updateRole);
router.patch('/users/:id/toggle', admin.toggleActive);
router.delete('/users/:id', admin.deleteUser);

module.exports = router;
