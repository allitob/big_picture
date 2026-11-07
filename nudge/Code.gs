/**
 * Big Picture — inactivity nudge
 *
 * Runs on a daily time-driven trigger (set up in the Apps Script UI, not in
 * code). Reads the Firestore document directly via a service account, which
 * bypasses the app's Firestore security rules (those only govern client SDK
 * requests) — access here is controlled by the service account's IAM role
 * instead. Emails you once per inactivity stretch, not every day.
 *
 * Required Script Properties (Project Settings -> Script Properties):
 *   SERVICE_ACCOUNT_JSON  - full contents of the service account's JSON key
 *   PROJECT_ID            - Firebase project ID, e.g. big-picture-8bd64
 *   DOC_ID                - your private sync ID (same one used in the app)
 *   APP_URL               - the deployed app URL (optional, has a fallback)
 *   NOTIFY_EMAIL           - where to send the nudge (optional, defaults to
 *                             the script owner's account)
 */

function checkInactivity(force) {
  var props = PropertiesService.getScriptProperties();
  var token = getAccessToken_(props);
  var projectId = props.getProperty('PROJECT_ID');
  var docId = props.getProperty('DOC_ID');
  var url = 'https://firestore.googleapis.com/v1/projects/' + projectId +
    '/databases/(default)/documents/bigpicture/' + docId;

  var res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    Logger.log('Firestore fetch failed: ' + res.getResponseCode() + ' ' + res.getContentText());
    return;
  }

  var doc = JSON.parse(res.getContentText());
  var data = decodeFields_(doc.fields || {});
  // Soft-deleted entries (v2) don't count as activity.
  var log = (data.log || []).filter(function (l) { return !l.deleted; });
  if (!log.length) return;

  var latest = log.reduce(function (a, b) {
    return new Date(a.date) > new Date(b.date) ? a : b;
  });
  var daysSince = Math.floor((Date.now() - new Date(latest.date).getTime()) / 86400000);

  if (!force && daysSince < 2) return;

  var lastNudgedFor = props.getProperty('LAST_NUDGED_LOG_DATE');
  if (!force && lastNudgedFor === latest.date) return; // already nudged for this stretch

  var appUrl = props.getProperty('APP_URL') || 'https://allitob.github.io/big_picture/';
  var to = props.getProperty('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail();
  GmailApp.sendEmail(
    to,
    'Big Picture: ' + daysSince + ' day' + (daysSince === 1 ? '' : 's') + ' since your last entry',
    "It's been " + daysSince + " days since you last logged anything.\n\nQuick check-in: " + appUrl
  );
  props.setProperty('LAST_NUDGED_LOG_DATE', latest.date);
}

// Manual test hook — sends immediately regardless of days-since or debounce,
// without touching the real debounce state used by the scheduled run.
function testNudge() {
  checkInactivity(true);
}

function getAccessToken_(props) {
  var serviceAccount = JSON.parse(props.getProperty('SERVICE_ACCOUNT_JSON'));
  var header = { alg: 'RS256', typ: 'JWT' };
  var now = Math.floor(Date.now() / 1000);
  var claimSet = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  function b64(obj) {
    return Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
  }

  var toSign = b64(header) + '.' + b64(claimSet);
  var sigBytes = Utilities.computeRsaSha256Signature(toSign, serviceAccount.private_key);
  var signature = Utilities.base64EncodeWebSafe(sigBytes).replace(/=+$/, '');
  var jwt = toSign + '.' + signature;

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    },
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText());
  if (!body.access_token) throw new Error('Token exchange failed: ' + res.getContentText());
  return body.access_token;
}

// Firestore's REST API returns typed values ({stringValue: "..."} etc);
// these decode that into a plain JS object/array matching what the app sees.
function decodeValue_(v) {
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue !== undefined) return (v.arrayValue.values || []).map(decodeValue_);
  if (v.mapValue !== undefined) return decodeFields_(v.mapValue.fields || {});
  return null;
}

function decodeFields_(fields) {
  var obj = {};
  Object.keys(fields).forEach(function (k) { obj[k] = decodeValue_(fields[k]); });
  return obj;
}
