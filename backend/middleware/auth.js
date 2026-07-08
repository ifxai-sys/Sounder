const jwt  = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.id).select("-password");
            if (!user) {
                return res.status(401).json({ message: "Not authorized, user not found" });
            }
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({ message: "Not authorized, invalid token" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

// Guards the admin-only routes (creating/editing/deleting products).
// This does NOT look anything up in the User collection — it only accepts
// tokens issued by POST /api/auth/admin-login, which itself only succeeds
// against the ADMIN_EMAIL / ADMIN_PASSWORD environment variables. Regular
// customer accounts (even logged-in ones) will never pass this check.
const requireAdmin = (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded.isAdmin) {
                return res.status(403).json({ message: "Admin access required" });
            }
            req.isAdmin = true;
            next();
        } catch (error) {
            return res.status(401).json({ message: "Not authorized, invalid token" });
        }
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
};

module.exports = { protect, requireAdmin };

