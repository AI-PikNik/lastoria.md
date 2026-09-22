import nodemailer, { type Transporter } from "nodemailer";
import type { EmailProvider, SendEmailParams } from "./types";

/**
 * Отправка почты через произвольный SMTP-сервер (например, собственный
 * почтовый сервер на хостинге, Яндекс.Почта, Mail.ru и т.п.) — альтернатива
 * Resend для тех, кто не хочет заводить сторонний почтовый сервис.
 */
export class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    if (!host || !from) {
      throw new Error(
        "SMTP email provider is not configured: set SMTP_HOST and EMAIL_FROM"
      );
    }

    this.from = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && password ? { user, pass: password } : undefined,
    });
  }

  async send(params: SendEmailParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  }
}
