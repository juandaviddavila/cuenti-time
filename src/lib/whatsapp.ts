import { e164ToWhatsAppTo, normalizeToE164 } from "@/lib/phone/e164";

export interface WhatsAppSendResult {
  ok: boolean;
  reason?: "disabled" | "invalid_phone" | "provider_error";
  message?: string;
}

function isWhatsAppEnabled(): boolean {
  const flag = (process.env.WHATSAPP_ENABLED ?? "").toLowerCase();
  const enabled = flag === "true" || flag === "1" || flag === "yes";
  return enabled && Boolean(process.env.WHATSAPP_ACCESS_TOKEN);
}

export function whatsappConfigured(): boolean {
  return isWhatsAppEnabled();
}

export async function sendWhatsAppLoginOtp(input: {
  toE164: string;
  code: string;
}): Promise<WhatsAppSendResult> {
  if (!isWhatsAppEnabled()) {
    return { ok: false, reason: "disabled", message: "WhatsApp no está configurado" };
  }

  const e164 = normalizeToE164(input.toE164);
  if (!e164) {
    return { ok: false, reason: "invalid_phone", message: "Celular inválido" };
  }

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "1027844720412230";
  const version = (process.env.WHATSAPP_GRAPH_API_VERSION || "v26.0").replace(
    /^\/+/,
    ""
  );
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME?.trim() || "sign_cuenti_otp";
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "es";
  const to = e164ToWhatsAppTo(e164);
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: language },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: input.code }],
            },
            {
              type: "button",
              sub_type: "url",
              index: "0",
              parameters: [{ type: "text", text: input.code }],
            },
          ],
        },
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };

    if (!response.ok) {
      console.warn("[whatsapp] OTP send failed", payload.error?.message ?? response.status);
      return {
        ok: false,
        reason: "provider_error",
        message: payload.error?.message ?? `HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "provider_error", message: "network_error" };
  }
}
