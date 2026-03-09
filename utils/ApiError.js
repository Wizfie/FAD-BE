class ApiError extends Error {
  constructor(
    statusCode = 500,
    message = "Internal Server Error",
    code = undefined,
    meta = undefined
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.meta = meta;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      meta: this.meta,
    };
  }

  static from(err) {
    if (err instanceof ApiError) return err;
    const apiErr = new ApiError(500, err.message || "Internal Server Error");
    apiErr.original = err;
    return apiErr;
  }
}

// Static helper methods untuk convenience
ApiError.badRequest = (message = "Bad Request", codeOrMeta, meta) => {
  const code = typeof codeOrMeta === "string" ? codeOrMeta : undefined;
  const metaVal = typeof codeOrMeta === "string" ? meta : codeOrMeta;
  return new ApiError(400, message, code || "BAD_REQUEST", metaVal);
};

ApiError.unauthorized = (message = "Unauthorized", codeOrMeta, meta) => {
  const code = typeof codeOrMeta === "string" ? codeOrMeta : undefined;
  const metaVal = typeof codeOrMeta === "string" ? meta : codeOrMeta;
  return new ApiError(401, message, code || "UNAUTHORIZED", metaVal);
};

ApiError.forbidden = (message = "Forbidden", codeOrMeta, meta) => {
  const code = typeof codeOrMeta === "string" ? codeOrMeta : undefined;
  const metaVal = typeof codeOrMeta === "string" ? meta : codeOrMeta;
  return new ApiError(403, message, code || "FORBIDDEN", metaVal);
};

ApiError.notFound = (message = "Not Found", codeOrMeta, meta) => {
  const code = typeof codeOrMeta === "string" ? codeOrMeta : undefined;
  const metaVal = typeof codeOrMeta === "string" ? meta : codeOrMeta;
  return new ApiError(404, message, code || "NOT_FOUND", metaVal);
};

ApiError.conflict = (message = "Conflict", codeOrMeta, meta) => {
  const code = typeof codeOrMeta === "string" ? codeOrMeta : undefined;
  const metaVal = typeof codeOrMeta === "string" ? meta : codeOrMeta;
  return new ApiError(409, message, code || "CONFLICT", metaVal);
};

ApiError.internal = (message = "Internal Server Error", codeOrMeta, meta) => {
  const code = typeof codeOrMeta === "string" ? codeOrMeta : undefined;
  const metaVal = typeof codeOrMeta === "string" ? meta : codeOrMeta;
  return new ApiError(500, message, code || "INTERNAL_ERROR", metaVal);
};

export default ApiError;
