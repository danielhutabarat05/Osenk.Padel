import type { Match, Player, Round, Team, Tournament, Standing } from "./types";

const pairKey = (a: string, b: string) => [a, b].sort().join("|");
const matchId = () => crypto.randomUUID();

function choosePlayers(
  players: Player[],
  capacity: number,
  restCounts: Map<string, number>,
  round: number,
  playedCounts: Map<string, number>,
) {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return shuffled
    .sort(
      (a, b) =>
        (playedCounts.get(a.id) ?? 0) - (playedCounts.get(b.id) ?? 0) ||
        (restCounts.get(a.id) ?? 0) - (restCounts.get(b.id) ?? 0) ||
        ((round + a.id.length) % 3) - ((round + b.id.length) % 3),
    )
    .slice(0, Math.min(capacity, players.length));
}

function createRound(
  players: Player[],
  courts: number,
  roundNumber: number,
  type: "classic" | "mixed",
  history: Set<string>,
  restCounts: Map<string, number>,
  playedCounts: Map<string, number>,
): Round {
  const active = choosePlayers(
    players,
    courts * 4,
    restCounts,
    roundNumber,
    playedCounts,
  );
  const activeSet = new Set(active.map((player) => player.id));
  players.forEach((player) => {
    if (!activeSet.has(player.id))
      restCounts.set(player.id, (restCounts.get(player.id) ?? 0) + 1);
  });

  const men = active.filter((player) => player.gender === "male");
  const women = active.filter((player) => player.gender === "female");
  const ordered: Player[] = [];
  if (type === "mixed" && men.length && women.length) {
    const mixedPairs = Math.min(men.length, women.length);
    for (let index = 0; index < mixedPairs; index += 1)
      ordered.push(men[index], women[(index + roundNumber - 1) % women.length]);
    ordered.push(...men.slice(mixedPairs), ...women.slice(mixedPairs));
  } else {
    ordered.push(...active);
  }

  const partnerSets = new Set<string>();
  const matches: Match[] = [];
  for (let court = 0; court < courts; court += 1) {
    const chunk = ordered.slice(court * 4, court * 4 + 4);
    if (chunk.length < 4) break;
    const candidates = [
      [chunk[0], chunk[1], chunk[2], chunk[3]],
      [chunk[0], chunk[2], chunk[1], chunk[3]],
      [chunk[0], chunk[3], chunk[1], chunk[2]],
    ];
    const selected =
      candidates.find((candidate) => {
        const key1 = pairKey(candidate[0].id, candidate[1].id);
        const key2 = pairKey(candidate[2].id, candidate[3].id);
        return !history.has(key1) && !history.has(key2);
      }) ?? candidates[(roundNumber + court) % candidates.length];
    const key1 = pairKey(selected[0].id, selected[1].id);
    const key2 = pairKey(selected[2].id, selected[3].id);
    history.add(key1);
    history.add(key2);
    partnerSets.add(key1);
    partnerSets.add(key2);
    matches.push({
      id: matchId(),
      courtNumber: court + 1,
      team1PlayerIds: [selected[0].id, selected[1].id],
      team2PlayerIds: [selected[2].id, selected[3].id],
      status: "scheduled",
    });
    selected.forEach((player) =>
      playedCounts.set(player.id, (playedCounts.get(player.id) ?? 0) + 1),
    );
  }
  return {
    id: matchId(),
    roundNumber,
    matches,
    restPlayerIds: players
      .filter((player) => !activeSet.has(player.id))
      .map((player) => player.id),
  };
}

export function generateIndividualRounds(
  players: Player[],
  courts: number,
  rounds: number,
  type: "classic" | "mixed",
): Round[] {
  const history = new Set<string>();
  const restCounts = new Map(players.map((player) => [player.id, 0]));
  const playedCounts = new Map(players.map((player) => [player.id, 0]));
  return Array.from({ length: rounds }, (_, index) =>
    createRound(
      players,
      courts,
      index + 1,
      type,
      history,
      restCounts,
      playedCounts,
    ),
  );
}

