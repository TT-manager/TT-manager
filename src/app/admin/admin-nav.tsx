"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Menu dell'amministrazione: una sola riga che su telefono scorre di lato,
 * con la sezione attuale evidenziata (e portata in vista). Va dentro <Suspense>.
 */
export function AdminNav({ items }: { items: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" : path === href || path.startsWith(`${href}/`));
  const current = useRef<HTMLAnchorElement>(null);
  useEffect(() => { current.current?.scrollIntoView({ block: "nearest", inline: "center" }); }, [path]);
  return (
    <nav className="scroll-row -mx-1 gap-1 px-1 pb-1">
      {items.map((x) => {
        const on = active(x.href);
        return (
          <Link key={x.href} href={x.href} ref={on ? current : undefined} aria-current={on ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 transition ${on ? "bg-brand font-semibold text-white" : "bg-white/5 text-white/85 hover:bg-white/15"}`}>
            {x.label}
            {x.badge ? <span className="ml-1.5 rounded-full bg-white px-1.5 text-xs font-bold text-brand">{x.badge}</span> : null}
          </Link>);
      })}
    </nav>
  );
}
