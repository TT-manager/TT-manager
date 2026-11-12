import "server-only";
import { requireOwner } from "./auth";
import { hasServiceKey } from "./organizer";
import { createServiceClient } from "./supabase/admin";

/** Elenco degli admin (non proprietari) con email, per la scelta degli admin di lega. */
export async function listAdminUsers() {
  await requireOwner();
  if (!hasServiceKey()) return [];
  const svc = createServiceClient();
  const { data: rows } = await svc.from("admins").select("user_id, role");
  return Promise.all((rows ?? []).filter((r) => r.role === "admin").map(async (r) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id as string);
    return { userId: r.user_id as string, email: data.user?.email ?? "(account eliminato)" };
  }));
}
