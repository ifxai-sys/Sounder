// Resend HTTPS API — no SMTP ports involved at all, so Render's free-plan
// port blocking (25, 465, 587) is a non-issue. Also sidesteps the Gmail
// freemail/DKIM/DMARC alignment problem you'd hit trying to send "from"
// a gmail.com address through a third-party relay.
//
// Set this in your .env / Render environment variables:
//   RESEND_API_KEY=your_resend_api_key
//
// EMAIL_FROM is optional — if unset, falls back to Resend's shared,
// pre-verified test sender (onboarding@resend.dev), which works out of
// the box on the free tier without verifying your own domain.

const RESEND_API_URL = "https://api.resend.com/emails";
const FROM_ADDRESS = process.env.EMAIL_FROM || "onboarding@resend.dev";

const sendEmail = async ({ to, subject, html }) => {
    const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            from: `Sounder <${FROM_ADDRESS}>`,
            to: [to],
            subject,
            html
        })
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Resend API error (${response.status}): ${errorBody}`);
    }

    return response.json();
};

const sendResetPasswordEmail = async (toEmail, resetUrl) => {
    await sendEmail({
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

const sendOtpEmail = async (toEmail, code) => {
    await sendEmail({
        to: toEmail,
        subject: `${code} is your Sounder verification code`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color:#021f18;">Verify your email</h2>
                <p>Enter this code to finish creating your Sounder account. It expires in 10 minutes.</p>
                <p style="margin: 24px 0;">
                    <span style="display:inline-block;background:#f4b400;color:#021f18;padding:12px 24px;border-radius:6px;font-size:28px;font-weight:bold;letter-spacing:8px;">
                        ${code}
                    </span>
                </p>
                <p>If you didn't try to sign up, you can safely ignore this email.</p>
            </div>
        `
    });
};

module.exports = { sendResetPasswordEmail, sendOtpEmail };
