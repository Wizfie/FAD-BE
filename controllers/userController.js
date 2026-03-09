import { prisma } from "../utils/prisma.js";
import bcrypt from "bcrypt";
import { changeLog } from "./changeLogController.js";
import ApiError from "../utils/ApiError.js";

/**
 * Handler ambil semua user dengan pagination dan filter
 */
export const getUsers = async (req, res, next) => {
  try {
    const { q, role, status, page = 1, pageSize = 10 } = req.query;

    const pageNum = parseInt(page);
    const limit = parseInt(pageSize);
    const skip = (pageNum - 1) * limit;

    const where = {};

    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // Ambil user dengan pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          modules: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Ambil last login untuk setiap user dari auditlog
    const usersWithLastLogin = await Promise.all(
      users.map(async (user) => {
        try {
          const allLogs = await prisma.auditLog.findMany({
            where: {
              userId: user.id,
            },
            take: 5,
            orderBy: {
              createdAt: "desc",
            },
          });

          const lastLogin = await prisma.auditLog.findFirst({
            where: {
              entity: "auth",
              operation: "LOGIN_SUCCESS",
              userId: user.id,
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              createdAt: true,
              changes: true,
            },
          });

          return {
            ...user,
            lastLogin: lastLogin
              ? {
                  timestamp: lastLogin.createdAt,
                  ip: lastLogin.changes?.ip || null,
                }
              : null,
          };
        } catch (error) {
          return {
            ...user,
            lastLogin: null,
          };
        }
      }),
    );

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: usersWithLastLogin,
      meta: {
        total,
        page: pageNum,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update data user
 */
export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, email, role, status, password, modules } = req.body;

    // Validate modules for non-SUPER_ADMIN users ONLY if modules is provided
    if (modules !== undefined && role !== "SUPER_ADMIN") {
      if (!Array.isArray(modules) || modules.length === 0) {
        throw ApiError.badRequest(
          "User harus memiliki minimal 1 module access",
          "MISSING_MODULES",
        );
      }
    }

    const updateData = {
      username,
      email,
      role,
      status,
      updatedAt: new Date(),
    };

    // Handle modules - ensure it's an array or null for SUPER_ADMIN
    if (modules !== undefined) {
      updateData.modules = role === "SUPER_ADMIN" ? null : modules;
    }

    // Hash password jika disediakan
    if (password && password.trim()) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        modules: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log user update to changelog
    await changeLog("USER", "UPDATE", {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      updatedFields: Object.keys(updateData).filter(
        (key) => key !== "updatedAt",
      ),
    });

    res.json({ success: true, message: "User updated successfully", user });
  } catch (error) {
    next(error);
  }
};

/**
 * Hapus user (soft delete dengan set status ke INACTIVE)
 */
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.update({
      where: { id },
      data: {
        status: "INACTIVE",
        updatedAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        status: true,
      },
    });

    // Log user deactivation to changelog
    await changeLog("USER", "DELETE", {
      id: user.id,
      username: user.username,
      status: user.status,
      action: "soft_delete_deactivate",
    });

    res.json({ success: true, message: "User deactivated successfully", user });
  } catch (error) {
    next(error);
  }
};

/**
 * Ambil user berdasarkan ID dengan last login
 */
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw ApiError.notFound("User tidak ditemukan", "USER_NOT_FOUND", {
        userId: id,
      });
    }

    // Ambil last login dari changeLog
    const lastLogin = await prisma.$queryRaw`
      SELECT createdAt, data 
      FROM ChangeLog 
      WHERE model = 'USER' 
      AND action = 'LOGIN' 
      AND JSON_EXTRACT(data, '$.userId') = ${user.id}
      ORDER BY createdAt DESC 
      LIMIT 1
    `;

    const lastLoginData =
      lastLogin && lastLogin.length > 0 ? lastLogin[0] : null;

    const userWithLastLogin = {
      ...user,
      lastLogin: lastLoginData
        ? {
            timestamp: lastLoginData.createdAt,
            ip: lastLoginData.data?.ip || null,
          }
        : null,
    };

    res.json({ success: true, user: userWithLastLogin });
  } catch (error) {
    next(error);
  }
};
