import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Play, Users, Clock, RotateCcw, Trophy, Shuffle } from 'lucide-react';
import { games } from '@/data/mockData';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ─── Memory Match Game ───────────────────────────────────
const EMOJIS = ['🎨', '🎵', '🎮', '🌟', '🍕', '🚀', '🌈', '🎭'];

interface Card {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function MemoryMatchGame() {
  const [cards, setCards] = useState<Card[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsed, setElapsed] = useState(0);

  const initGame = useCallback(() => {
    const shuffled = [...EMOJIS, ...EMOJIS]
      .sort(() => Math.random() - 0.5)
      .map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false }));
    setCards(shuffled);
    setFlipped([]);
    setMoves(0);
    setMatches(0);
    setGameWon(false);
    setStartTime(Date.now());
    setElapsed(0);
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (gameWon) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, gameWon]);

  useEffect(() => {
    if (flipped.length === 2) {
      const [a, b] = flipped;
      if (cards[a].emoji === cards[b].emoji) {
        setCards(prev => prev.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
        setMatches(m => m + 1);
        setFlipped([]);
      } else {
        const timer = setTimeout(() => {
          setCards(prev => prev.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
          setFlipped([]);
        }, 800);
        return () => clearTimeout(timer);
      }
    }
  }, [flipped, cards]);

  useEffect(() => {
    if (matches === EMOJIS.length && matches > 0) {
      setGameWon(true);
    }
  }, [matches]);

  const handleCardClick = (index: number) => {
    if (flipped.length === 2 || cards[index].flipped || cards[index].matched) return;
    setCards(prev => prev.map((c, i) => (i === index ? { ...c, flipped: true } : c)));
    setFlipped(prev => [...prev, index]);
    if (flipped.length === 0) setMoves(m => m + 1);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-[#8b7e7e]">Moves: <span className="text-[#eeeeee] font-medium">{moves}</span></div>
          <div className="text-sm text-[#8b7e7e]">Time: <span className="text-[#eeeeee] font-medium">{formatTime(elapsed)}</span></div>
          <div className="text-sm text-[#8b7e7e]">Matches: <span className="text-[#eeeeee] font-medium">{matches}/{EMOJIS.length}</span></div>
        </div>
        <button onClick={initGame} className="p-2 rounded-lg bg-[#134f5c] text-[#8b7e7e] hover:text-[#eeeeee] transition-colors">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {gameWon && (
        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-[#eeeeee]">You won!</p>
          <p className="text-sm text-[#8b7e7e]">{moves} moves in {formatTime(elapsed)}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
        {cards.map((card, i) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(i)}
            className={`aspect-square rounded-xl text-3xl flex items-center justify-center transition-all duration-300 ${
              card.flipped || card.matched
                ? 'bg-[#134f5c] rotate-0'
                : 'bg-[#1a7a8d]/30 hover:bg-[#1a7a8d]/50 rotate-180'
            } ${card.matched ? 'ring-2 ring-emerald-400/50' : ''}`}
            disabled={card.flipped || card.matched}
          >
            {(card.flipped || card.matched) ? card.emoji : '?'}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Number Puzzle (Sliding 15-puzzle) ───────────────────
function NumberPuzzleGame() {
  const [tiles, setTiles] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [solved, setSolved] = useState(false);
  const [startTime, setStartTime] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const initGame = useCallback(() => {
    // Start solved, then scramble
    const solved = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
    // Scramble by making valid moves from solved state
    let current = [...solved];
    let emptyIdx = 15;
    for (let i = 0; i < 200; i++) {
      const neighbors = [];
      const row = Math.floor(emptyIdx / 4);
      const col = emptyIdx % 4;
      if (row > 0) neighbors.push(emptyIdx - 4);
      if (row < 3) neighbors.push(emptyIdx + 4);
      if (col > 0) neighbors.push(emptyIdx - 1);
      if (col < 3) neighbors.push(emptyIdx + 1);
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      [current[emptyIdx], current[pick]] = [current[pick], current[emptyIdx]];
      emptyIdx = pick;
    }
    setTiles(current);
    setMoves(0);
    setSolved(false);
    setStartTime(Date.now());
    setElapsed(0);
  }, []);

  useEffect(() => { initGame(); }, [initGame]);

  useEffect(() => {
    if (solved) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, solved]);

  const handleTileClick = (index: number) => {
    if (solved) return;
    const emptyIdx = tiles.indexOf(0);
    const row = Math.floor(index / 4);
    const col = index % 4;
    const emptyRow = Math.floor(emptyIdx / 4);
    const emptyCol = emptyIdx % 4;

    const isAdjacent =
      (Math.abs(row - emptyRow) === 1 && col === emptyCol) ||
      (Math.abs(col - emptyCol) === 1 && row === emptyRow);

    if (isAdjacent) {
      const newTiles = [...tiles];
      [newTiles[index], newTiles[emptyIdx]] = [newTiles[emptyIdx], newTiles[index]];
      setTiles(newTiles);
      setMoves(m => m + 1);

      // Check solved
      const isSolved = newTiles.every((t, i) => t === (i === 15 ? 0 : i + 1));
      if (isSolved) setSolved(true);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-[#8b7e7e]">Moves: <span className="text-[#eeeeee] font-medium">{moves}</span></div>
          <div className="text-sm text-[#8b7e7e]">Time: <span className="text-[#eeeeee] font-medium">{formatTime(elapsed)}</span></div>
        </div>
        <button onClick={initGame} className="p-2 rounded-lg bg-[#134f5c] text-[#8b7e7e] hover:text-[#eeeeee] transition-colors">
          <Shuffle className="w-4 h-4" />
        </button>
      </div>

      {solved && (
        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 text-center animate-fade-in">
          <Trophy className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-display font-semibold text-[#eeeeee]">Puzzle solved!</p>
          <p className="text-sm text-[#8b7e7e]">{moves} moves in {formatTime(elapsed)}</p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto bg-[#0c343d] p-3 rounded-xl">
        {tiles.map((num, i) => (
          <button
            key={i}
            onClick={() => handleTileClick(i)}
            className={`aspect-square rounded-lg font-display font-bold text-lg flex items-center justify-center transition-all ${
              num === 0
                ? 'bg-transparent'
                : 'bg-[#134f5c] text-[#eeeeee] hover:bg-[#1a7a8d] lounge-shadow-sm'
            }`}
          >
            {num !== 0 && num}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Games Page ──────────────────────────────────────────
export default function GamesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('solo');
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const soloGames = games.filter(g => g.category === 'solo');
  const vsGames = games.filter(g => g.category === 'head-to-head');

  return (
    <div className="space-y-6 animate-fade-in">
      <button
        onClick={() => navigate('/chill')}
        className="flex items-center gap-2 text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">Back to Chill Lounge</span>
      </button>

      <div>
        <h2 className="font-display text-3xl font-bold text-[#eeeeee] mb-1">Games</h2>
        <p className="text-[#8b7e7e]">Take a break and challenge yourself or a teammate.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#134f5c]">
          <TabsTrigger value="solo" className="data-[state=active]:bg-[#1a7a8d]">Solo</TabsTrigger>
          <TabsTrigger value="head-to-head" className="data-[state=active]:bg-[#1a7a8d]">Head-to-head</TabsTrigger>
        </TabsList>

        {activeGame === null ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {(activeTab === 'solo' ? soloGames : vsGames).map(game => (
              <div key={game.id} className="bg-[#134f5c] rounded-2xl overflow-hidden lounge-shadow hover-lift transition-all">
                <img src={game.cover} alt={game.title} className="w-full h-40 object-cover" />
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-display font-semibold text-[#eeeeee] text-lg">{game.title}</h3>
                      <p className="text-sm text-[#8b7e7e] mt-1 line-clamp-2">{game.description}</p>
                    </div>
                    {game.status === 'coming-soon' && (
                      <span className="text-xs bg-[#8b7e7e]/20 text-[#8b7e7e] px-2 py-1 rounded-full whitespace-nowrap ml-2">Coming soon</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-[#8b7e7e]">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {game.avgPlayTime}</span>
                    {game.status === 'live' && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {game.playersToday} today</span>}
                  </div>
                  {game.status === 'live' ? (
                    <button
                      onClick={() => setActiveGame(game.id)}
                      className="mt-3 w-full py-2.5 rounded-xl bg-[#1a7a8d] text-[#eeeeee] font-medium text-sm hover:bg-[#1a7a8d]/80 transition-colors flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" /> Play
                    </button>
                  ) : (
                    <button
                      disabled
                      className="mt-3 w-full py-2.5 rounded-xl bg-[#282828] text-[#8b7e7e] font-medium text-sm cursor-not-allowed"
                    >
                      Coming soon
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <button
              onClick={() => setActiveGame(null)}
              className="mb-4 flex items-center gap-2 text-sm text-[#8b7e7e] hover:text-[#eeeeee] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to games
            </button>
            <div className="bg-[#134f5c] rounded-2xl p-6 lounge-shadow">
              {activeGame === 'g1' && <MemoryMatchGame />}
              {activeGame === 'g2' && <NumberPuzzleGame />}
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}
