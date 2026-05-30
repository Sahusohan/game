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
    this.playerKey = "";
    this.playerPath = "";
    this.lastSentAt = 0;
  }

  async join() {
    const slots = ["slot1", "slot2"];
    let joined = false;

    for (const [index, slotName] of slots.entries()) {
      this.playerKey = slotName;
      this.playerPath = `players/${slotName}`;
      const userRef = roomRef(this.roomId, this.playerPath);

      try {
        await set(userRef, {
          uid: this.uid,
          name: this.profile.name,
          avatar: this.profile.avatar,
          x: START_POSITIONS[index].x,
          y: START_POSITIONS[index].y,
          direction: "down",
          action: "",
          online: true,
          joinedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        joined = true;
        break;
      } catch {
        joined = false;
      }
    }

    if (!joined) {
      this.playerKey = "";
      this.playerPath = "";
      throw new Error("This room already has two players.");
    }

    const userRef = roomRef(this.roomId, this.playerPath);

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
    if (!this.playerKey) return;
    await remove(ref(db, `rooms/${this.roomId}/players/${this.playerKey}`));
  }
}
