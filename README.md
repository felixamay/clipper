# clipper

International draughts on a 10×10 board, played under a tree.

Men step one square diagonally forward and capture one square diagonally, forward or backward. Kings are flying kings. A capture is mandatory, and if several captures are possible the line that takes the most pieces is the one that must be played. A man promotes to a king only when it ends its turn on the far rank. The game is drawn when the same position occurs three times, or when each side has made 25 moves with no capture and no promotion.

The players are rigged 3D people who sit in chairs at either end of a wooden table under a big shade tree. They breathe and follow the board with their eyes, and each move is a live reach: the player leans in and pushes the piece with the index finger of whichever hand is nearer, wherever it is. See `tools/players/` for how they are built. Players take their time: forced moves come quickly, opening moves fairly quickly, and busy middlegame positions can take them half a minute at the slow pace. The pace buttons during a match switch between slow, normal and fast.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints. It is usually http://localhost:5173.

If you open the game through a forwarded or preview address instead of localhost, Vite will answer "Blocked request. This host is not allowed." Put that hostname in a `.env.local` file next to `package.json` and restart `npm run dev`:

```bash
CLIPPER_ALLOWED_HOSTS=my-box-5173.example.dev
```

## Test

```bash
npm test
```
