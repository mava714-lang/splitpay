import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCAC_6IUw6rlews5m7KrEHV77goUD4f-NY",
  authDomain: "splitpay01.firebaseapp.com",
  databaseURL: "https://splitpay01-default-rtdb.firebaseio.com",
  projectId: "splitpay01",
  storageBucket: "splitpay01.firebasestorage.app",
  messagingSenderId: "427767184297",
  appId: "1:427767184297:web:c60a0e76b02a7e0163e2b8",
  measurementId: "G-LX4HXZFR3M"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
