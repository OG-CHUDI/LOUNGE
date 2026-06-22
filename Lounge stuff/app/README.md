# Lounge — AIENAI Team Space

An internal productivity-and-culture platform for a small, senior creative team. Built with a dark, cosy "members' lounge" aesthetic that still reads as professional.

## Features

- **Home Dashboard** — Personalised greeting, desk pet hero with XP progress, lounge entry cards, AMA spotlight, and meme wall preview
- **Chill Lounge** — Games (Memory Match + Number Puzzle), Music (Spotify embeds + team playlists), Collaborative Canvas (tldraw whiteboard), Desk Pets, and Meme Wall
- **Learning Lounge** — Mini-Courses catalogue, Skill Swap board, Brain Teaser leaderboard, and AMA Archive
- **Focus Lounge** — Pomodoro timer with SVG progress ring, group focus sessions, and Focus Mode toggle
- **Theme Toggle** — Dark/light mode switch
- **Focus Mode** — "Bat-Signal" toggle that mutes notifications and signals deep work

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS + shadcn/ui components
- react-router-dom for routing
- tldraw for collaborative whiteboard
- All data is local mock data — no backend required

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
  components/       # App shell (Sidebar, TopBar, AppLayout)
  contexts/         # ThemeContext, FocusModeContext
  data/             # Mock data and TypeScript types
  pages/            # Route pages
    chill/          # Chill Lounge pages
    learn/          # Learning Lounge pages
    focus/          # Focus Lounge page
  App.tsx           # Root component with routes
  index.css         # Global styles with design tokens
```

## Backend Integration Points

Search for `// TODO` comments throughout the codebase to find where backend integration should be added:

- `src/data/types.ts` — Update types to match API schemas
- `src/data/mockData.ts` — Replace mock data with API calls
- `src/pages/chill/MemeWallPage.tsx` — Persist pins to backend
- `src/pages/chill/MusicPage.tsx` — Save playlists to backend
- `src/pages/learn/SkillSwapPage.tsx` — Persist skill swap posts
- `src/pages/learn/LeaderboardPage.tsx` — Submit puzzle answers
- `src/pages/learn/AMAPage.tsx` — Submit questions
- `src/pages/focus/FocusLounge.tsx` — Sync focus sessions

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#0c343d` | App background |
| `--surface` | `#134f5c` | Cards, panels, sidebar |
| `--surface-2` | `#282828` | Inputs, code sections |
| `--text` | `#eeeeee` | Primary text |
| `--muted` | `#8b7e7e` | Secondary text, borders |
