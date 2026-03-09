# 🏢 Office Buddy

A cross-platform 2.5D isometric office companion game built with **Electron**, **Phaser 3**, and **Socket.IO**.

## Features

| Feature | Details |
|---|---|
| **2.5D Isometric Office** | Hand-drawn isometric tiles, walls, and furniture using Phaser Graphics |
| **Anime Companion** | Animated character that idles or "works" based on your keyboard/mouse activity |
| **Multiplayer** | Create a room or join with a code – see co-workers in real time |
| **Extensible Furniture** | Add new items to `data/furniture.json` with no code changes required |
| **Cross-Platform** | Runs on macOS and Windows via Electron |

## Quick Start

```bash
# Install dependencies
npm install

# Run (starts the Socket.IO server + Electron in parallel)
npm run dev
```

Or run them separately:

```bash
# Terminal 1 – multiplayer server
npm run server

# Terminal 2 – desktop app
npm start
```

## Multiplayer

1. Player A clicks **Enter Office** without entering a room code → a new room is created and the code is shown in the top-left corner.
2. Player B enters the room code shown by Player A and clicks **Enter Office** → joins the same room.
3. Both players see each other's animated characters and activity state.

## Extending Furniture

Open `data/furniture.json` and add a new object:

```json
{
  "id": "my-fridge",
  "type": "cabinet",
  "label": "Office Fridge",
  "isoX": 8,
  "isoY": 2,
  "color": "#AADDEE",
  "topColor": "#CCEEFF",
  "width": 1,
  "depth": 1,
  "height": 2
}
```

Restart the app to see the new item. For fully custom shapes, register a renderer in `FurnitureManager.js`:

```js
furnitureManager.addRenderer('my-fridge', (graphics, def, iso) => {
  // custom Phaser Graphics drawing here
});
```

## Building for Distribution

```bash
# macOS (dmg)
npm run dist:mac

# Windows (installer)
npm run dist:win

# Both
npm run dist
```

Output goes to the `dist/` folder.

## Testing

```bash
npm test
```

Tests cover: isometric coordinate math, server room management, and furniture JSON validation.

## Project Structure

```
├── main.js               Electron main process
├── preload.js            Secure IPC bridge
├── server.js             Socket.IO multiplayer server
├── data/
│   └── furniture.json    Extensible furniture definitions
├── renderer/
│   ├── index.html
│   ├── styles.css
│   └── game/
│       ├── main.js             Phaser game config
│       ├── scenes/
│       │   ├── MenuScene.js    Main menu (name, colour, room code)
│       │   └── OfficeScene.js  2.5D office room + multiplayer
│       └── objects/
│           ├── IsoHelper.js         Isometric <-> screen coordinate math
│           ├── AnimeCharacter.js    Animated companion character
│           └── FurnitureManager.js  Extensible furniture renderer
└── tests/
    └── game.test.js
```
