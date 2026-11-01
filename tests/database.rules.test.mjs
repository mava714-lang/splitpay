// Security-rules tests for database.rules.json (Firebase Realtime Database emulator).
// Run from the repo root (requires Java):
//   npm i --no-save firebase-tools@13 @firebase/rules-unit-testing@3
//   npx firebase emulators:exec --project splitpay-rules-test --only database "node tests/database.rules.test.mjs"
// Every change to database.rules.json should keep all these tests passing.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { ref, set, get, remove, update } from 'firebase/database';
import { readFileSync } from 'node:fs';
const env = await initializeTestEnvironment({ projectId: 'splitpay-rules-test', database: { host: '127.0.0.1', port: 9000, rules: readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8') } });
let fails = 0;
const t = async (name, p) => { try { await p; console.log('PASS', name); } catch (e) { fails++; console.log('FAIL', name, '-', e.message.split('\n')[0]); } };
const anon = env.unauthenticatedContext().database();
const owner = env.authenticatedContext('uOwner').database();
const other = env.authenticatedContext('uOther').database();
const room = (extra = {}) => ({ items: [{ id: 'I1', name: 'Pizza', qty: 2, unitPrice: 10000 }], people: [{ id: 'P1', name: 'Ana', avatar: 'x' }], tipPercent: 10, createdAt: 1, ...extra });

// rooms
await t('anon creates room without owner', assertSucceeds(set(ref(anon, 'rooms/AAA'), room())));
await t('anon cannot create room claiming someone as owner', assertFails(set(ref(anon, 'rooms/BBB'), room({ ownerUid: 'uOwner' }))));
await t('user creates room owned by self', assertSucceeds(set(ref(owner, 'rooms/OWN'), room({ ownerUid: 'uOwner' }))));
await t('user cannot create room owned by another uid', assertFails(set(ref(other, 'rooms/CCC'), room({ ownerUid: 'uOwner' }))));
await t('anyone reads a single room', assertSucceeds(get(ref(anon, 'rooms/OWN'))));
await t('nobody can list all rooms', assertFails(get(ref(anon, 'rooms'))));
await t('anon submits claim in owned room', assertSucceeds(set(ref(anon, 'rooms/OWN/claims/P1'), { items: { I1: 1 }, confirmedAt: 2 })));
await t('anon rewrites whole owned room keeping owner (updateRoom)', assertSucceeds(set(ref(anon, 'rooms/OWN'), room({ ownerUid: 'uOwner', tipPercent: 15 }))));
await t('anon cannot change owner', assertFails(set(ref(anon, 'rooms/OWN/ownerUid'), 'hacker')));
await t('other user cannot take ownership', assertFails(set(ref(other, 'rooms/OWN/ownerUid'), 'uOther')));
await t('anon cannot drop owner via whole-room set', assertFails(set(ref(anon, 'rooms/OWN'), room())));
await t('anon cannot delete owner field', assertFails(remove(ref(anon, 'rooms/OWN/ownerUid'))));
await t('anon cannot delete a room', assertFails(remove(ref(anon, 'rooms/OWN'))));
await t('anon can delete a claim', assertSucceeds(remove(ref(anon, 'rooms/OWN/claims/P1'))));
await t('creator claims unowned room after login', assertSucceeds(set(ref(owner, 'rooms/AAA/ownerUid'), 'uOwner')));
await t('second user cannot re-claim', assertFails(set(ref(other, 'rooms/AAA/ownerUid'), 'uOther')));
await t('anon cannot claim ownership', assertFails(set(ref(anon, 'rooms/ZZZ'), room()).then(() => set(ref(anon, 'rooms/ZZZ/ownerUid'), 'x'))));
// paid
await t('mark paid', assertSucceeds(set(ref(anon, 'rooms/OWN/paid/P1'), { at: 123 })));
await t('invalid paid rejected', assertFails(set(ref(anon, 'rooms/OWN/paid/P1'), { at: 'yesterday' })));
await t('unmark paid', assertSucceeds(remove(ref(anon, 'rooms/OWN/paid/P1'))));
// contacts
const c = { phone: '+56987654321', consentAt: 5, consentVersion: '2026-11-01' };
await t('anon saves own contact', assertSucceeds(set(ref(anon, 'contacts/OWN/P1'), c)));
await t('contact for non-existent room rejected', assertFails(set(ref(anon, 'contacts/NOPE/P1'), c)));
await t('invalid phone rejected', assertFails(set(ref(anon, 'contacts/OWN/P2'), { ...c, phone: '12345' })));
await t('contact without consent rejected', assertFails(set(ref(anon, 'contacts/OWN/P2'), { phone: c.phone })));
await t('extra fields rejected', assertFails(set(ref(anon, 'contacts/OWN/P2'), { ...c, rut: '1-9' })));
await t('anon cannot read contacts', assertFails(get(ref(anon, 'contacts/OWN'))));
await t('anon cannot read a single contact', assertFails(get(ref(anon, 'contacts/OWN/P1'))));
await t('other user cannot read contacts', assertFails(get(ref(other, 'contacts/OWN'))));
await t('nobody can list all contacts', assertFails(get(ref(owner, 'contacts'))));
await t('owner reads contacts of own room', assertSucceeds(get(ref(owner, 'contacts/OWN'))));
await t('owner cannot read contacts of unowned room', assertFails(get(ref(owner, 'contacts/AAX'))));
await t('anon deletes own contact', assertSucceeds(remove(ref(anon, 'contacts/OWN/P1'))));
// users
await t('user writes own history', assertSucceeds(set(ref(owner, 'users/uOwner/rooms/OWN'), { code: 'OWN' })));
await t('user reads own history', assertSucceeds(get(ref(owner, 'users/uOwner/rooms'))));
await t('other user cannot read history', assertFails(get(ref(other, 'users/uOwner/rooms'))));
await t('anon cannot write history', assertFails(set(ref(anon, 'users/uOwner/rooms/X'), { code: 'X' })));
await t('root is not readable', assertFails(get(ref(anon, '/'))));
await env.cleanup();
console.log(fails ? `${fails} FAILED` : 'ALL RULES TESTS PASSED');
process.exit(fails ? 1 : 0);
