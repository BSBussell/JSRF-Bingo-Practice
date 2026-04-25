# JSRF Bingo Trainer

JSRF Bingo Trainer is a Vite + React frontend with a simple Tauri desktop shell. The frontend stays browser-runnable, but the project is structured so Tauri can be the primary desktop target for global hotkeys!

## What is included

- A drill mode that give you objectives while tracking game state.
- Weighted drill generation that enables custom practice routines and seeded drills.
- A learn mode that shows video demonstrations of each objective.    
- Local persistence for settings, active session restore, history, best times, and aggregate stats


## Community Resources
This project was made much easier by resources shared by the JSRF Bingo community:

- [Naestrinus' Bingopedia playlist](https://www.youtube.com/playlist?list=PLDHncjR554MyBVGa7Z9WUU-fIC5d_BFrT), which helped provide comprehensive learn videos for the game's objectives.
- [Crabbi's Graffiti Route playlist](https://www.youtube.com/playlist?list=PLrqAmeXg8tekWV7QHQb5T3c8TbYxwb-ot), which also helped fill out learn resources for objectives.
- Crabbi's Board Generator code, which provided a reference for the existing game squares.

Thanks to the community that developed these resources and made building this tool much easier!!!


## Web development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Refresh learn-video data when the source playlists change:

   ```bash
   npm run learn-videos:generate
   ```

   This uses `yt-dlp` from your PATH to read playlist metadata only. The runtime
   app does not fetch YouTube metadata, does not use API keys, and only consumes
   `src/data/generated/learningVideoLibrary.json`.

3. Start the Vite dev server:

   ```bash
   npm run dev
   ```

4. Build the browser app:

   ```bash
   npm run build
   ```

## Learn video manifest

Learn videos are manifest-first. `scripts/generate-learning-video-manifest.mjs`
uses `yt-dlp` to ingest the community playlists and writes the generated runtime
manifest to `src/data/generated/learningVideoLibrary.json`. The generated
manifest owns square guides, tape guides, area misc. tech videos, and
unrecognized misc. tech entries.

Some unconventional playlist titles are matched through non-runtime title aliases
in `scripts/data/learning-video-title-aliases.json`. These aliases are generator
input only and should not include video IDs.

## Tauri desktop development

Make sure Rust is installed and that your machine has the standard [Tauri system prerequisites](https://tauri.app/start/prerequisites/) for your OS.

1. Install the project dependencies:

   ```bash
   npm install
   ```

2. Start the desktop app in development:

   ```bash
   npm run tauri:dev
   ```

3. Build a desktop bundle:

   ```bash
   npm run tauri:build
   ```

## Persistence notes

All persistence currently lives in `localStorage` under the `jsrf-bingo-trainer` key. That includes:

- Most recent starting area
- Active drill session state
- Session history
- Best times per objective
- Aggregate completion stats by area and by type
