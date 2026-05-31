# Our Little World 3D

Our Little World 3D is a private two-player cozy virtual world built with Three.js, Firebase Anonymous Authentication, and Firebase Realtime Database. It is a static ES Modules app, so it runs directly on GitHub Pages with Firebase as the only backend.

## Features

- Two-player rooms with invite links, anonymous sign-in, online/offline presence, and Firebase sync.
- Three.js third-person world with forest, flower gardens, lake, waterfall, beach, mountain viewpoint, park, café, shared house, stars, fog, weather, and day/night lighting.
- Chase mini-game mode: random police/thief role assignment, countdown, and catch-win logic.
- 3D stylized avatars with idle/walk/run-style limb motion and action poses for hugs, kisses, hand holding, gifts, and hearts.
- Third-person camera with smooth follow, mouse/touch look, wheel zoom, and mobile joystick.
- Real-time chat with emoji support, typing indicator, message history, chat bubbles above characters, and browser voice messages.
- Shared house decoration, wall colors, gifts, diary, anniversary counter, love meter, and memory gallery.
- PWA support, Android/Desktop installability, offline app shell, GitHub Actions deployment, and GLTF/GLB loader support in `js/world.js`.

## Folder Structure

```text
project/
├── .github/workflows/pages.yml
├── index.html
├── css/style.css
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
├── firebase.rules.json
└── README.md
```

## Local Run

Serve over HTTP because the app uses browser ES modules:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Firebase Setup

1. Open Firebase Console for `anonymousconfession-19707`.
2. Enable **Authentication > Sign-in method > Anonymous**.
3. Enable **Realtime Database**.
4. Paste and publish the contents of `firebase.rules.json` in **Realtime Database > Rules**.

Database shape:

```text
rooms
└── roomId
    ├── players
    ├── chat
    ├── memories
    ├── house
    ├── gifts
    ├── diary
    ├── settings
    └── worldState
```

The rules restrict room reads/writes to room members, use two fixed player slots for the two-player limit, and validate chat, memories, gifts, diary, house furniture, wall color, weather, and settings writes.

## GitHub Pages Deployment

This project includes `.github/workflows/pages.yml`, so every push to `main` deploys automatically.

1. Push the project to GitHub.
2. Go to **Settings > Pages**.
3. Set **Build and deployment > Source** to `GitHub Actions`.
4. Push to `main`.
5. Wait for **Actions > Deploy GitHub Pages** to complete.

Invite links use:

```text
https://yourname.github.io/your-repo/?room=LOVE-AB12
```

## Notes

- GLTF/GLB support is included through `GLTFLoader`; place optimized models in `assets/models/` and load them from `js/world.js`.
- Uploaded photos and voice messages are compressed/base64 and stored in Realtime Database for a small private app. For larger production use, move media to Firebase Storage.
- The renderer targets lightweight geometry, frustum culling defaults, shared materials, and lazy browser-loaded CDN modules for GitHub Pages compatibility.
