export const commercialEmailAddress = "ventas@indexelemecsrl.com";
export const commercialEmailFrom = `INDEX CONDO <${commercialEmailAddress}>`;

export type EmailProviderConfig =
  | { kind: "private_email"; from: string; replyTo: string }
  | { kind: "resend"; from: string; replyTo: string };

export function resolveEmailProvider(env: Record<string, string | undefined>): EmailProviderConfig | undefined {
  if (env.PRIVATE_EMAIL_SMTP_PASSWORD) {
    return { kind: "private_email", from: commercialEmailFrom, replyTo: commercialEmailAddress };
  }

  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return { kind: "resend", from: env.EMAIL_FROM, replyTo: env.EMAIL_REPLY_TO || commercialEmailAddress };
  }

  return undefined;
}
