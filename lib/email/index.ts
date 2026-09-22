import { ConsoleEmailProvider } from "./console";
import { ResendEmailProvider } from "./resend";
import { SmtpEmailProvider } from "./smtp";
import type { EmailProvider } from "./types";

export type { EmailProvider, SendEmailParams } from "./types";

/**
 * EMAIL_PROVIDER:
 * - "smtp"   — свой почтовый сервер (SMTP_HOST/PORT/USER/PASSWORD), например
 *              почта хостинга, где развёрнут сайт, Яндекс, Mail.ru и т.п.
 * - "resend" — сервис Resend (нужен RESEND_API_KEY)
 * - иначе    — письма пишутся в консоль сервера (по умолчанию для dev)
 */
export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "smtp" && process.env.SMTP_HOST) {
    return new SmtpEmailProvider();
  }
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY) {
    return new ResendEmailProvider();
  }
  return new ConsoleEmailProvider();
}
