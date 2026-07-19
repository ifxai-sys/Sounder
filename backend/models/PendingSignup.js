const mongoose = require("mongoose");

// Holds a signup that is waiting for email OTP verification.
// The real User document is only created after the code is confirmed,
// so no unverified accounts ever land in the users collection.
const pendingSignupSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,          // already bcrypt-hashed before saving
        required: true
    },
    otp: {
        type: String,          // sha256 hash of the 6-digit code
        required: true
    },
    otpExpires: {
        type: Date,
        required: true
    },
    attempts: {
        type: Number,          // wrong guesses so far (max 5)
        default: 0
    },
    lastSentAt: {
        type: Date,            // for resend rate-limiting
        default: Date.now
    }
}, {
    timestamps: true
});

// Auto-delete abandoned signups 30 minutes after creation
pendingSignupSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 60 });

module.exports = mongoose.model("PendingSignup", pendingSignupSchema);
