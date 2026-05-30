import {
  auth,
  roomRef,
  push,
  set,
  onChildAdded,
  onValue,
  query,
  limitToLast,
  orderByChild,
  serverTimestamp
} from "./firebase.js";

export class Chat {
  constructor(roomId, profile, multiplayer) {
    this.roomId = roomId;
    this.profile = profile;
    this.multiplayer = multiplayer;
    this.typingTimer = 0;
  }

  send(text) {
    const body = text.trim();
    if (!body) return Promise.resolve();
    return set(push(roomRef(this.roomId, "chat")), {
      uid: auth.currentUser.uid,
      name: this.profile.name,
      text: body,
      createdAt: serverTimestamp()
    });
  }

  listenMessages(callback) {
    const latest = query(roomRef(this.roomId, "chat"), orderByChild("createdAt"), limitToLast(80));
    return onChildAdded(latest, (snapshot) => callback(snapshot.key, snapshot.val()));
  }

  listenTyping(callback) {
    return onValue(roomRef(this.roomId, "players"), (snapshot) => {
      const players = snapshot.val() || {};
      const typingNames = Object.values(players)
        .filter((player) => player.uid !== auth.currentUser.uid && player.typing)
        .map((player) => player.name);
      callback(typingNames);
    });
  }

  markTyping() {
    clearTimeout(this.typingTimer);
    this.multiplayer.setTyping(true);
    this.typingTimer = setTimeout(() => this.multiplayer.setTyping(false), 1300);
  }
}
