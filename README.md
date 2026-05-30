# Our Little World

Our Little World is a private two-player virtual world for a boyfriend and girlfriend. It runs entirely in the browser with Vanilla JS, Phaser, Firebase Anonymous Auth, and Firebase Realtime Database, so it can be hosted directly on GitHub Pages.

## Features

- Two-player rooms with invite links and anonymous Firebase sign-in.
- Avatar selection, WASD movement, smooth partner interpolation, online/offline presence, and names above avatars.
- Large pixel-art world with trees, flowers, benches, lake, park, beach, a shared house, and a soft day/night cycle.
- Romantic actions: hearts, hug, kiss, hold hands, sit-together detection near benches, gifts, love meter, and anniversary counter.
- Private real-time chat with emoji support, timestamps, and typing indicator.
- Shared diary, memory gallery with image upload, shared home decoration, persistent furniture, synced ambient music, fullscreen, settings, and PWA support.

## Folder Structure

```text
project/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── game.js
│   ├── firebase.js
│   ├── multiplayer.js
│   ├── chat.js
│   ├── world.js
│   └── ui.js
├── assets/
│   ├── sprites/
│   ├── music/
│   └── images/
├── manifest.webmanifest
├── sw.js
├── README.md
└── firebase.rules.json
```

## Local Run

Because the app uses ES modules, serve it over HTTP:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Firebase Setup

1. Open the Firebase Console for `anonymousconfession-19707`.
2. Enable **Authentication > Sign-in method > Anonymous**.
3. Enable **Realtime Database**.
4. Open **Realtime Database > Rules** and deploy the contents of `firebase.rules.json`.
5. Use this data shape:

```text
rooms
└── roomId
    ├── players
    ├── chat
    ├── world
    ├── memories
    ├── gifts
    ├── diary
    └── settings
```

The included rules allow only authenticated room members to read or write room data, allow a new anonymous user to claim only their own player slot, enforce a maximum of two players per room, and validate the main write shapes.

## GitHub Pages Deployment

This project includes `.github/workflows/pages.yml`, so every push to `main` deploys automatically.

1. Push this folder to a GitHub repository.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to `GitHub Actions`.
4. Push to the `main` branch.
5. Open the **Actions** tab and wait for **Deploy GitHub Pages** to finish.

Invite links use `?room=ROOM-CODE`, for example:

```text
https://yourname.github.io/your-repo/?room=LOVE-AB12
```

## Notes

- Memory photos are compressed in the browser and stored as base64 strings in Realtime Database. For a larger production gallery, Firebase Storage would be a better long-term home for images.
- Phaser textures are generated at runtime, so the game does not require external sprite files.
- Background music is a lightweight Web Audio ambient tone so the project remains asset-free and GitHub Pages ready.
