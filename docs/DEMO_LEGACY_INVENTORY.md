# Demo / legacy inventory — Phase B

The stabilization line intentionally starts from a clean Next.js shell. Historical implementations remain preserved on branches/repositories; they are not copied into the active staging source unless explicitly reviewed.

## Removed from active Staging experience

| Historical/demo element | Staging treatment |
|---|---|
| `Sofía Martínez` fictitious identity | Removed; UI says `Cuenta de prueba` until Auth/backend identity exists |
| fictitious group `8° B` | Removed |
| `127` mastered words | Removed; primary metric renders `—` until backend supplies it |
| fake XP (`2180` / `2.180`) | Removed |
| fake coins (`1240` / `1.240`) | Removed |
| fake 7-day streak / level 12 | Removed |
| hardcoded leaderboard/classmates | Removed from active UI |
| weekly missions presented as real | Removed from active UI |
| locally authoritative academic progress | Not implemented in stabilization shell |
| Avatar Studio / 128-item store | Not active; explicitly deferred/legacy |
| avatar coins/purchases/loadout | Not active |
| demo curriculum generated in browser | Not active |
| demo mastery/ranking calculations in React | Not active |

## Preserved, not deleted

- Git branch `legacy/static-20260819` preserves the pre-stabilization static repository head.
- Historical Vercel production project/deployment remains untouched.
- `oalejandro2191-ai/ens-english-rebuild` remains a separate technical-reference family and is not merged automatically.
- Supabase historical migrations/data are untouched during Phase B.

## Active Staging rule

A backend-dependent screen must show an explicit pending/unavailable state rather than silently falling back to demo statistics. Academic values become visible only after an authenticated, authorized backend response is wired in Phase G.
