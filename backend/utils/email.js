// Sends email via Brevo's HTTPS API instead of raw SMTP.
// Why: Render's free plan blocks outbound traffic on SMTP ports (25, 465, 587)
// to prevent spam abuse — this breaks nodemailer/Gmail SMTP entirely on free
// instances (requests just hang until timeout). Brevo's API runs over normal
// HTTPS (port 443), which isn't blocked, so this works on the free plan.
//
// Setup (one-time, free):
// 1. Sign up at https://www.brevo.com
// 2. Go to Senders, Domains & Dedicated IPs → Senders → add and verify your
//    own email address (a simple confirmation email, no domain needed).
// 3. Go to SMTP & API → API Keys → generate a key.
// 4. Set these in your .env / Render environment variables:
//      BREVO_API_KEY=your_api_key
//      BREVO_SENDER_EMAIL=the_email_you_verified@example.com

const sendResetPasswordEmail = async (toEmail, resetUrl) => {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "api-key": process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
            sender: { name: "Sounder", email: process.env.BREVO_SENDER_EMAIL },
            to: [{ email: toEmail }],
            subject: "Reset your Sounder password",
            htmlContent: `
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
        })
    });

    if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`Brevo API error (${res.status}): ${errorBody}`);
    }
};

module.exports = { sendResetPasswordEmail };
