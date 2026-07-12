import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "no-reply@transitops.com";

  // --- DEBUG: Log what env vars were read ---
  console.log("[EMAIL] Attempting to send email...");
  console.log("[EMAIL] Config:", {
    host: host ?? "⚠️ MISSING",
    port,
    user: user ? `${user.slice(0, 4)}****` : "⚠️ MISSING",
    pass: pass ? "****" : "⚠️ MISSING",
    from,
    to,
    subject,
  });

  // Fallback: If SMTP is not configured, log to console for local testing
  if (!host || !user || !pass) {
    console.warn("[EMAIL] ⚠️ SMTP credentials missing — falling back to console log.");
    console.log(`\n=== EMAIL START ===\nTo: ${to}\nSubject: ${subject}\n\n${html}\n=== EMAIL END ===\n`);
    return { success: true, message: "Logged to console (no SMTP configured)" };
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Increase timeout to 10s for slow SMTP servers
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  // --- DEBUG: Verify SMTP connection before sending ---
  try {
    console.log("[EMAIL] Verifying SMTP connection...");
    await transporter.verify();
    console.log("[EMAIL] ✅ SMTP connection verified successfully.");
  } catch (verifyError: any) {
    console.error("[EMAIL] ❌ SMTP connection FAILED. Check your credentials and host.");
    console.error("[EMAIL] Verify error:", verifyError?.message ?? verifyError);
    // Throw a descriptive error so we know exactly what failed
    throw new Error(`SMTP connection failed: ${verifyError?.message}`);
  }

  // --- Send the actual email ---
  try {
    console.log(`[EMAIL] Sending email to: ${to}`);
    const info = await transporter.sendMail({ from, to, subject, html });
    console.log(`[EMAIL] ✅ Email sent! Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (sendError: any) {
    console.error("[EMAIL] ❌ sendMail failed:", sendError?.message ?? sendError);
    throw new Error(`Failed to send email: ${sendError?.message}`);
  }
}
