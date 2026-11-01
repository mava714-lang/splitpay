// Show or publish the Realtime Database security rules using a service account.
//   node scripts/firebase-rules.mjs show     → prints the rules currently published
//   node scripts/firebase-rules.mjs deploy   → prints current rules (backup), then publishes database.rules.json
// Auth: GOOGLE_APPLICATION_CREDENTIALS (service account with "Firebase Realtime Database Admin").
import { GoogleAuth } from 'google-auth-library';
import { readFileSync } from 'node:fs';

const DB_URL = process.env.FIREBASE_DB_URL || 'https://splitpay01-default-rtdb.firebaseio.com';
const mode = process.argv[2] || 'show';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/firebase.database', 'https://www.googleapis.com/auth/userinfo.email'] });
const token = await auth.getAccessToken();
const url = `${DB_URL}/.settings/rules.json`;
const headers = { Authorization: `Bearer ${token}` };

const cur = await fetch(url, { headers });
if (!cur.ok) { console.error(`Could not read current rules: ${cur.status} ${await cur.text()}`); process.exit(1); }
console.log('===== CURRENT PUBLISHED RULES (backup) =====');
console.log(await cur.text());

if (mode === 'deploy') {
  const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');
  JSON.parse(rules); // fail early on invalid JSON
  const res = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: rules });
  const body = await res.text();
  if (!res.ok) { console.error(`Deploy failed: ${res.status} ${body}`); process.exit(1); }
  console.log('===== PUBLISHED database.rules.json =====');
  console.log(body);
}
