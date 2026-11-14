import Link from "next/link";
import type { RankingRow } from "@/lib/data";
import { Avatar } from "./avatar";
import { tr } from "@/i18n/server";
import { compCommon } from "@/i18n/dict/comp-common";

const MEDAL = ["bg-gold", "bg-silver", "bg-bronze"];

export async function RankingTable({ rows, label, limit, highlight }: { rows: RankingRow[]; label: string; limit?: number; highlight?: string }) {
  const t = await tr(compCommon);
  if (rows.length === 0) return <p className="mt-3 text-muted">{t.noPlayers}</p>;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="card mt-3 overflow-x-auto !p-0">
      <table className="w-full text-left">
        <thead className="bg-ink text-xs uppercase tracking-wide text-white">
          <tr><th className="py-2.5 pl-4">#</th><th>{t.player}</th><th className="hidden sm:table-cell">{t.club}</th>
            <th className="text-right">{t.matches}</th><th className="pr-4 text-right">{label}</th></tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.player_id} className={`border-t border-line ${r.player_id === highlight ? "bg-gold/15" : ""}`}>
              <td className="py-2.5 pl-4">
                {r.position <= 3 && r.games_played > 0
                  ? <span className={`flex h-7 w-7 items-center justify-center rounded-full font-display font-bold text-white ${MEDAL[r.position - 1]}`}>{r.position}</span>
                  : <span className="inline-block w-7 text-center font-display text-lg font-semibold tabular-nums text-muted">{r.position}</span>}
              </td>
              <td>
                <Link href={`/giocatore/${r.player_id}`} className="flex items-center gap-2 font-medium hover:text-brand">
                  <Avatar name={r.full_name} path={r.avatar_path} size="h-8 w-8 text-[0.7rem]" />{r.full_name}</Link>
              </td>
              <td className="hidden text-muted sm:table-cell">{r.club}</td>
              <td className="text-right tabular-nums text-muted">{r.games_played}</td>
              <td className="pr-4 text-right font-display text-xl font-bold tabular-nums">{r.rating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
