# Project Implementation Plan Template

Read `.ai/rules.md` first before starting implementation.

## 1 Overview

---

Ring Toss is a lightweight, turn-based (when multiplayer) carnival-style game designed for school field day environments. Players toss rings onto pegs to score points, with bonus incentives for stacking on their own rings.

## 2 Core Gameplay

---

- Supports **1–2 players**
- Gameplay modes:
  - **Solo mode** (player starts alone)
  - **Turn-based multiplayer** (if second player joins)

## 3 Player Flow

---

1.  Player clicks a **key asset** to open the app
2.  First user to click is assigned to Red player (player 1). Second to click, if game is not in progress, is assigned to Blue player. If game is in progress any non-player user is given a screen letting them know a game is currently in progress.

- First player is presented with text prompting them to wait for a second player to join or button that says Start Solo Game
- Once second player joins the text is removed and button text changes to Start Game

3.  On start Players are **teleported to their mat positions** and the game begins found by unique name ("RingToss_mat_red" or "RingToss_mat_blue"). See topia-sdk-apps/sdk-race/server/controllers/handleSwitchTrack.ts line 23 - 27 as ann example, we can use this to find mats, pegs, and all other relevant assets by sceneDropId and unique names

4.  If game is in progress, Start button becomes End Game button which an active player can click to end the game early

## 4 Turn System

---

- Only **one player acts at a time**
- First player to join goes first
- Players are given 6 rings each and alternate turns until all rings are used
- UI shows:
  - Active player
  - Turn state

## 5 Board Setup

---

- **3 pegs total** (Left, Center, Right)
- Each peg:
  - Has **equal scoring value**
  - Can hold a maximum of **3 rings**

## 6 Ring System

---

