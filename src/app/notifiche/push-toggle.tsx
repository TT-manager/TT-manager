"use client";
import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "./actions";
import { useTr } from "@/i18n/client";
import { notificationsText } from "@/i18n/dict/notifications";

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

/** La chiave pubblica arriva come testo «base64url»; il browser la vuole come byte. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function currentStatus(): Promise<Status> {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !installed ? "ios-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** Attiva o disattiva le notifiche push su questo dispositivo (telefono con l'app installata, o computer). */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const t = useTr(notificationsText);
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { currentStatus().then(setStatus, () => setStatus("unsupported")); }, []);

  async function enable() {
    setBusy(true); setError(false);
    try {
      if ((await Notification.requestPermission()) !== "granted") { setStatus(await currentStatus()); return; }
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
      if (!(await savePushSubscription(sub.toJSON()))) throw new Error("save");
      setStatus("on");
    } catch {
      setError(true);
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(false);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setStatus("off");
    } catch { setError(true); } finally { setBusy(false); }
  }

  if (status === "loading") return null;
  return (
    <div className="mt-3 space-y-2">
      {status === "unsupported" && <p className="text-sm text-muted">{t.pushUnsupported}</p>}
      {status === "ios-install" && <p className="text-sm">{t.pushIosInstall}</p>}
      {status === "denied" && <p className="text-sm text-amber-700 dark:text-amber-400">{t.pushDenied}</p>}
      {status === "off" && <button onClick={enable} disabled={busy} className="btn-primary">{busy ? "…" : t.pushEnable}</button>}
      {status === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-green-700 dark:text-green-400">✓ {t.pushActive}</span>
          <button onClick={disable} disabled={busy} className="btn-outline px-3 py-1.5 text-sm">{busy ? "…" : t.pushDisable}</button>
        </div>)}
      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{t.pushError}</p>}
    </div>
  );
}
