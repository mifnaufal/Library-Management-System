const crypto = require("crypto");

function requestId() {
  return (req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader("x-request-id", req.id);
    next();
  };
}

module.exports = { requestId };

