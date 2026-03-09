/**
 * Permission Middleware for Module and Role-Based Access Control
 */

export const requireModule = (module) => {
  return (req, res, next) => {
    const { user } = req;

    if (!user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // SUPER_ADMIN has access to all modules
    if (user.role === "SUPER_ADMIN") return next();

    const userModules = user.modules || [];
    if (userModules.includes(module)) return next();

    return res.status(403).json({
      message: `Access denied. ${module} module access required.`,
    });
  };
};

export const requireAdmin = (req, res, next) => {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const allowedRoles = ["ADMIN", "SUPER_ADMIN"];
  if (allowedRoles.includes(user.role)) return next();

  return res.status(403).json({
    message: "Admin access required for this operation",
  });
};

export const requireSuperAdmin = (req, res, next) => {
  const { user } = req;

  if (!user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (user.role === "SUPER_ADMIN") return next();

  return res.status(403).json({
    message: "Super admin access required for this operation",
  });
};

export const userCan = (user, module, action = "view") => {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN") return true;

  const userModules = user.modules || [];
  if (!userModules.includes(module)) return false;

  if (action === "view") return true;
  return ["ADMIN", "SUPER_ADMIN"].includes(user.role);
};
