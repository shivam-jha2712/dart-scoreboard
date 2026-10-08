# THROW — Darts, Baseball & THROW League

A fun responsive scoreboard for darts nights, with visual dartboard scoring, player avatars, Baseball Darts, rules, and live QR rooms.

## What's new in V3
- Tap the visual dartboard to enter each dart.
- Optional face photos / automatic initials avatars.
- 301 / 501 / 701 / custom darts games.
- Baseball Darts with 9 innings.
- Rules section.
- Live QR rooms using Firebase Realtime Database + anonymous authentication.
- Static-host friendly: deploy to Netlify or Vercel.

## Enable live QR rooms (one-time setup)
The scoring app itself is static, but live rooms need a small Firebase project.

1. Create a project at Firebase Console.
2. Add a **Web app** to the project.
3. Enable **Authentication → Sign-in method → Anonymous**.
4. Create **Realtime Database**.
5. In Realtime Database → Rules, paste the contents of `firebase-rules.json` and publish.
6. In Project settings → Your apps → Web app, copy the Firebase config into `firebase-config.js`.
7. Commit `firebase-config.js` to GitHub along with the other files.
8. Deploy the repository to Vercel or Netlify.

The Firebase browser config is not a secret. The database rules are what prevent viewers from writing to another host's room.

## Local run
Do not open `index.html` with `file://` when testing live rooms. Use a local HTTP server:

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`.

## Deployment
### Vercel
- Import the GitHub repository.
- Framework: Other.
- Build command: blank.
- Output directory: `.`.

### Netlify
- Import from Git.
- Build command: blank.
- Publish directory: `.`.

After deployment, open the HTTPS URL. The host creates a room and shows a QR code such as:

`https://your-site.vercel.app/?room=AB12C-9XYZ`

Friends scan it and become read-only live viewers. The host's score changes are written to the Firebase room and appear on connected phones.

## Player photos
Player photos are stored locally in the browser and are not uploaded to Firebase.


## THROW League setup

V4 adds persistent ratings, rankings, W/L records, streaks, badges and match history. The league uses the same Firebase project as live rooms.

### One-time Firebase configuration
1. Create/open a project in Firebase Console.
2. Add a Web App and copy its config into `firebase-config.js`.
3. Enable **Authentication → Sign-in method → Anonymous**.
4. Create **Realtime Database**.
5. Set the database rules from `firebase-rules.json`.
6. Deploy the project to Vercel or Netlify over HTTPS.

### League behavior
- Every player starts at **1000 Elo**.
- Completing a Darts or Baseball game updates that mode's rating and the overall rating.
- Wins/losses, win percentage, current streak and best streak are retained.
- The leaderboard has Overall / Darts / Baseball views.
- Match history is stored in Firebase so devices see the same league.
- The host should be the person entering scores; spectators can join the live room using the QR code.

### Recommended Firebase production hardening
The included rules are intentionally simple for a private friends' league. If you later make THROW public, add stronger authorization around league writes (for example, only a trusted game host can finalize a match) and consider Firebase App Check.
