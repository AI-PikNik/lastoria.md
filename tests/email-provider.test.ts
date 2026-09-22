import { describe, expect, it, afterEach } from "vitest";
import { getEmailProvider } from "@/lib/email";
import { ConsoleEmailProvider } from "@/lib/email/console";
import { SmtpEmailProvider } from "@/lib/email/smtp";
import { ResendEmailProvider } from "@/lib/email/resend";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "EMAIL_FROM",
  "RESEND_API_KEY",
] as const;

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe("getEmailProvider", () => {
  afterEach(() => {
    clearEnv();
  });

  it("по умолчанию (без EMAIL_PROVIDER) выбирает консольный провайдер", () => {
    clearEnv();
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("EMAIL_PROVIDER=smtp с заполненными SMTP_HOST/EMAIL_FROM выбирает SMTP", () => {
    clearEnv();
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.EMAIL_FROM = "no-reply@lastoria.md";
    expect(getEmailProvider()).toBeInstanceOf(SmtpEmailProvider);
  });

  it("EMAIL_PROVIDER=smtp без SMTP_HOST откатывается на консоль (не настроено)", () => {
    clearEnv();
    process.env.EMAIL_PROVIDER = "smtp";
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("EMAIL_PROVIDER=resend с ключом выбирает Resend", () => {
    clearEnv();
    process.env.EMAIL_PROVIDER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "no-reply@lastoria.md";
    expect(getEmailProvider()).toBeInstanceOf(ResendEmailProvider);
  });

  it("EMAIL_PROVIDER=resend без ключа откатывается на консоль", () => {
    clearEnv();
    process.env.EMAIL_PROVIDER = "resend";
    expect(getEmailProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });
});
