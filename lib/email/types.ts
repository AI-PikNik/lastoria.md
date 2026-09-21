export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<void>;
}
