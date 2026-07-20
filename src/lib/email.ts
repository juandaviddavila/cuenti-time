import nodemailer from "nodemailer";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export async function sendEmail(options: SendEmailOptions) {
  if (!hasSmtpConfig()) {
    console.warn(`SMTP no configurado. Email omitido para ${options.to}: ${options.subject}`);
    return { skipped: true };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? "noreply@cuenti.co",
    to: options.to,
    subject: options.subject,
    html: options.html,
  });

  return { skipped: false };
}

export function verificationCodeEmailHtml(name: string, code: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <h1 style="color:#f97316">Tu código de verificación</h1>
      <p>Hola ${name},</p>
      <p>Usa este código para verificar tu cuenta en cuenti time:</p>
      <p style="margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;color:#f97316">${code}</p>
      <p>El código vence en 15 minutos.</p>
      <p style="font-size:12px;color:#6b7280">Si no solicitaste esta cuenta, puedes ignorar este mensaje.</p>
    </div>
  `;
}

export function loginCodeEmailHtml(name: string, code: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111827">
      <h1 style="color:#f97316">Código de acceso</h1>
      <p>Hola ${name},</p>
      <p>Usa este código para completar tu inicio de sesión en cuenti time:</p>
      <p style="margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;color:#f97316">${code}</p>
      <p>El código vence en 15 minutos.</p>
      <p style="font-size:12px;color:#6b7280">Si no intentaste iniciar sesión, cambia tu contraseña de inmediato.</p>
    </div>
  `;
}
