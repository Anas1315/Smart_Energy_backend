const User = require('../models/User');

const adminController = {
  // GET /api/admin/users — List all users
  listUsers(_req, res) {
    const users = User.findAll();
    res.json({ users });
  },

  // POST /api/admin/create-admin — Create a new admin (master_admin & admin only)
  createAdmin(req, res) {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      const user = User.create({
        username, email, password,
        role: 'admin',
        created_by: req.user.id,
      });
      res.status(201).json({ user, message: 'Admin created successfully' });
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'Username or email already exists' });
      }
      res.status(500).json({ error: 'Failed to create admin' });
    }
  },

  // PATCH /api/admin/users/:id/role — Change user role
  updateRole(req, res) {
    const { id } = req.params;
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "user" or "admin"' });
    }
    const target = User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'master_admin') {
      return res.status(403).json({ error: 'Cannot change master admin role' });
    }
    const updated = User.updateRole(id, role);
    res.json({ user: updated });
  },

  // PATCH /api/admin/users/:id/toggle — Activate/deactivate user
  toggleActive(req, res) {
    const { id } = req.params;
    const target = User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'master_admin') {
      return res.status(403).json({ error: 'Cannot deactivate master admin' });
    }
    const updated = User.toggleActive(id, !target.is_active);
    res.json({ user: updated });
  },

  // DELETE /api/admin/users/:id — Delete a user
  deleteUser(req, res) {
    const { id } = req.params;
    const target = User.findById(id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'master_admin') {
      return res.status(403).json({ error: 'Cannot delete master admin' });
    }
    User.deleteUser(id);
    res.json({ message: 'User deleted' });
  },

  // GET /api/admin/stats — Dashboard stats for admin
  stats(_req, res) {
    const users = User.findAll();
    res.json({
      totalUsers: users.length,
      admins: users.filter(u => u.role === 'admin' || u.role === 'master_admin').length,
      regularUsers: users.filter(u => u.role === 'user').length,
      activeUsers: users.filter(u => u.is_active).length,
    });
  },
};

module.exports = adminController;
