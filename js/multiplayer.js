import {
  auth,
  db,
  ref,
  roomRef,
  set,
  update,
  onValue,
  onDisconnect,
  serverTimestamp,
  remove
} from "./firebase.js";

const START_POSITIONS = [
  { x: 520, y: 520 },
  { x: 600, y: 520 }
];

export class Multiplayer {
  constructor(roomId, profile) {
    this.roomId = roomId;
    this.profile = profile;
    this.uid = auth.currentUser.uid;
    this.playerPath = `players/${this.uid}`;
    this.lastSentAt = 0;
  }

  async join() {
    const userRef = roomRef(this.roomId, this.playerPath);
    const slot = this.uid.charCodeAt(0) % START_POSITIONS.length;
    await set(userRef, {
      uid: this.uid,
      name: this.profile.name,
      avatar: this.profile.avatar,
      x: START_POSITIONS[slot].x,
      y: START_POSITIONS[slot].y,
      direction: "down",
      action: "",
      online: true,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(() => {
      throw new Error("This room already has two players, or you do not have access.");
    });

    await update(roomRef(this.roomId, "settings"), {
      roomId: this.roomId,
      updatedAt: serverTimestamp()
    });

    await onDisconnect(userRef).update({
      online: false,
      action: "",
      typing: false,
      updatedAt: serverTimestamp()
    });
    await update(userRef, { online: true, lastSeen: serverTimestamp() });
  }

  listenPlayers(callback) {
    return onValue(roomRef(this.roomId, "players"), (snapshot) => {
      callback(snapshot.val() || {});
    });
  }

  updatePosition(position, force = false) {
    const now = performance.now();
    if (!force && now - this.lastSentAt < 70) return;
    this.lastSentAt = now;
    return update(roomRef(this.roomId, this.playerPath), {
      x: Math.round(position.x),
      y: Math.round(position.y),
      direction: position.direction || "down",
      online: true,
      updatedAt: serverTimestamp()
    });
  }

  sendAction(action, extra = {}) {
    return update(roomRef(this.roomId, this.playerPath), {
      action,
      actionId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      actionAt: serverTimestamp(),
      ...extra
    });
  }

  setTyping(isTyping) {
    return update(roomRef(this.roomId, this.playerPath), {
      typing: Boolean(isTyping),
      updatedAt: serverTimestamp()
    });
  }

  async leave() {
    await update(roomRef(this.roomId, this.playerPath), {
      online: false,
      typing: false,
      action: "",
      updatedAt: serverTimestamp()
    });
  }

  async resetMe() {
    await remove(ref(db, `rooms/${this.roomId}/players/${this.uid}`));
  }
}
