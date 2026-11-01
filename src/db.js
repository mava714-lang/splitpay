import { db } from './firebase.js';
import { ref, set, get, remove, onValue, off } from 'firebase/database';

export async function createRoom(code, roomData) {
  await set(ref(db, `rooms/${code}`), { ...roomData, createdAt: Date.now() });
}

export async function getRoom(code) {
  const snap = await get(ref(db, `rooms/${code}`));
  return snap.exists() ? snap.val() : null;
}

export function subscribeToClaims(code, callback) {
  const claimsRef = ref(db, `rooms/${code}/claims`);
  onValue(claimsRef, (snap) => callback(snap.exists() ? snap.val() : {}));
  return () => off(claimsRef);
}

export async function submitClaim(code, personId, claimData) {
  await set(ref(db, `rooms/${code}/claims/${personId}`), { ...claimData, confirmedAt: Date.now() });
}

export async function deleteClaim(code, personId) {
  await remove(ref(db, `rooms/${code}/claims/${personId}`));
}

export async function updateRoom(code, roomData) {
  await set(ref(db, `rooms/${code}`), { ...roomData, updatedAt: Date.now() });
}

export async function saveUserRoom(uid, entry) {
  await set(ref(db, `users/${uid}/rooms/${entry.code}`), entry);
}

export async function getUserRooms(uid) {
  const snap = await get(ref(db, `users/${uid}/rooms`));
  return snap.exists() ? Object.values(snap.val()) : [];
}

// ─── Room ownership (organizer signed in with Google) ───
// Security rules only allow setting ownerUid once, to the signed-in user's uid.
export async function setRoomOwner(code, uid) {
  await set(ref(db, `rooms/${code}/ownerUid`), uid);
}

// ─── Payment status per person: rooms/{code}/paid/{personId} ───
export function subscribeToPaid(code, callback) {
  return onValue(ref(db, `rooms/${code}/paid`), (snap) => callback(snap.exists() ? snap.val() : {}));
}

export async function setPaid(code, personId, isPaid) {
  const r = ref(db, `rooms/${code}/paid/${personId}`);
  if (isPaid) await set(r, { at: Date.now() });
  else await remove(r);
}

// ─── Contacts (personal data): contacts/{code}/{personId} ───
// Stored OUTSIDE rooms/ so they are not readable by everyone with the room code.
// Security rules: anyone may write their own entry; only the room owner can read.
export async function saveContact(code, personId, contact) {
  await set(ref(db, `contacts/${code}/${personId}`), contact);
}

export async function deleteContact(code, personId) {
  await remove(ref(db, `contacts/${code}/${personId}`));
}

export async function getContacts(code) {
  const snap = await get(ref(db, `contacts/${code}`));
  return snap.exists() ? snap.val() : {};
}
