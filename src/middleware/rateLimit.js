const rateLimit = require("express-rate-limit");

function authLimiter() {
  return rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: "Too many attempts. Please try again later."
  });
}

function apiLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: "draft-7",
    legacyHeaders: false
  });
}

module.exports = { authLimiter, apiLimiter };

