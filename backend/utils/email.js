// Gmail API (OAuth2) — sends real email through your own Gmail account
// (ifxai921@gmail.com), using Google's own infrastructure. No domain
// verification needed, no SMTP ports involved (pure HTTPS, so Render's
// port blocking is a non-issue), and it can send to ANY recipient
// immediately — not limited to a sandbox/test address like Resend was.
//
// Set these in your .env / Render environment variables:
//   GMAIL_USER=ifxai921@gmail.com
//   GMAIL_CLIENT_ID=...          (from the "Sounder Web" OAuth client)
//   GMAIL_CLIENT_SECRET=...      (from the same OAuth client)
//   GMAIL_REFRESH_TOKEN=...      (generated once via OAuth Playground)

const { OAuth2Client } = require("google-auth-library");

const gmailOAuth2Client = new OAuth2Client(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
);
gmailOAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

// Base64url-encode a raw RFC 2822 email so it can be handed to the
// Gmail API's messages.send endpoint.
const buildRawMessage = ({ to, subject, html }) => {
    const from = process.env.GMAIL_USER;
    const messageParts = [
        `From: "Sounder" <${from}>`,
        `To: ${to}`,
        `Subject: =?utf-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=utf-8",
        "",
        html
    ];
    const message = messageParts.join("\r\n");

    return Buffer.from(message)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
};

const sendEmail = async ({ to, subject, html }) => {
    const { token: accessToken } = await gmailOAuth2Client.getAccessToken();

    const response = await fetch(
        "https://www.googleapis.com/gmail/v1/users/me/messages/send",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ raw: buildRawMessage({ to, subject, html }) })
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Gmail API error (${response.status}): ${errorBody}`);
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
