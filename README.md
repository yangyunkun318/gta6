[![m](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?ref=zhc1s3ge)
[![m](https://make.fun/badge/gta6-01/yangyunkun318/gta6/rank.svg)](https://make.fun/bounty/gta6-01?ref=zhc1s3ge)
[![m](https://make.fun/badge/gta6-01/yangyunkun318/gta6/reward.svg)](https://make.fun/bounty/gta6-01?ref=zhc1s3ge)

# Solmar Bay

A 2D top-down open-world crime game in the spirit of GTA 6 — a sun-soaked fictional coastal city you explore on foot and by car. Steal cars, outrun the Solmar PD as your wanted stars climb, and run three story jobs for fixer Mama June: a pickup at the docks, a cherry-red Comet GT downtown, and one last getaway with the whole city on your tail.

- Open city: beach, downtown, docks, park — traffic, pedestrians, and police that respond to your wanted level
- On foot and driving: arcade car physics, carjacking, on-foot combat, health pickups
- HUD with a live minimap, wanted stars, cash, mission objective and distance
- Start screen, pause menu, and saves (localStorage) — progress and cash persist
- Synthesized WebAudio sound (engine, sirens, gunshots) — no audio files, no network requests

Play it locally with `node serve.ts`, then open http://localhost:8080. Pure static files under `game/`; `main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Built with make.fun: https://make.fun/r/zhc1s3ge
