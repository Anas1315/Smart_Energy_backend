/**
 * Role-based access control middleware.
 * Must be used AFTER the authenticate middleware.
 *
 * Usage: roleCheck('admin', 'master_admin')
 */
function roleCheck(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { roleCheck };
