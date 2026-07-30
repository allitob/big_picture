# Big Picture tracker — setup

A single HTML file. No build step. Syncs across devices via Firebase (free tier).

## 1. Create a Firebase project (5 min)

1. Go to https://console.firebase.google.com and click **Add project**. Name it anything (e.g. `big-picture`). You can skip Google Analytics.
2. Once created, click the **web icon (`</>`)** on the project overview page to register a web app. Name it anything, skip Firebase Hosting.
3. You'll be shown a `firebaseConfig` object with keys like `apiKey`, `authDomain`, etc. Copy it.
4. In `index.html`, find this block near the top of the `<script>` tag and replace it with your copied values:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## 2. Enable Firestore

1. In the Firebase console, left sidebar → **Build → Firestore Database → Create database**.
2. Choose **production mode**, pick any region (e.g. `eur3` for Europe).

## 3. Enable Anonymous auth

1. Left sidebar → **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Anonymous**.

This is what makes it work without a login screen: anonymous auth just proves "this is a request from the app," not "this is a specific person." Every device that signs in anonymously gets its own throwaway UID, but the app doesn't use that UID as the document ID — see "Sync ID" below.

## 4. Lock down Firestore rules (important — do this)

By default, "production mode" blocks all reads/writes, which will break the app. Go to **Firestore Database → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bigpicture/{docId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Click **Publish**. This means anyone with a valid (anonymous) auth session can read/write any document under `bigpicture/`. That's fine because the real protection is that nobody can guess your document ID (see below) — not the auth rule itself.

## 5. Sync ID (cross-device sync, kept out of the public repo)

The GitHub repo for this app is **public** (GitHub Pages requires that on a free plan), so nothing hardcoded in `index.html` is private. Instead, the app asks each device once for a **sync ID** — a private string of your choosing — and stores it in that browser's `localStorage`. Every device using the same sync ID reads and writes the same Firestore document; that string, not the Firebase project or the code, is what keeps your data private.

- On first load on a new device, you'll see a "Connect" screen asking for the sync ID. Pick any long, unguessable string (a password generator's output works well) the first time, then reuse the exact same string on every other device.
- To find your existing sync ID again, or switch to a different one, use the **"change sync ID"** link at the bottom of the app.
- Don't commit your sync ID to the repo, and don't share the deployed URL publicly — the sync ID is the only thing standing between your data and anyone with an anonymous Firebase session.

## 6. Deploy via GitHub Pages

1. Create a new GitHub repo (it must be **public** on the free plan for Pages to work).
2. Push `index.html`, `README.md`, and `.gitignore` to it.
3. Repo → **Settings → Pages** → Source: deploy from `main` branch, root folder.
4. GitHub gives you a URL like `https://yourusername.github.io/reponame/`. Open that on your phone and laptop and enter your sync ID on each.
5. On your phone, open it in Safari/Chrome and use **Add to Home Screen** so it opens full-screen like an app.

## Notes

- Nobody can find or guess your Firestore document without your sync ID — but it isn't password-protected beyond that, and the source code (minus your sync ID) is publicly visible on GitHub. Don't post the GitHub Pages URL or your sync ID anywhere public.
- All your data lives in Firestore's free tier (plenty for this use case — thousands of reads/writes/month free).
- If you ever want to nuke everything, delete the Firestore document from the Firebase console, or just delete the project.
