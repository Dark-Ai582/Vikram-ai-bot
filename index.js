// ================================ // FULLY FIXED & CLEAN index.js // ================================ // Library: fca-priyansh // Node >= 16

import login from "fca-priyansh"; import fs from "fs"; import express from "express";

/* ================= BASIC CONFIG ================= */

const OWNER_UIDS = ["61550951546776", "61578652927298"]; // <-- owners

const FILES = { APPSTATE: "appstate.json", FRIEND: "Friend.txt", TARGET: "Target.txt", NP: "np.txt", STICKER: "Sticker.txt" };

/* ================= GLOBAL STATES ================= */

let rkbInterval = null; let stopRequested = false; let mediaLoopInterval = null; let lastMedia = null; let targetUID = null; let stickerInterval = null; let stickerLoopActive = false;

const lockedGroupNames = {}; const messageQueues = {}; const queueRunning = {};

/* ================= FILE LOADERS ================= */

const readList = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").map(x => x.trim()).filter(Boolean) : [];

const friendUIDs = readList(FILES.FRIEND); const targetUIDs = readList(FILES.TARGET);

/* ================= EXPRESS SERVER ================= */

const app = express(); app.get("/", (_, res) => res.send("<h2>🤖 Messenger Bot Running</h2>")); app.listen(20782, () => console.log("🌐 Log server: http://localhost:20782"));

process.on("uncaughtException", e => console.error("❗ Uncaught:", e.message)); process.on("unhandledRejection", e => console.error("❗ Rejection:", e));

/* ================= LOGIN ================= */

if (!fs.existsSync(FILES.APPSTATE)) { console.error("❌ appstate.json not found"); process.exit(1); }