export function generateAdditionalIndividualRound(
  players: Player[],
  courts: number,
  type: "classic" | "mixed",
  previousRounds: Round[],
): Round {
  const history = new Set<string>();
  const restCounts = new Map(players.map((player) => [player.id, 0]));
  const playedCounts = new Map(players.map((player) => [player.id, 0]));
  previousRounds.forEach((round) => {
    round.restPlayerIds.forEach((playerId) =>
      restCounts.set(playerId, (restCounts.get(playerId) ?? 0) + 1),
    );
    round.matches.forEach((match) => {
      match.team1PlayerIds.forEach((playerId) =>
        playedCounts.set(playerId, (playedCounts.get(playerId) ?? 0) + 1),
      );
      match.team2PlayerIds.forEach((playerId) =>
        playedCounts.set(playerId, (playedCounts.get(playerId) ?? 0) + 1),
      );
      [...match.team1PlayerIds, ...match.team2PlayerIds].forEach(
        (playerId, index, ids) =>
          ids
            .slice(index + 1)
            .forEach((otherId) => history.add(pairKey(playerId, otherId))),
      );
    });
  });
  return createRound(
    players,
    courts,
    previousRounds.length + 1,
    type,
    history,
    restCounts,
    playedCounts,
  );
}

export function generateTeamRounds(
  teams: Team[],
  courts: number,
  rounds: number,
): Round[] {
  const history = new Set<string>();
  const teamMatches = new Map(teams.map((team) => [team.id, 0]));
  return Array.from({ length: rounds }, (_, roundIndex) => {
    const ordered = [...teams]
      .sort(() => Math.random() - 0.5)
      .sort(
        (a, b) => (teamMatches.get(a.id) ?? 0) - (teamMatches.get(b.id) ?? 0),
      );
    const matches: Match[] = [];
    const active = ordered.slice(0, Math.min(teams.length, courts * 2));
    for (let index = 0; index + 1 < active.length; index += 2) {
      const first = active[index];
      const second = active[index + 1];
      const key = pairKey(first.id, second.id);
      if (history.has(key) && active.length > 2) {
        const alternate = active.find(
          (candidate) =>
            candidate.id !== first.id &&
            candidate.id !== second.id &&
            !history.has(pairKey(first.id, candidate.id)),
        );
        if (alternate) {
          const alternateIndex = active.indexOf(alternate);
          active[alternateIndex] = second;
          active[index + 1] = alternate;
        }
      }
      const opponent = active[index + 1];
      history.add(pairKey(first.id, opponent.id));
      teamMatches.set(first.id, (teamMatches.get(first.id) ?? 0) + 1);
      teamMatches.set(opponent.id, (teamMatches.get(opponent.id) ?? 0) + 1);
      matches.push({
        id: matchId(),
        courtNumber: matches.length + 1,
        team1PlayerIds: first.playerIds,
        team2PlayerIds: opponent.playerIds,
        status: "scheduled",
      });
    }
    const activeIds = new Set(active.flatMap((team) => team.playerIds));
    return {
      id: matchId(),
      roundNumber: roundIndex + 1,
      matches,
      restPlayerIds: teams
        .flatMap((team) => team.playerIds)
        .filter((id) => !activeIds.has(id)),
    };
  });
}

