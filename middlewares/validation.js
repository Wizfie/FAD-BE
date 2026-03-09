import validator from "validator";

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Sanitize string inputs
  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === "string") {
        // Remove potential XSS
        obj[key] = validator.escape(obj[key]);
        // Trim whitespace
        obj[key] = obj[key].trim();
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

// Validate login input
export const validateLogin = (req, res, next) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: "Username must be 3-50 characters" });
  }

  if (password.length < 6) {
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });
  }

  next();
};

// Validate file upload
export const validateFileUpload = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "No files uploaded" });
  }

  // Check file count limit
  if (req.files.length > 10) {
    return res
      .status(400)
      .json({ error: "Too many files. Maximum 10 files allowed" });
  }

  next();
};
