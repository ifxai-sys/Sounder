const nodemailer = require("nodemailer");

// Uses SMTP credentials from environment variables.
// For Gmail: EMAIL_USER = your gmail address, EMAIL_PASS = a 16-character
// "App Password" (NOT your normal Gmail password — generate one at
// https://myaccount.google.com/apppasswords, requires 2FA enabled on the account).
// You can swap this for SendGrid/Mailgun/etc. later without changing the calling code.
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const sendResetPasswordEmail = async (toEmail, resetUrl) => {
    await transporter.sendMail({
        from: `"Sounder" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "Reset your Sounder password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#021f18;">Reset your password</h2>
                <p>We received a request to reset your Sounder account password. This link expires in 1 hour.</p>
                <p style="margin: 24px 0;">
                    <a href="${resetUrl}" style="background:#f4b400;color:#021f18;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                        Reset Password
                    </a>
                </p>
                <p>If you didn't request this, you can safely ignore this email.</p>
            </div>
        `
    });
};

module.exports = { sendResetPasswordEmail };
