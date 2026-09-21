import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/admin/login");
  }
  return session;
}
