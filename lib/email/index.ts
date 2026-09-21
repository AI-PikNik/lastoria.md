import { ConsoleEmailProvider } from "./console";
import { ResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

export type { EmailProvider, SendEmailParams } from "./types";

export function getEmailProvider(): EmailProvider {
  if (process.env.EMAIL_PROVIDER === "resend" && process.env.RESEND_API_KEY) {
    return new ResendEmailProvider();
  }
  return new ConsoleEmailProvider();
}
