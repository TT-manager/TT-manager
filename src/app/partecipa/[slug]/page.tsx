import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { sameNameMatch } from "@/lib/names";
import { ActionForm } from "@/components/action-form";
import { getAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { requestJoin } from "../../profilo/actions";
import { getLocale, tr } from "@/i18n/server";
import { accountJoinText } from "@/i18n/dict/account-profile";

export async function generateMetadata() {
  return { title: (await tr(accountJoinText)).title };
}
const muted = "text-sm text-neutral-600 dark:text-neutral-400";

export default async function JoinPage({ params, searchParams }: PageProps<"/partecipa/[slug]">) {
  const t = await tr(accountJoinText);
  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <Suspense fallback={<p className={muted}>{t.loading}</p>}><Join params={params} searchParams={searchParams} /></Suspense>
    </main>
  );
}

async function Join({ params, searchParams }: Pick<PageProps<"/partecipa/[slug]">, "params" | "searchParams">) {
  const [{ slug }, sp, t, l] = await Promise.all([params, searchParams, tr(accountJoinText), getLocale()]);
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const token = typeof sp.invito === "string" ? sp.invito.slice(0, 64) : "";
  const svc = createServiceClient();
  const { data: c } = await svc.from("championships").select("id, name, kind").eq("slug", slug).maybeSingle();
  if (!c) notFound();
  const { data: inv } = await svc.from("championship_invites").select("token").eq("championship_id", c.id).maybeSingle();
  const validInvite = Boolean(token && inv?.token === token);
  const here = `/partecipa/${slug}${token ? `?invito=${encodeURIComponent(token)}` : ""}`;
  const account = await getAccount();

  const header = (
    <>
      <Link href={`/c/${slug}`} className={`${muted} hover:underline`}>← {c.name}</Link>
      <h1 className="mt-2 text-2xl font-bold">{t.heading(c.name)}</h1>
      {token && !validInvite && <p className="mt-2 text-amber-700 dark:text-amber-400">{t.inviteInvalid}</p>}
      {validInvite && <p className="mt-2">{t.invited}</p>}
    </>
  );
  if (!account) {
    return <>{header}
      <p className="mt-6">{t.needAccount}</p>
      <div className="mt-3 flex gap-3">
        <Link href={`/registrati?next=${encodeURIComponent(here)}`} className="btn-primary">{t.signup}</Link>
        <Link href={`/login?next=${encodeURIComponent(here)}`} className="rounded border px-4 py-2">{t.haveAccount}</Link>
      </div></>;
  }
  const [{ data: member }, { data: pending }, { data: unclaimed }] = await Promise.all([
    svc.from("championship_players").select("player_id").eq("championship_id", c.id).eq("player_id", account.player.id).maybeSingle(),
    svc.from("championship_requests").select("id").eq("championship_id", c.id).eq("user_id", account.userId).eq("status", "pending").maybeSingle(),
    svc.from("championship_players").select("player_id, players!inner(full_name, user_id)").eq("championship_id", c.id).is("players.user_id", null),
  ]);
  if (member) return <>{header}<p className="mt-6">{t.alreadyMember} <Link href={`/c/${slug}`} className="underline">{t.goToRanking}</Link></p></>;
  if (pending) return <>{header}<p className="mt-6">{t.pending} <Link href="/profilo" className="underline">{t.myProfile}</Link></p></>;
  const names = (unclaimed ?? []).map((u) => ({ id: u.player_id as string, name: (u.players as unknown as { full_name: string }).full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, l));
  // Stesso nome di un giocatore già in classifica senza account: chiediamo esplicitamente se è lui.
  const match = sameNameMatch(account.player.full_name, names);
  const others = names.filter((n) => n.id !== match?.id);
  return <>{header}
    <ActionForm action={requestJoin} submitLabel={validInvite ? t.enterLeague : t.sendRequest} className="mt-6 space-y-3">
      <input type="hidden" name="slug" value={slug} />
      {validInvite && <input type="hidden" name="invito" value={token} />}
      <p>{t.joiningAs}<strong>{account.player.full_name}</strong>{t.joiningAsAfter}</p>
      {match ? (
        <fieldset className="rounded-lg border-2 border-gold p-4">
          <input type="hidden" name="seen_match" value={match.id} />
          <legend className="px-1 font-semibold">{t.isItYou(match.name)}</legend>
          <label className="mt-1 flex items-start gap-2"><input type="radio" name="claim_player_id" value={match.id} required className="mt-1" />
            <span>{t.yesItsMe}<span className={`block ${muted}`}>{t.yesHelp}</span></span></label>
          <label className="mt-2 flex items-start gap-2"><input type="radio" name="claim_player_id" value="" required className="mt-1" />
            <span>{t.noOther}{validInvite ? <span className={`block ${muted}`}>{t.noOtherInvite}</span> : null}</span></label>
          {others.length > 0 && <p className={`mt-2 ${muted}`}>{t.otherPlayerHint}</p>}
        </fieldset>
      ) : names.length > 0 && (
        <label className="grid gap-1">{t.alreadyInRanking}
          <select name="claim_player_id" defaultValue="" className="select-arrow rounded border bg-transparent py-2 pl-3">
            <option value="">{t.noNew}</option>
            {names.map((n) => <option key={n.id} value={n.id}>{t.yesIAm(n.name)}</option>)}
          </select>
          <span className={muted}>{t.pickHint}</span>
        </label>)}
    </ActionForm>
  </>;
}
