# Lounge

An internal productivity-and-culture platform for small, senior creative teams. A dark, cozy "members' lounge" aesthetic with three distinct spaces: Chill, Learning, and Focus.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)

2. **Set environment variables** — copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Then fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project settings (Settings → API).

3. **Run migrations** — the database schema (18 tables with Row Level Security) and seed data are already applied via the Rork migration tool. If you're setting up a fresh Supabase project yourself, run the SQL files in `supabase/` in order:
   ```bash
   supabase db push  # or run the SQL manually in the Supabase SQL editor
   ```

4. **Start the dev server**:
   ```bash
   cd web
   bun install
   bun run dev
   ```

5. **Open the app** at `http://localhost:8080`

## Auth

Lounge uses native Supabase Auth (email/password). On first signup, a profile row is created automatically via a database trigger. All app routes are protected — unauthenticated users are redirected to the login page.

## Architecture

```
web/
  src/
    lib/
      supabase.ts      # Supabase client
      auth.tsx          # Auth context (session, profile, desk pet, focus)
    components/
      AppShell.tsx       # Persistent shell: sidebar + top bar + content
      ui/                # shadcn/ui components
    pages/
      Login.tsx          # Email/password login & signup
      Home.tsx           # Dashboard: greeting, pet, lounge cards, AMA/meme
      Chill.tsx          # Chill Lounge landing
      ChillGames.tsx     # Games hub
      ChillMusic.tsx     # Team playlists & now-playing
      ChillCanvas.tsx    # Collaborative whiteboard
      ChillPets.tsx      # Desk pets & team menagerie
      ChillMemes.tsx     # Meme pinboard
      Learn.tsx          # Learning Lounge landing
      LearnCourses.tsx   # Mini-courses catalogue
      LearnSkillSwap.tsx # Skill swap bulletin board
      LearnLeaderboard.tsx # Brain teaser leaderboard
      LearnAma.tsx       # AMA archive
      Focus.tsx          # Group Pomodoro timer & focus presence
  supabase/
    migrations/          # SQL migration files (for reference)
```

## Design Tokens

| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0c343d` | App background |
| `--surface` | `#134f5c` | Cards, elevated panels, sidebar |
| `--surface-2` | `#282828` | Inputs, secondary sections |
| `--text` | `#eeeeee` | Primary text, button fills |
| `--muted` | `#8b7e7e` | Secondary text, borders |

Fonts: **Inter** (body/UI) and **Space Grotesk** (display titles). Both loaded from Google Fonts; easy to swap for brand fonts.

## Live Preview

[View live preview](https://d0psp7qc99vu3iziuank4-web.rork.live)
