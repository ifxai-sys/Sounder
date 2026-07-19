const express = require("express");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const bcrypt  = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const User    = require("../models/User");
const PendingSignup = require("../models/PendingSignup");
const { protect } = require("../middleware/auth");
const { sendResetPasswordEmail, sendOtpEmail } = require("../utils/email");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Helper: generate JWT token
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: "7d"
    });
};

// Helper: 6-digit OTP + its sha256 hash (only the hash is stored)
const generateOtp = () => {
    const code = crypto.randomInt(100000, 1000000).toString();
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    return { code, hash };
};

// ── POST /api/auth/signup ── (step 1: validate, store pending signup, email OTP)
router.post("/signup", async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;

        // Validate fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }

        const { code, hash } = generateOtp();
        const hashedPassword = await bcrypt.hash(password, 10);

        // Upsert so retrying signup just refreshes the pending record + code
        await PendingSignup.findOneAndUpdate(
            { email: email.toLowerCase().trim() },
            {
                firstName, lastName,
                email: email.toLowerCase().trim(),
                password: hashedPassword,
                otp: hash,
                otpExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
                attempts: 0,
                lastSentAt: Date.now()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        try {
            await sendOtpEmail(email, code);
        } catch (emailError) {
            console.error("OTP email send error:", emailError.message);
            await PendingSignup.deleteOne({ email: email.toLowerCase().trim() });
            return res.status(500).json({ message: "Could not send verification email. Please try again later." });
        }

        res.status(200).json({
            message: "Verification code sent to your email",
            email: email.toLowerCase().trim()
        });

    } catch (error) {
        console.error("Signup error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
    }
});

// ── POST /api/auth/verify-otp ── (step 2: confirm code, create the real account)
router.post("/verify-otp", async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            return res.status(400).json({ message: "Email and code are required" });
        }

        const pending = await PendingSignup.findOne({ email: String(email).toLowerCase().trim() });
        if (!pending) {
            return res.status(400).json({ message: "No pending signup found. Please sign up again." });
        }

        if (pending.otpExpires < Date.now()) {
            return res.status(400).json({ message: "Code has expired. Please request a new one." });
        }

        if (pending.attempts >= 5) {
            await PendingSignup.deleteOne({ _id: pending._id });
            return res.status(429).json({ message: "Too many wrong attempts. Please sign up again." });
        }

        const hashedCode = crypto.createHash("sha256").update(String(code).trim()).digest("hex");
        if (hashedCode !== pending.otp) {
            pending.attempts += 1;
            await pending.save();
            return res.status(400).json({ message: "Incorrect code. Please try again." });
        }

        // Code is correct — create the real user. Password is already hashed,
        // so tell the pre-save hook not to hash it again.
        const user = new User({
            firstName: pending.firstName,
            lastName: pending.lastName,
            email: pending.email,
            password: pending.password
        });
        user.$locals.passwordAlreadyHashed = true;
        await user.save();

        await PendingSignup.deleteOne({ _id: pending._id });

        res.status(201).json({
            message: "Account created successfully",
            token: generateToken(user._id),
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email
            }
        });

    } catch (error) {
        // Rare race: user was created between signup and verify
        if (error.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }
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

        const pending = await PendingSignup.findOne({ email: String(email).toLowerCase().trim() });
        if (!pending) {
            return res.status(400).json({ message: "No pending signup found. Please sign up again." });
        }

        // Rate limit: one resend per 60 seconds
        if (pending.lastSentAt && Date.now() - pending.lastSentAt.getTime() < 60 * 1000) {
            return res.status(429).json({ message: "Please wait a minute before requesting a new code" });
        }

        const { code, hash } = generateOtp();
        pending.otp = hash;
        pending.otpExpires = Date.now() + 10 * 60 * 1000;
        pending.attempts = 0;
        pending.lastSentAt = Date.now();
        await pending.save();

        try {
            await sendOtpEmail(pending.email, code);
        } catch (emailError) {
            console.error("OTP resend error:", emailError.message);
            return res.status(500).json({ message: "Could not send verification email. Please try again later." });
        }

        res.status(200).json({ message: "A new code has been sent to your email" });
    } catch (error) {
        console.error("Resend OTP error:", error.message);
        res.status(500).json({ message: "Server error, please try again" });
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
                password: undefined
            });
        } else if (!user.googleId) {
            // Existing email/password account signing in with Google for the first time — link it
            user.googleId = payload.sub;
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
