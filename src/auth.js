import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  const res = await signInWithPopup(auth, googleProvider);
  return res.user;
}

// Apple a futuro: new OAuthProvider('apple.com') + signInWithPopup(auth, appleProvider)

export async function logout() {
  await signOut(auth);
}
