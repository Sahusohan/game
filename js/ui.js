import {
  auth,
  roomRef,
  push,
  set,
  update,
  onValue,
  onChildAdded,
  serverTimestamp
} from "./firebase.js";

export function qs(selector) {
  return document.querySelector(selector);
}

export function showToast(text) {
  const toast = qs("#toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2400);
}

export function setupTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
      tab.classList.add("active");
      qs(`#tab-${tab.dataset.tab}`).classList.add("active");
    });
  });
}

export function setupChatUI(chat) {
  const form = qs("#chat-form");
  const input = qs("#chat-input");
  const messages = qs("#messages");
  const typing = qs("#typing-indicator");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    await chat.send(text);
    await chat.multiplayer.setTyping(false);
  });

  input.addEventListener("input", () => chat.markTyping());

  chat.listenMessages((id, message) => {
    const node = document.createElement("article");
    node.className = `message ${message.uid === auth.currentUser.uid ? "mine" : ""}`;
    node.dataset.id = id;
    const time = message.createdAt
      ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "now";
    node.innerHTML = `<header><strong></strong><span>${time}</span></header><p></p>`;
    node.querySelector("strong").textContent = message.name || "Love";
    node.querySelector("p").textContent = message.text || "";
    messages.appendChild(node);
    messages.scrollTop = messages.scrollHeight;
  });

  chat.listenTyping((names) => {
    typing.textContent = names.length ? `${names.join(", ")} is typing...` : "";
  });
}

export function setupSharedPanels(roomId, getLocalPosition, placeFurniture) {
  const anniversary = qs("#anniversary-date");
  const diaryInput = qs("#diary-input");
  const diaryList = qs("#diary-list");
  const memoryFile = qs("#memory-file");
  const memoryCaption = qs("#memory-caption");
  const memoryList = qs("#memory-list");
  const giftList = qs("#gift-list");

  qs("#save-diary").addEventListener("click", async () => {
    const text = diaryInput.value.trim();
    if (!text) return;
    diaryInput.value = "";
    await set(push(roomRef(roomId, "diary")), {
      uid: auth.currentUser.uid,
      text,
      createdAt: serverTimestamp()
    });
    showToast("Diary saved");
  });

  anniversary.addEventListener("change", async () => {
    await update(roomRef(roomId, "settings"), {
      anniversaryDate: anniversary.value,
      updatedAt: serverTimestamp()
    });
  });

  qs("#add-memory").addEventListener("click", async () => {
    const file = memoryFile.files?.[0];
    if (!file) {
      showToast("Choose a photo first");
      return;
    }
    const image = await imageFileToDataUrl(file);
    await set(push(roomRef(roomId, "memories")), {
      uid: auth.currentUser.uid,
      caption: memoryCaption.value.trim(),
      image,
      album: "Our memories",
      createdAt: serverTimestamp()
    });
    memoryFile.value = "";
    memoryCaption.value = "";
    showToast("Memory added");
  });

  document.querySelectorAll("[data-furniture]").forEach((button) => {
    button.addEventListener("click", () => {
      const pos = getLocalPosition();
      if (!pos?.insideHouse) {
        showToast("Step inside the house to decorate");
        return;
      }
      placeFurniture(button.dataset.furniture, pos.x, pos.y);
    });
  });

  onChildAdded(roomRef(roomId, "diary"), (snapshot) => {
    const item = document.createElement("article");
    item.className = "stack-item";
    item.innerHTML = `<small>${formatDate(snapshot.val().createdAt)}</small><p></p>`;
    item.querySelector("p").textContent = snapshot.val().text || "";
    diaryList.prepend(item);
  });

  onChildAdded(roomRef(roomId, "memories"), (snapshot) => {
    const memory = snapshot.val();
    const item = document.createElement("article");
    item.className = "memory-card";
    item.innerHTML = `<img alt=""><p></p><small>${formatDate(memory.createdAt)}</small>`;
    item.querySelector("img").src = memory.image;
    item.querySelector("img").alt = memory.caption || "Shared memory";
    item.querySelector("p").textContent = memory.caption || "A little moment";
    memoryList.prepend(item);
  });

  onChildAdded(roomRef(roomId, "gifts"), (snapshot) => {
    const gift = snapshot.val();
    const item = document.createElement("article");
    item.className = "stack-item";
    item.innerHTML = `<strong>Gift</strong><p></p>`;
    item.querySelector("p").textContent = gift.note || "A sweet surprise";
    giftList.prepend(item);
  });

  onValue(roomRef(roomId, "settings"), (snapshot) => {
    const settings = snapshot.val() || {};
    if (settings.anniversaryDate && anniversary.value !== settings.anniversaryDate) {
      anniversary.value = settings.anniversaryDate;
    }
    updateCounters(settings);
  });
}

export function setupActions(multiplayer, roomId, musicController) {
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.action;
      if (action === "gift") {
        await set(push(roomRef(roomId, "gifts")), {
          uid: auth.currentUser.uid,
          note: "A tiny gift wrapped in love",
          createdAt: serverTimestamp()
        });
      }
      await multiplayer.sendAction(action);
      if (action === "heart") {
        const current = Number(qs("#love-meter").textContent || 0);
        await update(roomRef(roomId, "settings"), { loveMeter: Math.min(100, current + 3) });
      }
    });
  });

  qs("#music-button").addEventListener("click", () => musicController.toggle());
}

export function setupChrome(roomId) {
  qs("#room-label").textContent = `Room ${roomId}`;
  qs("#invite-button").addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(roomId)}`;
    await navigator.clipboard.writeText(url);
    showToast("Invite link copied");
  });
  qs("#fullscreen-button").addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  });
  qs("#settings-button").addEventListener("click", () => qs("#settings-dialog").showModal());
}

function updateCounters(settings) {
  const love = Number(settings.loveMeter || 0);
  qs("#love-meter").textContent = String(love);
  if (!settings.anniversaryDate) return;
  const start = new Date(`${settings.anniversaryDate}T00:00:00`);
  const diff = Date.now() - start.getTime();
  qs("#anniversary-counter").textContent = String(Math.max(0, Math.floor(diff / 86400000)));
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "now";
}

async function imageFileToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const max = 760;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.74);
}
