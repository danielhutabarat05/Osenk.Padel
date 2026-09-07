import { useMemo, useState } from "react";
import "./App.css";
import "./osenk.css";
import {
  calculateStandings,
  generateAdditionalIndividualRound,
  generateAdditionalTeamRound,
  generateIndividualRounds,
  generateTeamRounds,
  tournamentProgress,
} from "./services";
import { loadTournaments, saveTournaments } from "./storage";
import type {
  Gender,
  Match,
  Player,
  PointsPerMatch,
  Team,
  Tournament,
  TournamentType,
} from "./types";

const POINTS: PointsPerMatch[] = [16, 21, 24, 32];
const createId = () => crypto.randomUUID();
const emptyDraft = () => ({
  name: "",
  venue: "",
  date: "",
  courts: 2,
  type: "classic" as TournamentType,
  points: 24 as PointsPerMatch,
  rounds: 6,
});

export default function App() {
  const [tournaments, setTournaments] = useState<Tournament[]>(loadTournaments);
  const [page, setPage] = useState<
    "home" | "create" | "history" | "tournament"
  >("home");
  const [activeId, setActiveId] = useState<string>();
  const [draft, setDraft] = useState(emptyDraft);
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTab, setActiveTab] = useState<
    "overview" | "schedule" | "leaderboard" | "settings"
  >("overview");
  const [deleteRequest, setDeleteRequest] = useState<
    { type: "one"; id: string; name: string } | { type: "all" } | null
  >(null);
  const active = tournaments.find((item) => item.id === activeId);
  const commit = (next: Tournament[]) => {
    setTournaments(next);
    saveTournaments(next);
  };
  const open = (item: Tournament) => {
    setActiveId(item.id);
    setActiveTab("overview");
    setPage("tournament");
  };
  const start = () => {
    setDraft(emptyDraft());
    setPlayers([]);
    setTeams([]);
    setPage("create");
  };
  const create = () => {
    if (!draft.name || !draft.venue || !draft.date || draft.courts < 1) return;
    if (draft.type !== "team" && players.length < 4) return;
    if (
      draft.type === "team" &&
      (teams.length < 2 || teams.some((team) => team.playerIds.length !== 2))
    )
      return;
    const now = new Date().toISOString();
    const slotsPerRound =
      draft.type === "team" ? draft.courts * 2 : draft.courts * 4;
    const rosterSize = draft.type === "team" ? teams.length : players.length;
    const customCycleRounds = Math.max(
      1,
      Math.ceil(rosterSize / slotsPerRound),
    );
    const targetRounds = draft.rounds === 0 ? customCycleRounds : draft.rounds;
    const rounds =
      draft.type === "team"
        ? generateTeamRounds(teams, draft.courts, targetRounds)
        : generateIndividualRounds(
            players,
            draft.courts,
            targetRounds,
            draft.type,
          );
    const item: Tournament = {
      id: createId(),
      name: draft.name,
      venue: draft.venue,
      date: draft.date,
      type: draft.type,
      courts: draft.courts,
      pointsPerMatch: draft.points,
      numberOfRounds: targetRounds,
      players,
      teams: draft.type === "team" ? teams : undefined,
      rounds,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    commit([item, ...tournaments]);
    setActiveId(item.id);
    setActiveTab("schedule");
    setPage("tournament");
  };
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
      new Date(`${value}T12:00:00`),
    );
  const standings = useMemo(
    () => (active ? calculateStandings(active) : []),
    [active],
  );
  const addRound = () => {
    if (!active) return;
    const nextNumber = active.rounds.length + 1;
    const extra =
      active.type === "team"
        ? generateAdditionalTeamRound(
            active.teams ?? [],
            active.courts,
            active.rounds,
          )
        : generateAdditionalIndividualRound(
            active.players,
            active.courts,
            active.type,
            active.rounds,
          );
    commit(
      tournaments.map((item) =>
        item.id === active.id
          ? {
              ...item,
              numberOfRounds: nextNumber,
              rounds: [...item.rounds, { ...extra, roundNumber: nextNumber }],
              status: "active",
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setPage("home")}>
          <img src="/Osenk%20Padel.jpeg" alt="Osenk Padel Club" />
          <span>
            OSENK <i>PADEL</i>
          </span>
        </button>
        <nav>
          <button onClick={() => setPage("home")}>Home</button>
          <button onClick={() => setPage("history")}>History</button>
        </nav>
        <button className="icon-button" onClick={start}>
          +
        </button>
      </header>
      <main>
        {page === "home" && (
          <Home
            items={tournaments}
            open={open}
            start={start}
            date={formatDate}
          />
        )}
        {page === "history" && (
          <History
            items={tournaments}
            open={open}
            date={formatDate}
            requestDelete={(id, name) => setDeleteRequest({ type: "one", id, name })}
            requestClear={() => setDeleteRequest({ type: "all" })}
          />
        )}
        {page === "create" && (
          <Create
            draft={draft}
            setDraft={setDraft}
            players={players}
            setPlayers={setPlayers}
            teams={teams}
            setTeams={setTeams}
            create={create}
          />
        )}
        {page === "tournament" && active && (
          <Tournament
            item={active}
            tab={activeTab}
            setTab={setActiveTab}
            standings={standings}
            update={(next) =>
              commit(
                tournaments.map((item) => (item.id === next.id ? next : item)),
              )
            }
            back={() => setPage("home")}
            date={formatDate}
          />
        )}
      </main>
      {page === "tournament" && active && (
        <div className="player-roster">
          <div className="eyebrow">
            PLAYER ROSTER · {active.players.length} PLAYERS
          </div>
          <h3>Players in this tournament</h3>
          <div className="player-roster-list">
            {active.players.map((player) => (
              <span className="player-chip" key={player.id}>
                {player.name}
              </span>
            ))}
          </div>
        </div>
      )}
      {page === "tournament" && active && activeTab === "schedule" && (
        <div className="schedule-footer">
          <button className="primary" onClick={addRound}>
            + Add round
          </button>
        </div>
      )}
      {deleteRequest && (
        <div className="confirm-overlay" role="presentation" onClick={() => setDeleteRequest(null)}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(event) => event.stopPropagation()}>
            <div className="confirm-icon">!</div>
            <div className="eyebrow">PLEASE CONFIRM</div>
            <h2 id="confirm-title">{deleteRequest.type === "all" ? "Delete all history?" : `Delete ${deleteRequest.name}?`}</h2>
            <p>{deleteRequest.type === "all" ? "All saved tournaments and scores will be permanently removed." : "This tournament and all of its match scores will be permanently removed."}</p>
            <div className="confirm-actions">
              <button className="secondary" onClick={() => setDeleteRequest(null)}>Cancel</button>
              <button className="danger" onClick={() => { if (deleteRequest.type === "all") commit([]); else commit(tournaments.filter((item) => item.id !== deleteRequest.id)); setDeleteRequest(null) }}>Delete</button>
            </div>
          </div>
        </div>
      )}
      <footer>
        <span>
          OSENK <i>PADEL</i>
        </span>
        <span>© 2026 Daniel Hutabarat. All Rights Reserved.</span>
      </footer>
    </div>
  );
}

