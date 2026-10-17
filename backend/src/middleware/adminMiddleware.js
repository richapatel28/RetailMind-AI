const adminAuthenticate = (req, res, next) => {

  const adminKey = req.headers["x-admin-key"];

  if (!adminKey) {
    return res.status(401).json({
      message: "Admin API key required"
    });
  }

  if (adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({
      message: "Invalid admin API key"
    });
  }

  next();
};

module.exports = adminAuthenticate;