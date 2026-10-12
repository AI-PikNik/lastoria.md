/** Применить администратора из .env (см. lib/admin-env-sync.ts). Запуск: npm run admin:sync */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncAdminFromEnv } from "@/lib/admin-env-sync";

const MESSAGES = {
  created: "создан администратор",
  updated: "пароль администратора обновлён из .env",
  unchanged: "администратор из .env уже применён, изменений нет",
  skipped: "ADMIN_EMAIL или ADMIN_PASSWORD не заданы в .env — пропущено",
} as const;

syncAdminFromEnv(prisma)
  .then(({ result, email }) => console.log(`Администратор ${email || ""}: ${MESSAGES[result]}`))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
