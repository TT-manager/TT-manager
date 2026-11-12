import Link from "next/link";
import type { RankingRow } from "@/lib/data";

export function RankingTable({ rows, label, limit }: { rows: RankingRow[]; label: string; limit?: number }) {
  if (rows.length === 0) return <p className="mt-3 text-neutral-600 dark:text-neutral-400">Nessun giocatore in classifica.</p>;
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <table className="mt-3 w-full text-left">
      <thead className="text-sm text-neutral-500 dark:text-neutral-400">
        <tr><th className="py-2">#</th><th>Giocatore</th><th className="hidden sm:table-cell">Circolo</th>
          <th className="text-right">Partite</th><th className="text-right">{label}</th></tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <tr key={r.player_id} className="border-t">
            <td className="py-2 tabular-nums">{r.position}</td>
            <td><Link href={`/giocatore/${r.player_id}`} className="font-medium underline-offset-2 hover:underline">{r.full_name}</Link></td>
            <td className="hidden text-neutral-600 dark:text-neutral-400 sm:table-cell">{r.club}</td>
            <td className="text-right tabular-nums">{r.games_played}</td>
            <td className="text-right font-semibold tabular-nums">{r.rating}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
