import { prisma } from "../utils/prisma.js";
import bcrypt from "bcrypt";
import { changeLog } from "./changeLogController.js";

/**
 * Handler ambil semua user dengan pagination dan filter
 */
export const getUsers = async (req, res) => {
  try {
    const { q, role, status, page = 1, pageSize = 10 } = req.query;

    const pageNum = parseInt(page);
    const limit = parseInt(pageSize);
    const skip = (pageNum - 1) * limit;

    // Bangun where clause
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

    // Ambil last login untuk setiap user dari changeLog
    const usersWithLastLogin = await Promise.all(
      users.map(async (user) => {
        // Query menggunakan raw SQL untuk MySQL JSON field
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

        return {
          ...user,
          lastLogin: lastLoginData
            ? {
                timestamp: lastLoginData.createdAt,
                ip: lastLoginData.data?.ip || null,
              }
            : null,
        };
      })
    );

    const totalPages = Math.ceil(total / limit);

    res.json({
      data: usersWithLastLogin,
      meta: {
        total,
        page: pageNum,
        pageSize: limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Update data user
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, status, password } = req.body;

    const updateData = {
      username,
      email,
      role,
      status,
      updatedAt: new Date(),
    };

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
        (key) => key !== "updatedAt"
      ),
    });

    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.code === "P2002") {
      res.status(400).json({ error: "Username already exists" });
    } else if (error.code === "P2025") {
      res.status(404).json({ error: "User not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

/**
 * Hapus user (soft delete dengan set status ke INACTIVE)
 */
export const deleteUser = async (req, res) => {
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

    res.json({ message: "User deactivated successfully", user });
  } catch (error) {
    console.error("Error deleting user:", error);
    if (error.code === "P2025") {
      res.status(404).json({ error: "User not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

/**
 * Ambil user berdasarkan ID dengan last login
 */
export const getUserById = async (req, res) => {
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
      return res.status(404).json({ error: "User not found" });
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

    res.json({ user: userWithLastLogin });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * Test endpoint untuk debug last login
 */
export const testLastLogin = async (req, res) => {
  try {
    const { userId } = req.params;

    // Debug: Cek semua login logs untuk user ini
    const allLogins = await prisma.changeLog.findMany({
      where: {
        model: "USER",
        action: "LOGIN",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Test raw query
    const rawLogin = await prisma.$queryRaw`
      SELECT createdAt, data 
      FROM ChangeLog 
      WHERE model = 'USER' 
      AND action = 'LOGIN' 
      AND JSON_EXTRACT(data, '$.userId') = ${userId}
      ORDER BY createdAt DESC 
      LIMIT 1
    `;

    res.json({
      userId,
      allLogins: allLogins.map((log) => ({
        id: log.id,
        createdAt: log.createdAt,
        data: log.data,
      })),
      rawQuery: rawLogin,
    });
  } catch (error) {
    console.error("Error testing last login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
