import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { tr } from "@/i18n/server";
import { notificationsText } from "@/i18n/dict/notifications";
import { unsubscribeAction } from "../actions";

export async function generateMetadata() {
  return { title: (await tr(notificationsText)).unsubTitle };
}

/**
 * Pagina del link «non ricevere più» delle email. Serve un tocco sul pulsante: alcuni programmi di posta
 * aprono i link da soli per controllarli, e non devono disiscrivere nessuno.
 */
export default function UnsubscribePage({ searchParams }: PageProps<"/notifiche/disiscriviti">) {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <Suspense fallback={null}><Unsubscribe searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function Unsubscribe({ searchParams }: { searchParams: PageProps<"/notifiche/disiscriviti">["searchParams"] }) {
  const [sp, t] = [await searchParams, await tr(notificationsText)];
  const token = typeof sp.t === "string" ? sp.t : "";
  return (
    <>
      <h1 className="text-2xl font-bold">{t.unsubTitle}</h1>
      <p className="mt-3 text-muted">{t.unsubText}</p>
      <ActionForm action={unsubscribeAction} submitLabel={t.unsubButton} className="mt-6">
        <input type="hidden" name="t" value={token} />
      </ActionForm>
    </>
  );
}
