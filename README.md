# Ring Toss

## Introduction / Summary

A carnival-style ring toss game designed for school field day environments. Players toss rings onto pegs using a skill-based power meter, with bonus incentives for stacking on their own rings. Supports 1–2 players with turn-based multiplayer.

## Key Features

### Core Gameplay

- **1–2 Players**: Solo mode or turn-based multiplayer.
- **Skill-Based Toss**: 5-section power meter — stop it in the center to land your ring.
- **3 Pegs**: Left, Center, Right — each holds up to 3 rings.
- **6 Rings Per Player**: Alternate turns until all rings are used.
- **20-Second Turn Timer**: Auto-miss if the player doesn't act in time.
- **Scoring**: +2 per landed ring, +1 stacking bonus for landing on your own color (2-player only).

### Canvas Integration

- **Peg Images**: Pre-rendered images update on canvas showing the ring stack (e.g., `peg_rb.png` = red then blue).
- **Missed Rings**: Dropped as assets near the target peg with positional scatter.
- **Player Teleportation**: Players are teleported to their mat positions on game start.
- **Reset Cleanup**: Ring assets are removed and pegs reset to empty on game reset.

### Badges (9 Total)

| Badge              | Condition                                                       |
| ------------------ | --------------------------------------------------------------- |
| Sharp Shooter      | Land 3 successful throws in a row                               |
| On Fire            | Hit all your throws in a single game                            |
| Stack Master       | Fill a peg entirely with your color                             |
| Piggyback Pro      | Stack on top of an opponent's ring (2-player)                   |
| Comeback Kid       | Win after being behind in score with your final toss (2-player) |
| All Miss, No Hit   | Miss every throw in a game                                      |
| Ring Toss Regular  | Play 10 games                                                   |
| Ring Rockstar      | Win 5 games (2-player)                                          |
| Field Day Champion | Win 15 games (2-player)                                         |

### Admin Features

- Admins can reset the game at any time via the Reset button.
- During an active game, only players or admins can reset.

## Required Assets with Unique Names

The app uses the following unique name patterns for managing dropped assets in the world:

| Unique Name                      | Description                                                 |
| -------------------------------- | ----------------------------------------------------------- |
| `RingToss_keyAsset`              | Ring Toss sign that when clicked opens the app in an iframe |
| `RingToss_mat_red`               | Red player's mat — teleport destination on game start       |
| `RingToss_mat_blue`              | Blue player's mat — teleport destination on game start      |
| `RingToss_peg_left`              | Left peg — layer1 image updated to show ring stack          |
| `RingToss_peg_center`            | Center peg — layer1 image updated to show ring stack        |
| `RingToss_peg_right`             | Right peg — layer1 image updated to show ring stack         |
| `RingToss_ring_{timestamp}_{id}` | Dropped ring assets (created on miss, deleted on reset)     |

### Peg Image Convention

Peg images are hosted at `https://sdk-ring-toss.s3.us-east-1.amazonaws.com/` and named by ring stack order:

- `peg_empty.png` — no rings
- `peg_r.png` — one red ring
- `peg_rb.png` — red then blue
- `peg_rrb.png` — red, red, blue
- All permutations up to 3 rings with `r` (red) and `b` (blue)

Ring assets: `ring_r.png`, `ring_b.png`

## Technical Architecture

### Data Objects

#### Key Asset (Dropped Asset)

The data object attached to the key asset (Ring Toss sign) stores the full game state:

```ts
{
  gameStatus: "waiting" | "in-progress" | "game-over";
  playerRed: { profileId, visitorId, displayName, interactiveNonce } | null;
  playerBlue: { profileId, visitorId, displayName, interactiveNonce } | null;
  currentTurn: "red" | "blue";
  pegs: { left: string[]; center: string[]; right: string[] }; // e.g. ["r", "b"]
  scores: { red: number; blue: number };
  ringsRemaining: { red: number; blue: number };
  consecutiveHits: { red: number; blue: number };
  totalHits: { red: number; blue: number };
  totalMisses: { red: number; blue: number };
  isSoloGame: boolean;
  winner: "red" | "blue" | "tie" | null;
}
```

#### Visitor

Visitor data is scoped by `${urlSlug}-${sceneDropId}` and tracks per-player stats for badge eligibility:

```ts
{
  gamesPlayed: number;
  gamesWon: number;
}
```

### Analytics

| Event           | Unique Key              |
| --------------- | ----------------------- |
| `joins`         | profileId               |
| `starts1player` | profileId               |
| `starts2player` | profileId (each player) |
| `completions`   | profileId (each player) |
| `resets`        | —                       |

## API Endpoints

| Method | Path              | Purpose                                                        |
| ------ | ----------------- | -------------------------------------------------------------- |
| GET    | `/api/game-state` | Load game state, badges, admin check, track joins              |
| PUT    | `/api/join`       | Join as Red or Blue player                                     |
| PUT    | `/api/start`      | Start game, teleport players to mats                           |
| PUT    | `/api/toss`       | Execute toss (body: `{ peg, hit }`), awards badges on game end |
| PUT    | `/api/end-game`   | End game early, calculate winner, award badges                 |
| PUT    | `/api/reset`      | Clear board, reset peg images, remove ring assets              |

## Environment Variables

Create a `.env` file in the root directory. See `.env-example` for a template.

| Variable             | Description                                      | Required |
| -------------------- | ------------------------------------------------ | -------- |
| `INSTANCE_DOMAIN`    | Topia API domain (`api.topia.io` for production) | Yes      |
| `INSTANCE_PROTOCOL`  | Protocol (`https`)                               | Yes      |
| `INTERACTIVE_KEY`    | Topia interactive app key                        | Yes      |
| `INTERACTIVE_SECRET` | Topia interactive app secret                     | Yes      |

## For Developers

### Built With

#### Client

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

#### Server

![Node.js](https://img.shields.io/badge/node.js-%2343853D.svg?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/express-%23000000.svg?style=for-the-badge&logo=express&logoColor=white)

### Getting Started

1. **Clone the repository and install dependencies**

```bash
npm install
```

2. **Configure environment variables**

   See [Environment Variables](#environment-variables) above.

3. **Run in development**

```bash
npm run dev
```

### Where to find INTERACTIVE_KEY and INTERACTIVE_SECRET

[Topia Dev Account Dashboard](https://dev.topia.io/t/dashboard/integrations)

[Topia Production Account Dashboard](https://topia.io/t/dashboard/integrations)

### Resources

- [SDK Developer Documentation](https://metaversecloud-com.github.io/mc-sdk-js/index.html)
- [Topia Interactive Apps Overview](https://topia.io/developers)
