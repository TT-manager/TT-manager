import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage } from "@/i18n/locale";

// Rinnova la sessione di login (cookie) e manda al login chi non è entrato in /admin.
// Il controllo vero dei permessi è fatto di nuovo in ogni pagina/azione (requireAdmin).
export async function proxy(request: NextRequest) {
  // Prima visita: lingua dal browser, ricordata in un cookie (poi si cambia dal footer).
  const newLocale = isLocale(request.cookies.get(LOCALE_COOKIE)?.value) ? null : localeFromAcceptLanguage(request.headers.get("accept-language"));
  if (newLocale) request.cookies.set(LOCALE_COOKIE, newLocale);
  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && request.nextUrl.pathname.startsWith("/admin")) {
    response = NextResponse.redirect(new URL("/login", request.url));
  }
  if (newLocale) response.cookies.set(LOCALE_COOKIE, newLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  return response;
}

// Su tutte le pagine (tranne file statici), così la sessione resta sempre valida.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
