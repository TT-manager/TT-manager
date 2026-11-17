"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";
import { LanguageSwitch } from "./language-switch";
import { InstallApp } from "./install-app";

type Item = { href: string; label: string; icon: IconName };

/** Menu a tendina (hamburger) per chi ha fatto l'accesso. Si chiude cambiando pagina, toccando fuori o con Esc. */
export function AccountMenu({ items, logout, logoutLabel, menuLabel, languageLabel, install }: {
  items: Item[]; logout: () => Promise<void>; logoutLabel: string; menuLabel: string; languageLabel: string;
  install: { install: string; iosTitle: string; iosStep1: string; iosStep2: string; iosStep3: string; close: string };
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(path);
  if (path !== lastPath) { setLastPath(path); setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-label={menuLabel} onClick={() => setOpen(!open)}
        className={`flex h-10 w-10 items-center justify-center rounded-md transition ${open ? "bg-white/15" : "hover:bg-white/10"}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-white/10 bg-ink py-1.5 text-base shadow-2xl">
          {items.map((x) => (
            <Link key={x.href} href={x.href} aria-current={active(x.href) ? "page" : undefined}
              className={`flex items-center gap-3 px-4 py-2.5 hover:bg-white/10 ${active(x.href) ? "border-l-4 border-brand bg-white/5 font-semibold" : "border-l-4 border-transparent"}`}>
              <Icon name={x.icon} className="h-5 w-5 shrink-0 text-white/70" />{x.label}
            </Link>))}
          <InstallApp labels={install} className="border-t border-white/10 pt-1" />
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
            <span className="text-sm text-white/70">{languageLabel}</span>
            <LanguageSwitch label={languageLabel} onDark />
          </div>
          <form action={logout} className="border-t border-white/10 pt-1">
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-white/70 hover:bg-white/10">
              <Icon name="logout" className="h-5 w-5 shrink-0" />{logoutLabel}</button>
          </form>
        </div>)}
    </div>
  );
}
