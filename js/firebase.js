import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getDatabase,
  ref,
  child,
  get,
  set,
  update,
  push,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp,
  remove,
  runTransaction,
  query,
  limitToLast,
  orderByChild
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBPeJZRj48zLkgLziX-AaB--edSS_GfoOU",
  authDomain: "anonymousconfession-19707.firebaseapp.com",
  databaseURL: "https://anonymousconfession-19707-default-rtdb.firebaseio.com",
  projectId: "anonymousconfession-19707",
  storageBucket: "anonymousconfession-19707.firebasestorage.app",
  messagingSenderId: "513711142017",
  appId: "1:513711142017:web:2b83fbbdcf04c086644980",
  measurementId: "G-EFMXHZ9H13"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export {
  ref,
  child,
  get,
  set,
  update,
  push,
  onValue,
  onChildAdded,
  onDisconnect,
  serverTimestamp,
  remove,
  runTransaction,
  query,
  limitToLast,
  orderByChild
};

export function signIn() {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop();
        resolve(user);
      }
    }, reject);
    signInAnonymously(auth).catch(reject);
  });
}

export function roomRef(roomId, path = "") {
  return ref(db, `rooms/${roomId}${path ? `/${path}` : ""}`);
}

export function cleanRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 18);
}

export function makeRoomCode() {
  const words = ["LOVE", "MOON", "ROSE", "STAR", "COZY", "HOME"];
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

export function getInviteRoomFromUrl() {
  return cleanRoomCode(new URLSearchParams(location.search).get("room"));
}
