import { connection } from "next/server";
import { requireOwner } from "@/lib/auth";
import { backupDownloadUrl } from "@/lib/backup";

/** Scarica una copia: controlla che sia il proprietario e manda a un collegamento temporaneo. */
export async function GET(request: Request) {
  await connection();
  await requireOwner();
  const name = new URL(request.url).searchParams.get("f") ?? "";
  if (!/^(giornaliera|manuale)-[\d_-]+\.json$/.test(name)) return new Response("Not found", { status: 404 });
  const url = await backupDownloadUrl(name);
  if (!url) return new Response("Not found", { status: 404 });
  return Response.redirect(url, 303);
}
