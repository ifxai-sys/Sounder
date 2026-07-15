const nodemailer = require("nodemailer");

// Real SMTP — but on port 2525 instead of the usual 465/587.
// Why: Render's free plan blocks outbound traffic on ports 25, 465, and 587
// to prevent spam abuse. Port 2525 is NOT on that blocked list, and most
// SMTP relay providers (Mailgun, SendGrid, SMTP2GO, Elastic Email, etc.)
// support sending over 2525 specifically for this reason. Gmail itself only
// offers 465/587, so Gmail cannot be used here on the free Render plan —
// this only works with a provider that explicitly supports port 2525.
//
// Set these in your .env / Render environment variables:
//   SMTP_HOST=smtp.your-provider.com   (from whichever provider you sign up with)
//   SMTP_PORT=2525
//   SMTP_USER=your_smtp_username
//   SMTP_PASS=your_smtp_password_or_key
//   EMAIL_FROM=an_email_address_verified_with_that_provider

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 2525,
    secure: false, // port 2525 uses STARTTLS, not implicit SSL
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const sendResetPasswordEmail = async (toEmail, resetUrl) => {
    await transporter.sendMail({
        from: `"Sounder" <${process.env.EMAIL_FROM}>`,
        to: toEmail,
        subject: "Reset your Sounder password",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#021f18;">Reset your password</h2>
                <p>We received a request to reset your Sounder account password. This link expires in 15 minutes.</p>
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

const sendOTPEmail = async (toEmail, otp) => {
    await transporter.sendMail({
        from: `"Sounder" <${process.env.EMAIL_FROM}>`,
        to: toEmail,
        subject: "Verify your Sounder account",
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#021f18;">Verify your email</h2>
                <p>Thanks for signing up for Sounder! Use the code below to verify your account. This code expires in 10 minutes.</p>
                <p style="margin: 24px 0; text-align:center;">
                    <span style="display:inline-block; background:#f4b400; color:#021f18; padding:14px 28px; border-radius:6px; font-size:28px; font-weight:bold; letter-spacing:6px;">
                        ${otp}
                    </span>
                </p>
                <p>If you didn't create a Sounder account, you can safely ignore this email.</p>
            </div>
        `
    });
};

module.exports = { sendResetPasswordEmail, sendOTPEmail };