export function generateAdditionalTeamRound(
  teams: Team[],
  courts: number,
  previousRounds: Round[],
): Round {
  const playedCounts = new Map(teams.map((team) => [team.id, 0]));
  const history = new Set<string>();
  previousRounds.forEach((round) =>
    round.matches.forEach((match) => {
      const first = teams.find(
        (team) => team.playerIds.join("|") === match.team1PlayerIds.join("|"),
      );
      const second = teams.find(
        (team) => team.playerIds.join("|") === match.team2PlayerIds.join("|"),
      );
      if (first && second) {
        playedCounts.set(first.id, (playedCounts.get(first.id) ?? 0) + 1);
        playedCounts.set(second.id, (playedCounts.get(second.id) ?? 0) + 1);
        history.add(pairKey(first.id, second.id));
      }
    }),
  );
  const ordered = [...teams]
    .sort(() => Math.random() - 0.5)
    .sort(
      (a, b) => (playedCounts.get(a.id) ?? 0) - (playedCounts.get(b.id) ?? 0),
    );
  const active = ordered.slice(0, Math.min(teams.length, courts * 2));
  const matches: Match[] = [];
  for (let index = 0; index + 1 < active.length; index += 2) {
    let first = active[index];
    let second = active[index + 1];
    if (history.has(pairKey(first.id, second.id))) {
      const alternate = active
        .slice(index + 2)
        .find((candidate) => !history.has(pairKey(first.id, candidate.id)));
      if (alternate) {
        const alternateIndex = active.indexOf(alternate);
        active[alternateIndex] = second;
        second = alternate;
      }
    }
    matches.push({
      id: matchId(),
      courtNumber: matches.length + 1,
      team1PlayerIds: first.playerIds,
      team2PlayerIds: second.playerIds,
      status: "scheduled",
    });
  }
  const activeIds = new Set(active.flatMap((team) => team.playerIds));
  return {
    id: matchId(),
    roundNumber: previousRounds.length + 1,
    matches,
    restPlayerIds: teams
      .flatMap((team) => team.playerIds)
      .filter((id) => !activeIds.has(id)),
  };
}

export function calculateStandings(tournament: Tournament): Standing[] {
  const rows = new Map<string, Standing>();
  const add = (id: string, name: string, memberNames?: string[]) => {
    if (!rows.has(id))
      rows.set(id, {
        id,
        name,
        memberNames,
        points: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    return rows.get(id)!;
  };
  const teamLookup = new Map(
    (tournament.teams ?? []).map((team) => [team.playerIds.join("|"), team]),
  );
  tournament.rounds.forEach((round) =>
    round.matches.forEach((match) => {
      if (
        match.status !== "completed" ||
        match.score1 === undefined ||
        match.score2 === undefined
      )
        return;
      const isTeam = tournament.type === "team";
      const key1 = isTeam
        ? match.team1PlayerIds.join("|")
        : match.team1PlayerIds[0];
      const key2 = isTeam
        ? match.team2PlayerIds.join("|")
        : match.team2PlayerIds[0];
      const names1 = match.team1PlayerIds
        .map(
          (id) =>
            tournament.players.find((player) => player.id === id)?.name ?? "",
        )
        .filter(Boolean);
      const names2 = match.team2PlayerIds
        .map(
          (id) =>
            tournament.players.find((player) => player.id === id)?.name ?? "",
        )
        .filter(Boolean);
      const row1 = add(
        key1,
        isTeam ? (teamLookup.get(key1)?.name ?? "Team") : names1[0],
        isTeam ? names1 : undefined,
      );
      const row2 = add(
        key2,
        isTeam ? (teamLookup.get(key2)?.name ?? "Team") : names2[0],
        isTeam ? names2 : undefined,
      );
      const targets1 = isTeam
        ? [row1]
        : match.team1PlayerIds.map((id) =>
            add(
              id,
              tournament.players.find((player) => player.id === id)?.name ??
                "Player",
            ),
          );
      const targets2 = isTeam
        ? [row2]
        : match.team2PlayerIds.map((id) =>
            add(
              id,
              tournament.players.find((player) => player.id === id)?.name ??
                "Player",
            ),
          );
      targets1.forEach((row) => {
        row.points += match.score1!;
        row.pointsFor += match.score1!;
        row.pointsAgainst += match.score2!;
        row.matches += 1;
        if (match.score1! > match.score2!) row.wins += 1;
        else if (match.score1! < match.score2!) row.losses += 1;
      });
      targets2.forEach((row) => {
        row.points += match.score2!;
        row.pointsFor += match.score2!;
        row.pointsAgainst += match.score1!;
        row.matches += 1;
        if (match.score2! > match.score1!) row.wins += 1;
        else if (match.score2! < match.score1!) row.losses += 1;
      });
    }),
  );
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst),
  );
}

export function tournamentProgress(tournament: Tournament) {
  const matches = tournament.rounds.flatMap((round) => round.matches);
  return {
    completed: matches.filter((match) => match.status === "completed").length,
    total: matches.length,
  };
}
