import { changeLog } from "./changeLogController.js";
import {
  refreshWithRotation,
  loginUser,
  registerUser,
  revokeRefresh,
} from "../services/authService.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIES_PATH = "/api";

const cookiesOptSet = {
  httpOnly: true,
  // Use 'None' so browser will include the cookie on cross-origin requests when allowed by CORS
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: COOKIES_PATH,
  // secure must be true for SameSite=None; keep it true only in production (HTTPS)
  secure: process.env.NODE_ENV === "production",
  maxAge: SEVEN_DAYS_MS,
};
const cookiesOptClear = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
  path: COOKIES_PATH,
  secure: process.env.NODE_ENV === "production",
};

export const registerController = async (req, res) => {
  const { username, password, role } = req.body;
  try {
    const user = await registerUser(username, password, role);
    await changeLog("USER", "REGISTER", user);
    res.status(201).json({ message: "User registered successfully", user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const loginController = async (req, res) => {
  try {
    const { username, password } = req.body;
    const tokens = await loginUser(username, password);

    // Record login event without logging tokens or session identifiers
    await changeLog("USER", "LOGIN", {
      userId: tokens.user.id,
      username: tokens.user.username,
      ip: req.ip,
    });

    // Send refresh token as httpOnly cookie; access token returned in response body
    res.cookie("refreshToken", tokens.refreshToken, cookiesOptSet);
    res.json({
      message: "Login successful",
      user: tokens.user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    console.error("Login failed:", error);
    res.status(401).json({ error: "Invalid credentials" });
  }
};

export const refreshController = async (req, res) => {
  try {
    // Basic Origin/Referer check to mitigate CSRF when using cookie-based refresh.
    // If ALLOWED_ORIGINS is set, require that request Origin (or Referer host) is allowed.
    const allowed = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
      : [];
    const origin = req.get("origin") || req.get("referer") || null;
    if (allowed.length > 0 && origin) {
      // origin may include path when using referer; extract origin only
      let originHost = origin;
      try {
        const u = new URL(origin);
        originHost = u.origin;
      } catch (e) {
        // if referer contains path, attempt to extract origin
        const m = origin.match(/^(https?:\/\/[^\/]+)/i);
        if (m) originHost = m[1];
      }
      if (!allowed.includes(originHost)) {
        console.warn(
          "Rejected refresh request from disallowed origin:",
          originHost
        );
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    const { refreshToken } = req.cookies;
    if (!refreshToken) throw new Error("No refresh token provided");

    const { accessToken, refreshToken: newRt } = await refreshWithRotation(
      refreshToken
    );
    res.cookie("refreshToken", newRt, cookiesOptSet);
    res.json({ accessToken });
  } catch (error) {
    console.error("Refresh token failed:", error);
    res.clearCookie("refreshToken", cookiesOptClear);
    res.status(401).json({ error: "Could not refresh token" });
  }
};

export const logoutController = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    let revoked = false;
    if (refreshToken) {
      revoked = await revokeRefresh(refreshToken);
    }

    // Always clear cookie on logout request to ensure client-side logout
    res.clearCookie("refreshToken", cookiesOptClear);

    // Inform client about result; still return 200 for idempotent logout
    if (revoked) {
      res.json({ message: "Logged out successfully" });
    } else {
      res.json({ message: "Logged out (no active session found)" });
    }
  } catch (error) {
    console.error("Logout failed:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const meController = async (req, res) => {
  const { id, username, role, status } = req.user;
  res.json({ id, username, role, status });
};