login({ appState: JSON.parse(fs.readFileSync(FILES.APPSTATE, "utf8")) }, (err, api) => { if (err) return console.error("❌ Login failed:", err);

api.setOptions({ listenEvents: true }); console.log("✅ Bot logged in successfully");

api.listenMqtt(async (err, event) => { try { if (err || !event) return;

const { threadID, senderID, body, messageID } = event;

  /* ================= GROUP NAME LOCK WATCHER ================= */
  if (event.type === "event" && event.logMessageType === "log:thread-name") {
    const current = event.logMessageData?.name;
    const locked = lockedGroupNames[threadID];
    if (locked && current !== locked) {
      await api.setTitle(locked, threadID);
      api.sendMessage(`🔒 Group name restored: ${locked}`, threadID);
    }
    return;
  }

  /* ================= BODY CHECK ================= */
  if (!body) return;

  const lowerBody = body.toLowerCase();
  const args = body.trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const input = args.slice(1).join(" ");

  /* ================= AUTO REPLY SYSTEM ================= */
  const badNames = ["vikram", "goku", "aj", "abhi", "arman", "foku", "rohit"];
  const triggers = ["rkb", "bhen", "maa", "randi", "chut", "mc", "bc", "didi"];

  if (
    badNames.some(n => lowerBody.includes(n)) &&
    triggers.some(w => lowerBody.includes(w)) &&
    !friendUIDs.includes(senderID)
  ) {
    return api.sendMessage(
      "teri ma 2 rs ki rawndi hai — msg mat kar 🙂",
      threadID,
      messageID
    );
  }

  /* ================= OWNER COMMAND GUARD ================= */
  const OWNER_COMMANDS = [
    "/help", "/uid", "/exit",
    "/groupname", "/lockgroupname", "/unlockgroupname",
    "/allname", "/rkb", "/stop",
    "/photo", "/stopphoto",
    "/forward",
    "/target", "/cleartarget",
    "/sticker", "/stopsticker"
  ];

  if (cmd.startsWith("/") && OWNER_COMMANDS.some(c => cmd.startsWith(c))) {
    if (!OWNER_UIDS.includes(senderID)) {
      return api.sendMessage("❌ Owner only command", threadID, messageID);
    }
  }

  /* ================= COMMANDS ================= */

  if (cmd === "/help") {
    return api.sendMessage(`📌 Commands

/allname <name> /groupname <name> /lockgroupname <name> /unlockgroupname /uid /exit /rkb <name> /stop /photo /stopphoto /forward (reply) /target <uid> /cleartarget /sticker<sec> /stopsticker /help`, threadID); }

if (cmd === "/uid") {
    return api.sendMessage(`🆔 Group ID: ${threadID}`, threadID);
  }

  if (cmd === "/groupname") {
    await api.setTitle(input, threadID);
    return api.sendMessage(`📝 Group name set: ${input}`, threadID);
  }

  if (cmd === "/lockgroupname") {
    await api.setTitle(input, threadID);
    lockedGroupNames[threadID] = input;
    return api.sendMessage(`🔒 Group name locked: ${input}`, threadID);
  }

  if (cmd === "/unlockgroupname") {
    delete lockedGroupNames[threadID];
    return api.sendMessage("🔓 Group name unlocked", threadID);
  }

  if (cmd === "/exit") {
    await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
    return;
  }

  if (cmd === "/allname") {
    const info = await api.getThreadInfo(threadID);
    for (const uid of info.participantIDs) {
      await api.changeNickname(input, threadID, uid);
      await new Promise(r => setTimeout(r, 30000));
    }
    return api.sendMessage("✅ All nicknames changed", threadID);
  }

  if (cmd === "/rkb") {
    if (!fs.existsSync(FILES.NP)) return api.sendMessage("np.txt missing", threadID);
    const lines = readList(FILES.NP);
    let i = 0;
    stopRequested = false;
    if (rkbInterval) clearInterval(rkbInterval);
    rkbInterval = setInterval(() => {
      if (i >= lines.length || stopRequested) {
        clearInterval(rkbInterval);
        rkbInterval = null;
        return;
      }
      api.sendMessage(`${input} ${lines[i++]}`, threadID);
    }, 60000);
    return api.sendMessage("🔥 RKB started", threadID);
  }

  if (cmd === "/stop") {
    stopRequested = true;
    if (rkbInterval) clearInterval(rkbInterval);
    rkbInterval = null;
    return api.sendMessage("🛑 Stopped", threadID);
  }

  if (cmd === "/photo") {
    api.sendMessage("📸 Send photo/video within 1 min", threadID);
    const handler = (e) => {
      if (e.attachments?.length && e.threadID === threadID) {
        lastMedia = e.attachments;
        if (mediaLoopInterval) clearInterval(mediaLoopInterval);
        mediaLoopInterval = setInterval(() => {
          api.sendMessage({ attachment: lastMedia }, threadID);
        }, 30000);
        api.removeListener("message", handler);
      }
    };
    api.on("message", handler);
    return;
  }

  if (cmd === "/stopphoto") {
    if (mediaLoopInterval) clearInterval(mediaLoopInterval);
    mediaLoopInterval = null;
    lastMedia = null;
    return api.sendMessage("🛑 Media stopped", threadID);
  }

  if (cmd === "/target") {
    targetUID = input;
    return api.sendMessage(`🎯 Target set: ${input}`, threadID);
  }

  if (cmd === "/cleartarget") {
    targetUID = null;
    return api.sendMessage("🎯 Target cleared", threadID);
  }

  if (cmd.startsWith("/sticker")) {
    if (!fs.existsSync(FILES.STICKER)) return api.sendMessage("Sticker.txt missing", threadID);
    const delay = parseInt(cmd.replace("/sticker", ""));
    if (isNaN(delay) || delay < 5) return api.sendMessage("Min 5 sec", threadID);
    const stickers = readList(FILES.STICKER);
    let i = 0;
    stickerLoopActive = true;
    if (stickerInterval) clearInterval(stickerInterval);
    stickerInterval = setInterval(() => {
      if (!stickerLoopActive || i >= stickers.length) {
        clearInterval(stickerInterval);
        stickerInterval = null;
        return;
      }
      api.sendMessage({ sticker: stickers[i++] }, threadID);
    }, delay * 1000);
    return api.sendMessage("📦 Sticker loop started", threadID);
  }

  if (cmd === "/stopsticker") {
    stickerLoopActive = false;
    if (stickerInterval) clearInterval(stickerInterval);
    stickerInterval = null;
    return api.sendMessage("🛑 Sticker stopped", threadID);
  }

} catch (e) {
    console.error("⚠️ Handler error:", e.message);
   }
 });
});