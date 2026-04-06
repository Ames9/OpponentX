"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trophy, Calendar, Check, ChevronsUpDown, ArrowRight, Activity, MapPin, ExternalLink } from "lucide-react";
import { NFL_TEAMS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import gamesDataRaw from "@/data/games.json";

// ---- Types ----
type Hint1 = {
  baseTeam: { passYds: number; rushYds: number; turnovers: number };
  opponentTeam: { passYds: number; rushYds: number; turnovers: number };
};

type Hint2 = {
  baseTeam: number[];
  baseTotal: number;
  opponentTeam: number[];
  opponentTotal: number;
};

type Hint3 = {
  team: "baseTeam" | "opponentTeam";
  position: string;
  playerName?: string;
  statLine: string;
};

type Game = {
  gameId: string;
  season: number;
  week?: number;
  espnUrl?: string;
  baseTeam: string;
  opponentTeam: string;
  isHome: boolean;
  hints: {
    hint1_teamStats: Hint1;
    hint2_qByQ: Hint2;
    hint2_tds?: { baseTeam: string[]; opponentTeam: string[] };
    hint3_topPerformers: Hint3[];
  };
};

const allGames = gamesDataRaw as Game[];

// ---- Team Selection Screen ----
const MIN_YEAR = 2016;
const MAX_YEAR = 2025;
const YEAR_SPAN = MAX_YEAR - MIN_YEAR;

function TeamSelectScreen({
  onStart,
}: {
  onStart: (team: string, years: number[]) => void;
}) {
  const [yearRange, setYearRange] = useState<[number, number]>([2021, 2025]);

  const selectedYears = useMemo(
    () => Array.from({ length: yearRange[1] - yearRange[0] + 1 }, (_, i) => yearRange[0] + i),
    [yearRange]
  );

  const leftPct = ((yearRange[0] - MIN_YEAR) / YEAR_SPAN) * 100;
  const rightPct = ((yearRange[1] - MIN_YEAR) / YEAR_SPAN) * 100;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 flex-col">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-secondary/30 p-8 rounded-3xl border border-secondary text-center"
      >
        <Trophy size={48} className="mx-auto text-primary mb-6" />
        <h1 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">
          Opponent X
        </h1>
        <p className="text-slate-400 mb-4">
          Select your favorite team to start guessing their past games.
        </p>
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-6">
          <span>Updated: Now covering 2016 – 2025 (all games)</span>
        </div>

        {/* Season Range Slider */}
        <div className="mb-8">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-4">Season Range</p>

          {/* Selected range label */}
          <div className="flex justify-between items-baseline mb-4 px-1">
            <span className="text-xs text-slate-500">{MIN_YEAR}</span>
            <span className="text-lg font-black text-white">
              {yearRange[0] === yearRange[1] ? yearRange[0] : `${yearRange[0]} – ${yearRange[1]}`}
              <span className="text-xs font-normal text-slate-400 ml-2">
                ({selectedYears.length} season{selectedYears.length !== 1 ? "s" : ""})
              </span>
            </span>
            <span className="text-xs text-slate-500">{MAX_YEAR}</span>
          </div>

          {/* Slider track */}
          <div className="relative flex items-center" style={{ height: "32px" }}>
            {/* Background track */}
            <div className="absolute w-full h-1.5 bg-slate-700 rounded-full" />
            {/* Active fill */}
            <div
              className="absolute h-1.5 bg-primary rounded-full pointer-events-none"
              style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
            />
            {/* Start handle */}
            <input
              type="range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={yearRange[0]}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), yearRange[1]);
                setYearRange([v, yearRange[1]]);
              }}
              className="range-thumb"
              style={{ zIndex: yearRange[0] >= MAX_YEAR - 1 ? 5 : 3 }}
            />
            {/* End handle */}
            <input
              type="range"
              min={MIN_YEAR}
              max={MAX_YEAR}
              value={yearRange[1]}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), yearRange[0]);
                setYearRange([yearRange[0], v]);
              }}
              className="range-thumb"
              style={{ zIndex: 4 }}
            />
          </div>
        </div>

        {/* Team List */}
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2 custom-scrollbar text-left rounded-xl">
          {NFL_TEAMS.map((team) => (
            <button
              key={team.value}
              onClick={() => onStart(team.value, selectedYears)}
              className="w-full bg-slate-900 border border-slate-700 hover:border-primary hover:bg-slate-800 text-white font-bold py-4 px-4 rounded-xl transition-all flex justify-between items-center relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: team.color }} />
              <span className="ml-3">{team.label}</span>
              <span className="text-slate-500 text-sm hidden sm:inline">{team.division}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </main>
  );
}

// ---- Main Game Component ----
export default function OpponentXGame() {
  const [baseTeamSetup, setBaseTeamSetup] = useState<string | null>(null);
  const [activeYears, setActiveYears] = useState<number[]>([]);

  // Game States
  const [filteredGames, setFilteredGames] = useState<Game[]>([]);
  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [hintLevel, setHintLevel] = useState<number>(1);
  const [mistakes, setMistakes] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [shake, setShake] = useState(false);

  // Input states
  const [selectedGuessTeam, setSelectedGuessTeam] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");

  const startGame = (teamStr: string, years: number[]) => {
    const fg = allGames
      .filter(
        (g) =>
          (g.baseTeam === teamStr || g.opponentTeam === teamStr) &&
          years.includes(g.season)
      )
      .sort(() => Math.random() - 0.5);
    setFilteredGames(fg);
    setBaseTeamSetup(teamStr);
    setActiveYears(years);
    resetGameState(0);
  };

  const resetGameState = (idx?: number) => {
    setHintLevel(1);
    setMistakes(0);
    setIsGameOver(false);
    setHasWon(false);
    setSelectedGuessTeam("");
    if (idx !== undefined) setCurrentGameIndex(idx);
  };

  const nextGame = () => {
    const next = currentGameIndex + 1;
    if (next >= filteredGames.length) {
      // 全ゲーム消化したら再シャッフルして最初から
      setFilteredGames((prev) => [...prev].sort(() => Math.random() - 0.5));
      resetGameState(0);
    } else {
      resetGameState(next);
    }
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSkipOrMistake = () => {
    triggerShake();
    const newMistakes = mistakes + 1;
    setMistakes(newMistakes);
    if (newMistakes === 1) setHintLevel(2);
    if (newMistakes === 2) setHintLevel(3);
    if (newMistakes >= 3) {
      setHasWon(false);
      setIsGameOver(true);
    }
  };

  if (!baseTeamSetup) {
    return <TeamSelectScreen onStart={startGame} />;
  }

  const rawGame = filteredGames[currentGameIndex];

  if (!rawGame) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 flex-col text-center">
        <h2 className="text-2xl font-bold text-white mb-4">
          No games found for {baseTeamSetup} in the selected seasons.
        </h2>
        <button
          onClick={() => setBaseTeamSetup(null)}
          className="px-6 py-2 bg-primary rounded-lg font-bold text-white"
        >
          Back to Select
        </button>
      </main>
    );
  }

  const isBase = rawGame.baseTeam === baseTeamSetup;
  const displayBaseTeam = isBase ? rawGame.baseTeam : rawGame.opponentTeam;
  const displayOpponentTeam = isBase ? rawGame.opponentTeam : rawGame.baseTeam;

  const baseTeamInfo = NFL_TEAMS.find((t) => t.value === displayBaseTeam);
  const teamColor = baseTeamInfo?.color || "#1e40af";

  const displayBaseQbyQ = isBase ? rawGame.hints.hint2_qByQ.baseTeam : rawGame.hints.hint2_qByQ.opponentTeam;
  const displayBaseTotal = isBase ? rawGame.hints.hint2_qByQ.baseTotal : rawGame.hints.hint2_qByQ.opponentTotal;
  const displayOppQbyQ = isBase ? rawGame.hints.hint2_qByQ.opponentTeam : rawGame.hints.hint2_qByQ.baseTeam;
  const displayOppTotal = isBase ? rawGame.hints.hint2_qByQ.opponentTotal : rawGame.hints.hint2_qByQ.baseTotal;

  const baseTds = isBase ? rawGame.hints.hint2_tds?.baseTeam : rawGame.hints.hint2_tds?.opponentTeam;

  const baseTeamPerformers = rawGame.hints.hint3_topPerformers.filter((perf) => {
    return (isBase && perf.team === "baseTeam") || (!isBase && perf.team === "opponentTeam");
  });

  const opponentTeamInfo = NFL_TEAMS.find((t) => t.value === displayOpponentTeam);
  const isTargetHome = isBase;

  const handleGuess = () => {
    if (!selectedGuessTeam) return;
    if (selectedGuessTeam === displayOpponentTeam) {
      setHasWon(true);
      setIsGameOver(true);
    } else {
      handleSkipOrMistake();
    }
  };

  const filteredTeams = NFL_TEAMS.filter(
    (t) =>
      t.label.toLowerCase().includes(teamSearch.toLowerCase()) ||
      t.value.toLowerCase().includes(teamSearch.toLowerCase())
  );

  // Team color CSS variables
  const teamColorStyle = {
    "--team-color": teamColor,
    "--team-color-20": teamColor + "33",
    "--team-color-10": teamColor + "1a",
  } as React.CSSProperties;

  return (
    <main
      className="min-h-screen pb-20 max-w-4xl mx-auto px-4 sm:px-6 relative"
      style={teamColorStyle}
    >
      {/* Dynamic background gradient */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(ellipse at top left, ${teamColor}22 0%, transparent 60%)`,
        }}
      />

      <header
        className="py-6 mb-8 flex justify-between items-center relative z-10"
        style={{ borderBottom: `1px solid ${teamColor}44` }}
      >
        <div>
          <h1
            className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent uppercase tracking-tighter cursor-pointer hover:opacity-80"
            onClick={() => setBaseTeamSetup(null)}
          >
            Opponent X
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Playing as{" "}
            <span className="font-bold" style={{ color: teamColor }}>
              {displayBaseTeam}
            </span>
            {" | "}
            <span className="text-slate-500">
              {activeYears.sort().join(", ")}
            </span>
          </p>
        </div>
        <div className="flex gap-2 text-xl font-bold bg-secondary/40 px-4 py-2 rounded-lg">
          <span className={mistakes > 0 ? "text-error" : "text-green-500"}>X</span>
          <span className={mistakes > 1 ? "text-error" : "text-green-500"}>X</span>
          <span className={mistakes > 2 ? "text-error" : "text-green-500"}>X</span>
        </div>
      </header>

      <div className={cn("grid gap-6 relative z-10", isGameOver ? "opacity-70 pointer-events-none" : "", shake ? "shake" : "")}>

        {/* ---- VS Header + Box Score (前提情報) ---- */}
        <section
          className="rounded-2xl border overflow-hidden"
          style={{ borderColor: `${teamColor}44`, backgroundColor: `${teamColor}11` }}
        >
          {/* VS Row */}
          <div className="p-5 flex items-center justify-evenly">
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-xl text-white shadow-lg border-2 border-white/20"
                style={{ backgroundColor: teamColor }}
              >
                {displayBaseTeam}
              </div>
              <p className="font-bold text-slate-300 text-sm">Your Team</p>
            </div>
            <div className="text-2xl font-black text-slate-500 italic">VS</div>
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-800/80 outline-dashed outline-2 outline-slate-600 rounded-full mx-auto mb-2 flex items-center justify-center font-black text-3xl text-slate-400 shadow-inner">
                ?
              </div>
              <p className="font-bold text-slate-400 text-sm">Team X</p>
            </div>
          </div>

          {/* Box Score */}
          <div
            className="px-5 pb-5"
            style={{ borderTop: `1px solid ${teamColor}33` }}
          >
            <p className="text-xs font-bold uppercase tracking-widest pt-4 pb-3 flex items-center gap-2" style={{ color: `${teamColor}cc` }}>
              <Calendar size={13} /> Box Score
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-center text-sm">
                <thead>
                  <tr className="text-slate-500 border-b border-slate-800/50">
                    <th className="pb-2 text-left w-20">Team</th>
                    {displayBaseQbyQ.map((_, i) => (
                      <th key={i} className="pb-2">Q{i + 1}</th>
                    ))}
                    <th className="pb-2 font-black text-white">TOT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800/30">
                    <td className="py-2.5 text-left font-bold text-slate-200">{displayBaseTeam}</td>
                    {displayBaseQbyQ.map((q, i) => (
                      <td key={i} className="py-2.5 font-medium text-slate-200">{q}</td>
                    ))}
                    <td className="py-2.5 font-black text-lg text-white">
                      {displayBaseTotal}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 text-left font-bold text-slate-500 italic">Team X</td>
                    {displayOppQbyQ.map((q, i) => (
                      <td key={i} className="py-2.5 font-medium text-slate-400">{q}</td>
                    ))}
                    <td className="py-2.5 font-black text-lg text-slate-300">{displayOppTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ---- Hints ---- */}
        <section className="space-y-4">

          {/* HINT 1: Top Performers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl bg-secondary/30 border border-slate-800 backdrop-blur-sm shadow-md"
          >
            <h3 className="text-sm text-orange-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy size={15} /> Hint 1: Our Top Performers
            </h3>

            {baseTeamPerformers.length > 0 ? (
              <div className="space-y-2">
                {baseTeamPerformers.map((perf, i) => (
                  <div
                    key={i}
                    className="flex items-center p-3 bg-slate-900/60 rounded-lg border border-slate-800/80"
                  >
                    <div className="w-10 flex-shrink-0 font-black text-xs bg-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-center">
                      {perf.position}
                    </div>
                    <div className="flex-1 ml-3 text-sm">
                      <span className="font-bold text-white mr-2">{perf.playerName || "Player"}</span>
                      <span className="text-slate-400">{perf.statLine}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-slate-500 italic text-sm p-3 text-center">
                No major individual performances recorded.
              </div>
            )}
          </motion.div>

          {/* HINT 2: Our Scoring Plays (TDs) */}
          <AnimatePresence>
            {hintLevel >= 2 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <div className="p-5 rounded-2xl bg-secondary/30 border border-slate-800 backdrop-blur-sm shadow-md">
                  <h3 className="text-sm text-green-400 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Activity size={15} /> Hint 2: Our Scoring Plays
                  </h3>

                  {baseTds && baseTds.length > 0 ? (
                    <div className="space-y-2">
                      {baseTds.map((td, i) => (
                        <div
                          key={i}
                          className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-slate-300 text-xs leading-relaxed font-mono"
                        >
                          {td}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-slate-500 italic text-sm p-3 text-center">
                      No touchdowns scored by our team.
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HINT 3: Context (Location, Season/Week, Division) */}
          <AnimatePresence>
            {hintLevel >= 3 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden"
              >
                <div className="p-5 rounded-2xl bg-secondary/30 border border-slate-800 backdrop-blur-sm shadow-md">
                  <h3 className="text-sm text-accent font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MapPin size={15} /> Hint 3: Opponent Context
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 text-center">
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Location</p>
                      <p className="text-base font-black text-white">{isTargetHome ? "HOME" : "AWAY"}</p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 text-center">
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Season</p>
                      <p className="text-base font-black text-white">{rawGame.season}</p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 text-center">
                      <p className="text-xs text-slate-500 font-bold uppercase mb-1">Week</p>
                      <p className="text-base font-black text-white">{rawGame.week ?? "?"}</p>
                    </div>
                    <div className="col-span-3 bg-slate-900/80 p-3 rounded-xl border border-slate-700/50 flex justify-between items-center">
                      <p className="text-xs text-slate-500 font-bold uppercase">Opponent Division</p>
                      <p className="text-base font-black text-accent">{opponentTeamInfo?.division || "Unknown"}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      {/* ---- Result / Guess Panel ---- */}
      {isGameOver ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-6 p-8 rounded-2xl border bg-slate-900/95 backdrop-blur-lg border-slate-700 text-center shadow-2xl relative overflow-hidden z-10"
        >
          <div
            className={cn(
              "absolute inset-0 opacity-10 bg-gradient-to-b",
              hasWon ? "from-green-500 to-transparent" : "from-red-500 to-transparent"
            )}
          />
          <h2
            className={cn(
              "relative text-4xl font-black mb-3 tracking-tight",
              hasWon ? "text-accent" : "text-error"
            )}
          >
            {hasWon ? "YOU GOT IT!" : "GAME OVER"}
          </h2>
          <p className="relative text-xl text-slate-300 font-medium mb-2">
            The Opponent was the{" "}
            <span className="font-black text-white text-2xl mx-1 underline decoration-primary decoration-4 underline-offset-4">
              {displayOpponentTeam}
            </span>
            !
          </p>
          {/* Season + Week info */}
          <div className="relative inline-flex items-center gap-2 bg-slate-800/80 px-4 py-2 rounded-full mt-2 mb-6">
            <Calendar size={14} className="text-slate-400" />
            <span className="text-slate-300 text-sm font-semibold">
              {rawGame.season} Season · Week {rawGame.week ?? "?"}
            </span>
          </div>
          {/* ESPN Link */}
          {rawGame.espnUrl && (
            <div className="relative mb-6">
              <a
                href={rawGame.espnUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 hover:border-slate-500 text-slate-200 font-bold py-2.5 px-5 rounded-xl transition-all text-sm"
              >
                <ExternalLink size={15} />
                View Game on ESPN
              </a>
            </div>
          )}

          <button
            onClick={nextGame}
            className="relative bg-primary hover:bg-blue-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-primary/20 inline-flex items-center gap-2"
          >
            Try Next Game <ArrowRight size={20} />
          </button>
        </motion.div>
      ) : (
        <div className="mt-6 relative z-50">
          <div className="p-5 bg-secondary/30 backdrop-blur border border-slate-700/60 rounded-2xl flex flex-col sm:flex-row gap-4 items-end shadow-xl">
            <div className="flex-1 w-full relative">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                Guess Team X
              </label>
              <div
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 flex justify-between items-center cursor-pointer hover:border-slate-500 transition-colors shadow-inner"
                onClick={() => setComboOpen(!comboOpen)}
              >
                <span className={selectedGuessTeam ? "text-white font-semibold" : "text-slate-500"}>
                  {selectedGuessTeam
                    ? NFL_TEAMS.find((t) => t.value === selectedGuessTeam)?.label
                    : "Select Team..."}
                </span>
                <ChevronsUpDown size={16} className="text-slate-400" />
              </div>

              {comboOpen && (
                <div className="absolute bottom-full mb-2 left-0 right-0 bg-slate-900 border border-slate-600 rounded-xl max-h-64 overflow-y-auto shadow-2xl shadow-black/50 z-50">
                  <div className="p-2 sticky top-0 bg-slate-900 border-b border-slate-800">
                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-lg">
                      <Search size={16} className="text-slate-400" />
                      <input
                        className="bg-transparent border-none outline-none text-sm w-full text-white"
                        placeholder="Search team..."
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="p-2">
                    {filteredTeams.map((team) => (
                      <div
                        key={team.value}
                        className={cn(
                          "px-3 py-2 text-sm rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-colors relative overflow-hidden",
                          selectedGuessTeam === team.value
                            ? "bg-primary text-white font-bold"
                            : "text-slate-300 hover:bg-slate-800"
                        )}
                        onClick={() => {
                          setSelectedGuessTeam(team.value);
                          setComboOpen(false);
                          setTeamSearch("");
                        }}
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: team.color }} />
                        <span className="ml-2">{team.label}</span>
                        {selectedGuessTeam === team.value && <Check size={16} />}
                      </div>
                    ))}
                    {filteredTeams.length === 0 && (
                      <div className="p-3 text-sm text-center text-slate-500">No teams found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-full sm:w-auto flex gap-3 h-[58px]">
              <button
                onClick={handleSkipOrMistake}
                className="bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-300 font-bold py-4 px-6 rounded-xl transition-all shadow-md h-full flex items-center justify-center"
                title="Skip & Reveal Hint"
              >
                Skip / Next Hint
              </button>
              <button
                onClick={handleGuess}
                disabled={!selectedGuessTeam}
                className="bg-primary hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-xl transition-all shadow-md flex-1 shadow-primary/20 h-full flex items-center justify-center"
              >
                Guess
              </button>
            </div>
          </div>
        </div>
      )}

      {comboOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setComboOpen(false)} />
      )}
    </main>
  );
}
