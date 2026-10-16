/** Разовые обновления данных новой версии (см. lib/data-upgrades.ts). Запуск: npm run db:upgrade-data */
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { runDataUpgrades } from "@/lib/data-upgrades";

runDataUpgrades(prisma)
  .then((log) => log.forEach((line) => console.log(`  • ${line}`)))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
