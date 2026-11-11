import { NextResponse, type NextRequest } from "next/server";
import { normalizeCode } from "@/lib/codes";

// Il modulo della home invia ?codice=...: porta alla pagina del torneo.
export function GET(request: NextRequest) {
  const code = normalizeCode(request.nextUrl.searchParams.get("codice") ?? "");
  // Un codice non valido arriva comunque alla pagina, che mostra "Torneo non trovato".
  return NextResponse.redirect(new URL(`/t/${encodeURIComponent(code || "-")}`, request.url));
}
