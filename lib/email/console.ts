import type { EmailProvider, SendEmailParams } from "./types";

export class ConsoleEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<void> {
    console.log(
      `[email:console] to=${params.to} subject="${params.subject}"\n${params.text}`
    );
  }
}
