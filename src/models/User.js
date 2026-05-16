const db = require('../config/database');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const User = {
  // ========== CREATE ==========
  create({ username, email, password, role = 'user', created_by = null }) {
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const stmt = db.prepare(`
      INSERT INTO users (username, email, password, role, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, email, hash, role, created_by);
    return this.findById(result.lastInsertRowid);
  },

  // ========== FIND ==========
  findById(id) {
    return db.prepare('SELECT id, username, email, role, is_active, created_by, created_at FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  // ========== LIST ==========
  findAll() {
    return db.prepare('SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC').all();
  },

  findByRole(role) {
    return db.prepare('SELECT id, username, email, role, is_active, created_at FROM users WHERE role = ? ORDER BY created_at DESC').all(role);
  },

  // ========== UPDATE ==========
  updateRole(id, role) {
    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(role, id);
    return this.findById(id);
  },

  toggleActive(id, is_active) {
    db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(is_active ? 1 : 0, id);
    return this.findById(id);
  },

  deleteUser(id) {
    return db.prepare("DELETE FROM users WHERE id = ? AND role != 'master_admin'").run(id);
  },

  // ========== AUTH HELPERS ==========
  verifyPassword(plainPassword, hashedPassword) {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  },

  masterAdminExists() {
    const row = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'master_admin'").get();
    return row.count > 0;
  },

  getUserCount() {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
    return row.count;
  },

  // ========== LOGIN HISTORY ==========
  logLogin(user_id, ip_address, user_agent) {
    db.prepare('INSERT INTO login_history (user_id, ip_address, user_agent) VALUES (?, ?, ?)').run(user_id, ip_address, user_agent);
  },

  getLoginHistory(user_id, limit = 10) {
    return db.prepare('SELECT * FROM login_history WHERE user_id = ? ORDER BY logged_at DESC LIMIT ?').all(user_id, limit);
  },
};

module.exports = User;
