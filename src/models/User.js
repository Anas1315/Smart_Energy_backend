const db = require('../config/database');
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

const User = {
  // ========== HELPERS ==========
  isRealEmail(email) {
    const realDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'me.com', 'live.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return realDomains.includes(domain);
  },

  // ========== CREATE ==========
  create({ username, email, password, phone_number = null, role = 'user', created_by = null }) {
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    const stmt = db.prepare(`
      INSERT INTO users (username, email, phone_number, password, role, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, email, phone_number, hash, role, created_by);
    return this.findById(result.lastInsertRowid);
  },

  // ========== FIND ==========
  findById(id) {
    return db.prepare('SELECT id, username, email, phone_number, role, is_active, is_verified, two_factor_enabled, created_by, created_at FROM users WHERE id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  },

  findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM users WHERE phone_number = ?').get(phone);
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
  // ========== OTP & VERIFICATION ==========
  generateOTP(user_id, type = '2fa') {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    db.prepare('DELETE FROM verification_codes WHERE user_id = ? AND type = ?').run(user_id, type);
    db.prepare("INSERT INTO verification_codes (user_id, code, type, expires_at) VALUES (?, ?, ?, datetime('now', '+10 minutes'))").run(user_id, code, type);
    
    console.log(`\n🔑 [OTP] Sent to user ${user_id}: ${code} (Type: ${type})`);
    return code;
  },

  verifyOTP(user_id, code, type) {
    const row = db.prepare(`
      SELECT * FROM verification_codes 
      WHERE user_id = ? AND code = ? AND type = ? AND expires_at > datetime('now')
    `).get(user_id, code, type);
    
    if (row) {
      db.prepare('DELETE FROM verification_codes WHERE id = ?').run(row.id);
      return true;
    }
    return false;
  },

  updatePassword(id, newPassword) {
    const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, id);
  },

  updateVerified(id, is_verified) {
    db.prepare("UPDATE users SET is_verified = ?, updated_at = datetime('now') WHERE id = ?").run(is_verified ? 1 : 0, id);
  },
};

module.exports = User;
