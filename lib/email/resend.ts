import { Resend } from "resend";
import type { EmailProvider, SendEmailParams } from "./types";

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;
  private from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error(
        "Resend email provider is not configured: set RESEND_API_KEY and EMAIL_FROM"
      );
    }
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(params: SendEmailParams): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    if (error) {
      throw new Error(error.message);
    }
  }
}
