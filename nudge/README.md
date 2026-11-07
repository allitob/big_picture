# Inactivity nudge — setup

Sends you an email if you go 2+ workdays without a log entry (weekends don't count, and it never emails on Sat/Sun), even when the app isn't open. Runs as a free Google Apps Script on a daily timer — no server, no Firebase upgrade needed.

It reads Firestore via a **service account** rather than the app's anonymous-auth flow, so it bypasses the app's Firestore security rules entirely (that's normal — rules only govern client SDK access; a service account's own IAM role governs this). Nothing here needs your sync ID or service account key to be public — both live in Apps Script's private Script Properties, not in this file.

## 1. Create a service account (5 min)

1. Go to [console.cloud.google.com/iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts) with your Firebase project selected (top-left project picker → `big-picture-8bd64`).
2. **Create service account** → name it anything (e.g. `nudge-reader`) → **Create and continue**.
3. Grant it the role **Cloud Datastore User** → **Continue** → **Done**.
4. Click into the new service account → **Keys** tab → **Add key → Create new key → JSON** → this downloads a `.json` file. Keep it private — it's a real credential.

## 2. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Rename it (top-left) to something like `Big Picture Nudge`.
3. Delete the placeholder code and paste in the contents of [`Code.gs`](Code.gs) from this folder.
4. **Project Settings** (gear icon, left sidebar) → **Script Properties** → add:
   - `SERVICE_ACCOUNT_JSON` — paste the *entire contents* of the JSON key file from step 1.
   - `PROJECT_ID` — `big-picture-8bd64`
   - `DOC_ID` — your private sync ID (same one you type into the app).
   - `APP_URL` — your GitHub Pages URL, e.g. `https://allitob.github.io/big_picture/` (optional, has a fallback).
   - `NOTIFY_EMAIL` — where to send the nudge (optional; defaults to your own Google account's address).

## 3. Authorize and test

1. Back in the editor, select the `testNudge` function from the dropdown next to **Run**, then click **Run**.
2. The first run prompts an OAuth consent screen (it's your own script, on your own account) — click through **Advanced → Go to Big Picture Nudge (unsafe)** and allow it. "Unsafe" here just means Google hasn't reviewed this personal script; it's not been shared with anyone.
3. `testNudge` ignores the day threshold and debounce, so it emails you immediately if you have any log entries at all — use it to confirm the whole pipeline (service account auth → Firestore read → email) works.
4. Check your inbox (and spam folder, just in case) for the email.

## 4. Schedule it

1. **Triggers** (clock icon, left sidebar) → **Add Trigger**.
2. Function: `checkInactivity`. Event source: **Time-driven**. Type: **Day timer**, pick a time window (e.g. 9am–10am).
3. **Save**.

From now on, if you go 2+ workdays without logging anything, you'll get one email — not a daily repeat — until you log something new, at which point the cycle resets.

## Notes

- Nothing secret is in `Code.gs` itself — the service account key, project ID, and sync ID all live in Script Properties, which stay private to your Google account and are never pushed anywhere.
- If you ever change your sync ID, update the `DOC_ID` script property to match.
- To change the inactivity threshold (currently 2 workdays) or stop it entirely, edit the script or delete the trigger.
