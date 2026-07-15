const express = require("express");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User    = require("../models/User");
const { protect } = require("../middleware/auth");
const { sendResetPasswordEmail, sendOTPEmail } = require("../utils/email");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper: generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
};

// Helper: generate a 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper: create an OTP for a user, save it, and email it to them
const issueOTP = async (user) => {
    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();
    await sendOTPEmail(user.email, otp);
};

// ── POST /api/auth/signup ──
router.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Validate fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        // Create user (password hashed automatically by the model)
        const user = await User.create({ firstName, lastName, email, password });

        // Send an OTP so the user can verify their email before logging in
        try {
            await issueOTP(user);
        } catch (emailError) {
            console.error("OTP email send error:", emailError.message);
            // Keep the account either way - user can request a new OTP via /resend-otp
        }

        res.status(201).json({
            message: "Account created! We've sent a verification code to your email.",
            needsVerification: true,
            email: user.email
        });

    } catch (error) {
        console.error("Signup error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── POST /api/auth/verify-otp ──
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ message: "Email and code are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "No account found for that email" });
        }

        if (user.isVerified) {
            return res.status(200).json({
                message: "Email already verified",
                token: generateToken(user._id),
                user: {
                    id: user._id,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    isAdmin: user.isAdmin
                }
            });
        }

        if (!user.otp || !user.otpExpires || user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Code has expired. Please request a new one." });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: "Incorrect code. Please try again." });
        }

        user.isVerified = true;
        user.otp = null;
        user.otpExpires = null;
        await user.save();

        res.status(200).json({
            message: "Email verified successfully",
            token: generateToken(user._id),
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error("Verify OTP error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── POST /api/auth/resend-otp ──
router.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "No account found for that email" });
        }

        if (user.isVerified) {
            return res.status(200).json({ message: "Email is already verified. You can log in." });
        }

        await issueOTP(user);
        res.status(200).json({ message: "A new verification code has been sent to your email." });
    } catch (error) {
        console.error("Resend OTP error:", error.message);
        res.status(500).json({ message: "Could not send code. Please try again later." });
    }
});

// ── POST /api/auth/login ──
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        // Require email verification before allowing login
        if (!user.isVerified) {
            return res.status(403).json({
                message: "Please verify your email before logging in.",
                needsVerification: true,
                email: user.email
            });
        }

        res.status(200).json({
            message: "Login successful",
            token: generateToken(user._id),
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });

    } catch (error) {
        console.error("Login error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── GET /api/auth/me ── (protected - test your token)
router.get("/me", protect, async (req, res) => {
    res.status(200).json({
        user: {
            id: req.user._id,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            email: req.user.email,
            isAdmin: req.user.isAdmin
        }
    });
});

// ── POST /api/auth/forgot-password ──
router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });

        // Always return the same message whether or not the user exists —
        // this stops attackers from using this endpoint to find out which
        // emails are registered.
        const genericMessage = { message: "If an account exists for that email, a reset link has been sent." };

        if (!user) {
            return res.status(200).json(genericMessage);
        }

        const rawToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = crypto.createHash("sha256").update(rawToken).digest("hex");
        user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${rawToken}`;

        try {
            await sendResetPasswordEmail(user.email, resetUrl);
        } catch (emailError) {
            console.error("Email send error:", emailError.message);
            // Roll back the token so a broken email service doesn't leave a dangling token
            user.resetPasswordToken = null;
            user.resetPasswordExpires = null;
            await user.save();
            return res.status(500).json({ message: "Could not send reset email. Please try again later." });
        }

        res.status(200).json(genericMessage);
    } catch (error) {
        console.error("Forgot password error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── POST /api/auth/reset-password/:token ──
router.post("/reset-password/:token", async (req, res) => {
    try {
        const { password } = req.body;
        if (!password || password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        const hashedToken = crypto.createHash("sha256").update(req.params.token).digest("hex");
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Reset link is invalid or has expired" });
        }

        user.password = password; // hashed automatically by the pre-save hook
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();

        res.status(200).json({ message: "Password has been reset. You can now log in." });
    } catch (error) {
        console.error("Reset password error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── POST /api/auth/google ── (Sign in / sign up with Google ID token)
router.post("/google", async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: "Missing Google credential" });
        }

        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();

        let user = await User.findOne({ email: payload.email });

        if (!user) {
            user = await User.create({
                firstName: payload.given_name || "Sounder",
                lastName: payload.family_name || "User",
                email: payload.email,
                googleId: payload.sub,
                password: undefined,
                isVerified: true // Google has already verified this email
            });
        } else if (!user.googleId) {
            // Existing email/password account signing in with Google for the first time — link it
            user.googleId = payload.sub;
            if (!user.isVerified) user.isVerified = true;
            await user.save();
        }

        res.status(200).json({
            message: "Signed in with Google",
            token: generateToken(user._id),
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                isAdmin: user.isAdmin
            }
        });
    } catch (error) {
        console.error("Google auth error:", error.message);
        res.status(401).json({ message: "Google sign-in failed" });
    }
});

module.exports = router;
