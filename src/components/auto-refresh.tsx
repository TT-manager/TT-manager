"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale, useTr } from "@/i18n/client";
import { compCommon } from "@/i18n/dict/comp-common";
import { intlTag } from "@/i18n/locale";

/** Ricarica i dati della pagina a intervalli, solo mentre la scheda è visibile. */
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const t = useTr(compCommon);
  const l = useLocale();
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLast(new Date().toLocaleTimeString(intlTag(l), { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [router, seconds, l]);
  return (
    <p className="text-xs text-neutral-500 dark:text-neutral-400">
      {t.autoRefresh(seconds, last)}
    </p>
  );
}