function Home({
  items,
  open,
  start,
  date,
}: {
  items: Tournament[];
  open: (item: Tournament) => void;
  start: () => void;
  date: (value: string) => string;
}) {
  return (
    <section className="home">
      <div className="hero-copy">
        <div className="eyebrow">OSENK PADEL CLUB · TOURNAMENT CONTROL</div>
        <h1>
          Make every point
          <br />
          <em>count.</em>
        </h1>
        <p>Build fair, fast Americano tournaments for your crew.</p>
        <button className="primary" onClick={start}>
          Create new tournament <span>↗</span>
        </button>
        <div className="hero-stats">
          <span>
            <b>01</b> Add your crew
          </span>
          <span>
            <b>02</b> Generate matches
          </span>
          <span>
            <b>03</b> Play &amp; score
          </span>
        </div>
      </div>
      <div className="hero-art">
        <img src="/Osenk%20Padel.jpeg" alt="Osenk Padel Club badge" />
      </div>
      <div className="section-heading">
        <div>
          <div className="eyebrow">YOUR ACTIVITY</div>
          <h2>Recent tournaments</h2>
        </div>
      </div>
      <div className="recent">
        {items.length ? (
          items.slice(0, 3).map((item) => (
            <button
              className="tournament-card"
              key={item.id}
              onClick={() => open(item)}
            >
              <div className="card-top">
                <span className={`status-dot ${item.status}`} />
                {item.status === "completed" ? "Completed" : "In progress"}
                <span className="card-arrow">↗</span>
              </div>
              <h3>{item.name}</h3>
              <p>⌖ {item.venue}</p>
              <div className="card-meta">
                <span>◷ {date(item.date)}</span>
                <span>♧ {item.players.length} players</span>
                <span>▣ {item.courts} courts</span>
              </div>
            </button>
          ))
        ) : (
          <div className="empty">
            <b>No tournaments yet</b>
            <p>Create your first tournament to see it here.</p>
            <button className="secondary" onClick={start}>
              Create tournament
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function History({
  items,
  open,
  date,
  requestDelete,
  requestClear,
}: {
  items: Tournament[];
  open: (item: Tournament) => void;
  date: (value: string) => string;
  requestDelete: (id: string, name: string) => void;
  requestClear: () => void;
}) {
  return (
    <section className="page-section">
      <div className="history-title">
        <div>
          <div className="eyebrow">THE ARCHIVE</div>
          <h1>Tournament history.</h1>
          <p className="lead">Every match, every score, ready when you are.</p>
        </div>
        {items.length > 0 && (
          <button
            className="danger"
            onClick={requestClear}
          >
            Delete all history
          </button>
        )}
      </div>
      <div className="history-list">
        {items.length ? (
          items.map((item) => (
            <div className="history-row" key={item.id}>
              <div>
                <span className={`status-dot ${item.status}`} />{" "}
                <b>{item.name}</b>
                <small>
                  {item.venue} · {date(item.date)}
                </small>
              </div>
              <span>{item.players.length} players</span>
              <button className="secondary" onClick={() => open(item)}>
                {item.status === "completed" ? "View" : "Continue"}
              </button>
              <button
                className="delete"
                onClick={() => requestDelete(item.id, item.name)}
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div className="empty">
            <b>No tournaments yet.</b>
            <p>Your saved tournaments will appear here.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Create({
  draft,
  setDraft,
  players,
  setPlayers,
  teams,
  setTeams,
  create,
}: {
  draft: ReturnType<typeof emptyDraft>;
  setDraft: (value: ReturnType<typeof emptyDraft>) => void;
  players: Player[];
  setPlayers: (value: Player[]) => void;
  teams: Team[];
  setTeams: (value: Team[]) => void;
  create: () => void;
}) {
  const [step, setStep] = useState(1);
  const [playerName, setPlayerName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const addPlayer = () => {
    const name = playerName.trim();
    if (
      name &&
      !players.some((item) => item.name.toLowerCase() === name.toLowerCase())
    ) {
      setPlayers([
        ...players,
        {
          id: createId(),
          name,
          gender: draft.type === "mixed" ? gender : undefined,
        },
      ]);
      setPlayerName("");
    }
  };
  return (
    <section className="wizard">
      <div className="eyebrow">NEW TOURNAMENT / 0{step} OF 03</div>
      <h1>
        {step === 1
          ? "Set the arena."
          : step === 2
            ? "Choose your format."
            : "Build your roster."}
      </h1>
      <p className="lead">A few details, then we will build a fair schedule.</p>
      <div className="stepper">
        <span className={step >= 1 ? "current" : ""}>01 Details</span>
        <span className={step >= 2 ? "current" : ""}>02 Format</span>
        <span className={step >= 3 ? "current" : ""}>03 Roster</span>
      </div>
      {step === 1 && (
        <div className="form-grid">
          <label>
            Venue
            <input
              value={draft.venue}
              onChange={(e) => setDraft({ ...draft, venue: e.target.value })}
              placeholder="Osenk Padel Club"
            />
          </label>
          <label>
            Tournament name
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Saturday Night Americano"
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </label>
          <label>
            Courts
            <input
              type="number"
              min="1"
              value={draft.courts}
              onChange={(e) =>
                setDraft({ ...draft, courts: Number(e.target.value) })
              }
            />
          </label>
          <button
            className="primary full"
            onClick={() =>
              draft.name && draft.venue && draft.date && setStep(2)
            }
          >
            Continue <span>→</span>
          </button>
        </div>
      )}
      {step === 2 && (
        <>
          <div className="format-grid">
            {(
              [
                [
                  "classic",
                  "Classic Americano",
                  "Partners rotate. Individual scoring.",
                ],
                ["mixed", "Mixed Americano", "Mixed pairs whenever possible."],
                ["team", "Team Americano", "Fixed two-person teams."],
              ] as [TournamentType, string, string][]
            ).map(([type, title, text]) => (
              <button
                className={`format-card ${draft.type === type ? "selected" : ""}`}
                key={type}
                onClick={() => setDraft({ ...draft, type })}
              >
                <span className="format-icon">
                  {type === "classic" ? "↻" : type === "mixed" ? "◐" : "♢"}
                </span>
                <strong>{title}</strong>
                <small>{text}</small>
              </button>
            ))}
          </div>
          <div className="settings-row">
            <div>
              <span className="label">Points per match</span>
              <div className="segmented">
                {POINTS.map((points) => (
                  <button
                    className={draft.points === points ? "selected" : ""}
                    key={points}
                    onClick={() => setDraft({ ...draft, points })}
                  >
                    {points}
                  </button>
                ))}
              </div>
            </div>
            <label className="round-select">
              Rounds
              <select
                value={draft.rounds === 0 ? "custom" : draft.rounds}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    rounds:
                      e.target.value === "custom" ? 0 : Number(e.target.value),
                  })
                }
              >
                {[3, 4, 5, 6, 7, 8, 10].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
              {draft.rounds === 0 && (
                <small className="custom-round-help">
                  The first full player cycle is generated after the roster is
                  complete.
                </small>
              )}
            </label>
          </div>
          <button className="primary" onClick={() => setStep(3)}>
            Continue <span>→</span>
          </button>
        </>
      )}
      {step === 3 && (
        <>
          <div className="roster-panel">
            {draft.type !== "team" ? (
              <>
                <div className="roster-head">
                  <span>
                    Players <b>{players.length}</b>
                  </span>
                  <span>
                    {draft.type === "mixed"
                      ? `${players.filter((item) => item.gender === "male").length} M / ${players.filter((item) => item.gender === "female").length} F`
                      : "Individual scoring"}
                  </span>
                </div>
                <div className="add-row">
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    placeholder="Player name"
                  />
                  {draft.type === "mixed" && (
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as Gender)}
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  )}
                  <button className="secondary" onClick={addPlayer}>
                    Add player
                  </button>
                </div>
                {players.map((player) => (
                  <div className="roster-item" key={player.id}>
                    <span className="avatar">
                      {player.name[0].toUpperCase()}
                    </span>
                    {player.name}
                    <button
                      onClick={() =>
                        setPlayers(
                          players.filter((item) => item.id !== player.id),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="roster-head">
                  <span>
                    Teams <b>{teams.length}</b>
                  </span>
                  <span>2 players per team</span>
                </div>
                <button
                  className="secondary"
                  onClick={() =>
                    setTeams([
                      ...teams,
                      {
                        id: createId(),
                        name: `Team ${teams.length + 1}`,
                        playerIds: [createId(), createId()],
                      },
                    ])
                  }
                >
                  Add team
                </button>
                {teams.map((team) => (
                  <div className="team-item" key={team.id}>
                    <b>{team.name}</b>
                    <small>2 players assigned</small>
                    <button
                      className="delete"
                      onClick={() =>
                        setTeams(teams.filter((item) => item.id !== team.id))
                      }
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
          {draft.rounds === 0 && (
            <div className="custom-cycle-summary">
              First cycle:{" "}
              {Math.max(
                1,
                Math.ceil(
                  (draft.type === "team" ? teams.length : players.length) /
                    (draft.type === "team"
                      ? draft.courts * 2
                      : draft.courts * 4),
                ),
              )}{" "}
              rounds. Add another round to continue the next play cycle.
            </div>
          )}
          <div className="wizard-actions">
            <button className="secondary" onClick={() => setStep(step - 1)}>
              Back
            </button>
            <button className="primary" onClick={create}>
              Generate tournament <span>→</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function Tournament({
  item,
  tab,
  setTab,
  update,
  standings,
  date,
  back,
}: {
  item: Tournament;
  tab: "overview" | "schedule" | "leaderboard" | "settings";
  setTab: (value: "overview" | "schedule" | "leaderboard" | "settings") => void;
  update: (value: Tournament) => void;
  standings: ReturnType<typeof calculateStandings>;
  date: (value: string) => string;
  back: () => void;
}) {
  const progress = tournamentProgress(item);
  const player = (playerId: string) =>
    item.players.find((value) => value.id === playerId)?.name ?? "Player";
  const saveScore = (
    roundIndex: number,
    matchIndex: number,
    score1: number,
    score2: number,
  ) => {
    const rounds = item.rounds.map((round, r) =>
      r === roundIndex
        ? {
            ...round,
            matches: round.matches.map((match, m) =>
              m === matchIndex
                ? { ...match, score1, score2, status: "completed" as const }
                : match,
            ),
          }
        : round,
    );
    update({
      ...item,
      rounds,
      status: rounds.every((round) =>
        round.matches.every((match) => match.status === "completed"),
      )
        ? "completed"
        : "active",
      updatedAt: new Date().toISOString(),
    });
  };
  const addRound = () => {
    const nextNumber = item.rounds.length + 1;
    const extra =
      item.type === "team"
        ? generateTeamRounds(item.teams ?? [], item.courts, 1)[0]
        : generateIndividualRounds(item.players, item.courts, 1, item.type)[0];
    update({
      ...item,
      numberOfRounds: nextNumber,
      rounds: [...item.rounds, { ...extra, roundNumber: nextNumber }],
      status: "active",
      updatedAt: new Date().toISOString(),
    });
  };
  const regenerate = () => {
    if (
      !window.confirm(
        "Regenerate the schedule? Existing scores will be removed.",
      )
    )
      return;
    const rounds =
      item.type === "team"
        ? generateTeamRounds(item.teams ?? [], item.courts, item.rounds.length)
        : generateIndividualRounds(
            item.players,
            item.courts,
            item.rounds.length,
            item.type,
          );
    update({
      ...item,
      rounds,
      status: "active",
      updatedAt: new Date().toISOString(),
    });
  };
  return (
    <section className="tournament-page">
      <button className="back-link" onClick={back}>
        ← All tournaments
      </button>
      <div className="tournament-header">
        <div>
          <div className="eyebrow">
            {item.type.toUpperCase()} / {item.status.toUpperCase()}
          </div>
          <h1>{item.name}</h1>
          <p>
            ⌖ {item.venue} · {date(item.date)}
          </p>
        </div>
        <div className="progress-ring">
          <b>
            {progress.total
              ? Math.round((progress.completed / progress.total) * 100)
              : 0}
            %
          </b>
          <small>complete</small>
        </div>
      </div>
      <div className="tournament-nav">
        {(["overview", "schedule", "leaderboard", "settings"] as const).map(
          (value) => (
            <button
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
              key={value}
            >
              {value}
            </button>
          ),
        )}
      </div>
      {tab === "overview" && (
        <div className="overview-grid">
          <div className="overview-main">
            <div className="eyebrow">TOURNAMENT SNAPSHOT</div>
            <h2>Ready for the next point?</h2>
            <div className="metric-grid">
              <div>
                <b>{item.players.length}</b>
                <span>Players</span>
              </div>
              <div>
                <b>{item.rounds.length}</b>
                <span>Rounds</span>
              </div>
              <div>
                <b>{item.pointsPerMatch}</b>
                <span>Points / match</span>
              </div>
              <div>
                <b>{item.courts}</b>
                <span>Courts</span>
              </div>
            </div>
          </div>
          <div className="progress-card">
            <span className="eyebrow">MATCH PROGRESS</span>
            <strong>
              {progress.completed}
              <small> / {progress.total}</small>
            </strong>
            <p>matches completed</p>
            <div className="progress-bar">
              <span
                style={{
                  width: `${progress.total ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <button className="primary full" onClick={() => setTab("schedule")}>
              Open schedule →
            </button>
          </div>
        </div>
      )}
      {tab === "schedule" && (
        <div className="schedule">
          {item.rounds.map((round, roundIndex) => (
            <div className="round" key={round.id}>
              <div className="round-heading">
                <h2>Round {round.roundNumber}</h2>
                <span>{round.restPlayerIds.length} resting</span>
              </div>
              <div className="matches">
                {round.matches.map((match, matchIndex) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    player={player}
                    points={item.pointsPerMatch}
                    save={(a, b) => saveScore(roundIndex, matchIndex, a, b)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === "leaderboard" && (
        <div className="leaderboard">
          {standings.length ? (
            standings.map((standing, index) => (
              <div className="standing" key={standing.id}>
                <strong>#{index + 1}</strong>
                <div>
                  <b>{standing.name}</b>
                  <small>
                    {standing.matches} matches · {standing.wins}W{" "}
                    {standing.losses}L
                  </small>
                </div>
                <strong>{standing.points} pts</strong>
                <span>
                  {standing.pointsFor - standing.pointsAgainst > 0 ? "+" : ""}
                  {standing.pointsFor - standing.pointsAgainst}
                </span>
              </div>
            ))
          ) : (
            <div className="empty">
              <b>No completed matches yet.</b>
              <p>Leaderboard will appear after the first score.</p>
            </div>
          )}
        </div>
      )}
      {tab === "settings" && (
        <div className="settings-card">
          <div>
            <span className="eyebrow">FORMAT</span>
            <h2>{item.type} Americano</h2>
            <p>
              {item.pointsPerMatch} total points · {item.courts} courts ·{" "}
              {item.rounds.length} rounds
            </p>
          </div>
          <div className="settings-actions">
            <button className="secondary" onClick={addRound}>
              + Add round
            </button>
            <button className="danger" onClick={regenerate}>
              Regenerate schedule
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
function MatchCard({
  match,
  player,
  points,
  save,
}: {
  match: Match;
  player: (id: string) => string;
  points: PointsPerMatch;
  save: (a: number, b: number) => void;
}) {
  const [score1, setScore1] = useState(match.score1?.toString() ?? "");
  const [score2, setScore2] = useState(match.score2?.toString() ?? "");
  const updateFirst = (value: string) => {
    const number = Number(value.replace(/\D/g, ""));
    setScore1(value.replace(/\D/g, ""));
    if (value !== "") setScore2(String(Math.max(0, points - number)));
  };
  const updateSecond = (value: string) => {
    const number = Number(value.replace(/\D/g, ""));
    setScore2(value.replace(/\D/g, ""));
    if (value !== "") setScore1(String(Math.max(0, points - number)));
  };
  const valid =
    score1 !== "" &&
    score2 !== "" &&
    Number(score1) + Number(score2) === points;
  return (
    <div className="match-card">
      <div className="court-label">
        Court {match.courtNumber}
        <span>{match.status === "completed" ? "Completed" : "Scheduled"}</span>
      </div>
      <div className="teams">
        <div>
          <b>{match.team1PlayerIds.map(player).join(" + ")}</b>
          <input
            value={score1}
            onChange={(e) => updateFirst(e.target.value)}
            aria-label="Team one score"
          />
        </div>
        <strong>VS</strong>
        <div>
          <input
            value={score2}
            onChange={(e) => updateSecond(e.target.value)}
            aria-label="Team two score"
          />
          <b>{match.team2PlayerIds.map(player).join(" + ")}</b>
        </div>
      </div>
      <div className="score-footer">
        <span>
          Total{" "}
          <b>
            {Number(score1 || 0) + Number(score2 || 0)} / {points}
          </b>
        </span>
        <button
          className={valid ? "primary compact" : "secondary compact"}
          disabled={!valid}
          onClick={() => save(Number(score1), Number(score2))}
        >
          {match.status === "completed" ? "Edit score" : "Save score"}
        </button>
      </div>
      {score1 && score2 && !valid && (
        <small className="error">Scores must add up to {points} points.</small>
      )}
    </div>
  );
}