- Each player has a **fixed number of rings** (# of pegs \ 2 per player so 6 for v1)
- Rings are:
  - Red (Player 1)
  - Blue (Player 2)

- When all rings are used → game ends

## 7 Toss Mechanic

---

### Flow

1.  Player selects a **target peg** (Left / Center / Right) in drawer
2.  A **power meter** moves back and forth with five sections
3.  Player clicks to stop the meter

### Outcome

- If timing is correct and player stops the meter in the middle section:
  - Ring lands on the selected peg (if peg is not full)

- If timing is incorrect:
  - Ring **misses** and lands near the peg (position is scattered so that not all misses land in the same spot)

- A timer should countdown from 10 and if the player doesn't click within the alloted time then turn ends and results in a miss

### Important Constraints

- No physics simulation
- On success peg asset found by unique name ("RingToss_peg_left", "RingToss_peg_center", "RingToss_peg_right") layer1 is updated via droppedAsset.updateWebImageLayers (see .ai/examples/handleUpdateDroppedAsset.md line 48). Images are located in S3 bucket https://sdk-ring-toss.s3.us-east-1.amazonaws.com and are named as follows:

* peg_empty.png
* peg_r.png
* peg_b.png
* peg_rr.png
* peg_rb.png
* and so on where r = red ring and b = blue ring so peg_rr.png = peg with two red rings, peg_brb.png = peg with blue then red then blue ring, etc.

- Randomness only applies to **missed throws (scatter position)**, Rings assets are dropped on ground immediately
- Successful throws are **fully skill-based**

## 8 Peg Behavior

---

- Each peg can hold **up to 3 rings**
- If a peg is full:
  - Additional throws **cannot land**
  - Even accurate throws result in a **miss**

## 9 Scoring System

---

### Base Scoring

- Each successful ring on a peg = **2 point**

### Bonus Scoring

- Player earns **1 bonus point for stacking on their own rings**

#### Example:

- If a player lands a ring on top of their own color:
  - Additional **+1 bonus point**

### Total Points per Turn

- Base: +2
- Bonus (if applicable): 1

## 10 Game End Conditions

---

- Game ends when:
  - All players have used all their rings
  - OR, all players have used all their rings

- Players are presented a Game Over screen that displays final scores and celebrates wining user

### Winner Determination

- Player with highest score wins
- **Ties are allowed**

## 11 Visual System

---

### Peg Rendering

- Peg states are represented via **pre-rendered images**
- Each peg supports all combinations of:
  - 0–3 rings
  - Red/Blue order preserved

### Misses

- Missed rings appear near peg using slight positional randomness

## 12 UI Elements

---

### Canvas

- Ring Toss sign as key asset for start/reset
- 3 pegs
- Player mats (Red / Blue)
- Rings on pegs scattered rings

### Drawer

- Toss button
- Peg selection (Left / Center / Right)
- Power meter

## 13 Reset Logic

---

- A Reset button is displayed below the Start button and can be seen by all users at all times

- If no game in progress:
  - Any user can reset

- If game in progress:
  - Only active players or admin can reset

- Reset:
  - Clears board (resets peg assets to https://sdk-ring-toss.s3.us-east-1.amazonaws.com/peg_empty.png and picks up all ring assets from canvas)
  - Resets scores
  - Returns to join state

## 14 Analytics

---

Track:

- joins (when any user opens the app): uniqueKey = profileId
- starts1player: uniqueKey = profileId
- starts2player: uniqueKey = profileId (for each player)
- completions: uniqueKey = profileId (for each player)
- resets

## 15 Badges

---

- **Sharp Shooter** Land 3 successful throws in a row
- **On Fire** Hit all your throws in a single game
- **Stack Master** Fill a peg entirely with your color
- **Piggyback Pro** Stack on top of an opponent’s ring (must be 2 player game)
- **Comeback Kid** Win after being behind in score with your final toss (must be 2 player game)
- **All Miss, No Hit** Miss every throw in a game
- **Ring Toss Regular** Play 10 games
- **Ring Rockstar** Win 5 games (must be 2 player games)
- **Field Day Champion** Win 15 games (must be 2 player games)

## Validation Checklist

Before submitting the implementation, verify:

- [ ] All user stories are implemented according to acceptance criteria
- [ ] All typography uses SDK classes
- [ ] All imports use aliased paths, not relative paths
- [ ] Error handling uses GlobalContext
- [ ] Component structure follows the pattern in `.ai/examples/page.md`
- [ ] All API endpoints follow the established pattern and error handling
- [ ] Tests are included for all new functionality

## Post-Implementation Finalization

After the app is implemented, these steps MUST be completed before the app is considered done:

### Remove Unused Boilerplate Code

The boilerplate ships with example utilities, components, and types that may not be used by the new app. Scan for and remove:

- **Server utils**: Check `server/utils/` for unused files (e.g., `droppedAssets/`, `getBaseUrl.ts`). Trace imports from controllers — if a util is not imported anywhere, remove it.
- **Server types**: Check `server/types/` for unused type files (e.g., `DroppedAssetTypes.ts`). Remove types that are no longer referenced.
- **Client components**: Check `client/src/components/` for unused boilerplate components (e.g., `Accordion.tsx`, `AdminView.tsx`, `AdminIconButton.tsx`, `ConfirmationModal.tsx`, `PageFooter.tsx`). Trace imports from pages — if a component is not imported anywhere, remove it.
- **Barrel exports**: Update `server/utils/index.ts`, `server/types/index.ts`, and `client/src/components/index.ts` to remove exports of deleted files.

**Protected files** (`PageContainer.tsx`, `backendAPI.ts`, etc.) must NOT be removed even if they appear unused — they are part of the framework.

### Update README

Rewrite `README.md` to describe the new app instead of the boilerplate. Include:

- App name and description
- What visitors see vs. what admins see
- Key features
- API endpoints with request/response shapes
- Data object schemas
- Setup and development instructions

### Update Server Tests

Rewrite `server/tests/routes.test.ts` to test the new app's actual routes:

- Update the `jest.mock("../utils/index.js")` block to mock the new app's utils (not boilerplate ones like `getDroppedAsset`)
- Update `server/mocks/@rtsdk/topia.ts` to include any new SDK factories/methods used (e.g., `EcosystemFactory`, `WorldActivityFactory`)
- Add test cases for each route covering: success paths, error handling, authorization checks, input validation
- Remove any tests for removed boilerplate routes
