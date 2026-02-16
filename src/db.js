import { db } from './firebase.js';
import { ref, set, get, onValue, off } from 'firebase/database';

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
