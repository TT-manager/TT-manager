/** Gironi all'italiana: composizione, calendario e classifica. */

export interface MatchResult {
  playerA: string;
  playerB: string;
  /** Set vinti da A e da B. */
  setsA: number;
  setsB: number;
  /** Punti totali segnati da A e da B (per spareggio). */
  pointsA?: number;
  pointsB?: number;
}

export interface Standing {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
  /** 2 punti per vittoria, 1 per sconfitta giocata (regola classica TT). */
  tablePoints: number;
  rank: number;
}

/**
 * Distribuisce i giocatori (già ordinati per testa di serie, il migliore per primo)
 * in `groupCount` gironi con il metodo "a serpentina".
 */
export function snakeGroups<T>(seededPlayers: T[], groupCount: number): T[][] {
  if (groupCount < 1) throw new Error("groupCount deve essere >= 1");
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  seededPlayers.forEach((p, i) => {
    const row = Math.floor(i / groupCount);
    const col = i % groupCount;
    groups[row % 2 === 0 ? col : groupCount - 1 - col].push(p);
  });
  return groups;
}

/** Calendario all'italiana col "metodo del cerchio". Restituisce i turni. */
export function roundRobinSchedule(players: string[]): [string, string][][] {
  const list: (string | null)[] = [...players];
  if (list.length % 2 === 1) list.push(null); // riposo
  const n = list.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a !== null && b !== null) round.push([a, b]);
    }
    rounds.push(round);
    // rotazione: il primo resta fermo
    list.splice(1, 0, list.pop() as string | null);
  }
  return rounds;
}

/**
 * Classifica del girone. Spareggi, in ordine: punti classifica,
 * scontro diretto (se due soli a pari), differenza set, differenza punti.
 */
export function computeStandings(playerIds: string[], results: MatchResult[]): Standing[] {
  const table = new Map<string, Standing>(
    playerIds.map((id) => [
      id,
      {
        playerId: id,
        played: 0,
        wins: 0,
        losses: 0,
        setsFor: 0,
        setsAgainst: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        tablePoints: 0,
        rank: 0,
      },
    ]),
  );

  for (const m of results) {
    const a = table.get(m.playerA);
    const b = table.get(m.playerB);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.setsFor += m.setsA;
    a.setsAgainst += m.setsB;
    b.setsFor += m.setsB;
    b.setsAgainst += m.setsA;
    a.pointsFor += m.pointsA ?? 0;
    a.pointsAgainst += m.pointsB ?? 0;
    b.pointsFor += m.pointsB ?? 0;
    b.pointsAgainst += m.pointsA ?? 0;
    const [w, l] = m.setsA > m.setsB ? [a, b] : [b, a];
    w.wins++;
    w.tablePoints += 2;
    l.losses++;
    l.tablePoints += 1;
  }

  const headToHead = (x: string, y: string): number => {
    const m = results.find(
      (r) => (r.playerA === x && r.playerB === y) || (r.playerA === y && r.playerB === x),
    );
    if (!m) return 0;
    const xIsA = m.playerA === x;
    const diff = xIsA ? m.setsA - m.setsB : m.setsB - m.setsA;
    return diff > 0 ? 1 : diff < 0 ? -1 : 0;
  };

  const rows = [...table.values()];
  rows.sort((x, y) => {
    if (y.tablePoints !== x.tablePoints) return y.tablePoints - x.tablePoints;
    const tied = rows.filter((r) => r.tablePoints === x.tablePoints).length;
    if (tied === 2) {
      const h = headToHead(y.playerId, x.playerId);
      if (h !== 0) return h;
    }
    const setDiff = y.setsFor - y.setsAgainst - (x.setsFor - x.setsAgainst);
    if (setDiff !== 0) return setDiff;
    return y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst);
  });
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}
