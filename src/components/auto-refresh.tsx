"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Ricarica i dati della pagina a intervalli, solo mentre la scheda è visibile. */
export default function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  const [last, setLast] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLast(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    const id = setInterval(tick, seconds * 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [router, seconds]);
  return (
    <p className="text-xs text-neutral-500 dark:text-neutral-400">
      Aggiornamento automatico ogni {seconds} s{last ? ` · ultimo alle ${last}` : ""}
    </p>
  );
}
