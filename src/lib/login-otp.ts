import { prisma } from "@/lib/prisma";
import { sendEmail, loginCodeEmailHtml } from "@/lib/email";
import {
  generateVerificationCode,
  getVerificationExpiry,
  hashVerificationCode,
} from "@/lib/verification-code";
import { maskPhoneE164 } from "@/lib/phone/e164";
import { sendWhatsAppLoginOtp, whatsappConfigured } from "@/lib/whatsapp";

export type LoginOtpChannel = "email" | "whatsapp";

export async function issueLoginOtp(input: {
  user: { id: bigint; name: string; email: string; phoneE164?: string | null };
  channel: LoginOtpChannel;
}): Promise<
  | {
      ok: true;
      requiresLoginCode: true;
      channel: LoginOtpChannel;
      message: string;
      email?: string;
      phoneE164?: string;
      devCode?: string;
    }
  | { ok: false; status: number; error: string }
> {
  const loginCode = generateVerificationCode();
  const loginOtpHash = await hashVerificationCode(loginCode);
  const loginOtpExpiresAt = getVerificationExpiry();

  await prisma.user.update({
    where: { id: input.user.id },
    data: { loginOtpHash, loginOtpExpiresAt },
  });

  if (input.channel === "whatsapp") {
    const phone = input.user.phoneE164;
    if (!phone) {
      return {
        ok: false,
        status: 400,
        error: "Esta cuenta no tiene celular registrado para WhatsApp",
      };
    }

    if (!whatsappConfigured()) {
      if (process.env.NODE_ENV === "development") {
        return {
          ok: true,
          requiresLoginCode: true,
          channel: "whatsapp",
          message: "WhatsApp no está configurado. Usa el código de desarrollo.",
          phoneE164: maskPhoneE164(phone),
          devCode: loginCode,
        };
      }
      return {
        ok: false,
        status: 503,
        error: "WhatsApp no está disponible. Usa correo o contraseña.",
      };
    }

    const sent = await sendWhatsAppLoginOtp({ toE164: phone, code: loginCode });
    if (!sent.ok) {
      if (process.env.NODE_ENV === "development") {
        return {
          ok: true,
          requiresLoginCode: true,
          channel: "whatsapp",
          message: "No se pudo enviar por WhatsApp. Usa el código de desarrollo.",
          phoneE164: maskPhoneE164(phone),
          devCode: loginCode,
        };
      }
      return {
        ok: false,
        status: 503,
        error: "No se pudo enviar el código por WhatsApp. Intenta de nuevo.",
      };
    }

    return {
      ok: true,
      requiresLoginCode: true,
      channel: "whatsapp",
      message: "Te enviamos un código de 6 dígitos por WhatsApp.",
      phoneE164: maskPhoneE164(phone),
      ...(process.env.NODE_ENV === "development" ? { devCode: loginCode } : {}),
    };
  }

  await sendEmail({
    to: input.user.email,
    subject: "Tu código de acceso — cuenti time",
    html: loginCodeEmailHtml(input.user.name, loginCode),
  });

  return {
    ok: true,
    requiresLoginCode: true,
    channel: "email",
    message: "Te enviamos un código de 6 dígitos a tu correo.",
    email: input.user.email,
    ...(process.env.NODE_ENV === "development" ? { devCode: loginCode } : {}),
  };
}
