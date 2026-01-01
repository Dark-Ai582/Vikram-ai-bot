// ================================
// FULLY FIXED & UPDATED index.js
// Library: fca-priyansh
// Node >= 16 (ESM)
// ================================

import login from "fca-priyansh";
import fs from "fs";
import express from "express";

/* ================= BASIC CONFIG ================= */

const OWNER_UIDS = ["61550951546776", "61578652927298"];

const FILES = {
  APPSTATE: "appstate.json",
  FRIEND: "Friend.txt",
  TARGET: "Target.txt",
  NP: "np.txt",
  STICKER: "Sticker.txt"
};

/* ================= GLOBAL STATES ================= */

let rkbInterval = null;
let stopRequested = false;
let mediaLoopInterval = null;
let lastMedia = null;
let targetUID = null;
let stickerInterval = null;
let stickerLoopActive = false;

const lockedGroupNames = {};

/* ================= FILE LOADERS ================= */

const readList = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").map(x => x.trim()).filter(Boolean)
    : [];

const friendUIDs = readList(FILES.FRIEND);

/* ================= EXPRESS SERVER ================= */

const app = express();
app.get("/", (_, res) => res.send("<h2>🤖 Messenger Bot Running</h2>"));
app.listen(20782, () =>
  console.log("🌐 Log server running on http://localhost:20782")
);

/* ================= ERROR HANDLING ================= */

process.on("uncaughtException", e =>
  console.error("❗ Uncaught Exception:", e.message)
);
process.on("unhandledRejection", e =>
  console.error("❗ Unhandled Rejection:", e)
);

/* ================= LOGIN ================= */

if (!fs.existsSync(FILES.APPSTATE)) {
  console.error("❌ appstate.json not found");
  process.exit(1);
}

login(
  { appState: JSON.parse(fs.readFileSync(FILES.APPSTATE, "utf8")) },
  (err, api) => {
    if (err) return console.error("❌ Login failed:", err);

    api.setOptions({ listenEvents: true });
    console.log("✅ Bot logged in successfully");

    api.listenMqtt(async (err, event) => {
      try {
        if (err || !event) return;

        const { threadID, senderID, body, messageID } = event;

        /* ================= GROUP NAME LOCK ================= */

        if (event.type === "event" && event.logMessageType === "log:thread-name") {
          const current = event.logMessageData?.name;
          const locked = lockedGroupNames[threadID];
          if (locked && current !== locked) {
            await api.setTitle(locked, threadID);
            api.sendMessage(`🔒 Group name restored: ${locked}`, threadID);
          }
          return;
        }

        if (!body) return;

        const args = body.trim().split(/\s+/);
        const cmd = args[0].toLowerCase();
        const input = args.slice(1).join(" ");

        /* ================= OWNER GUARD ================= */

        const OWNER_COMMANDS = [
          "/help", "/uid", "/whois", "/exit",
          "/groupname", "/lockgroupname", "/unlockgroupname",
          "/allname", "/rkb", "/stop",
          "/photo", "/stopphoto",
          "/target", "/cleartarget",
          "/sticker", "/stopsticker"
        ];

        if (cmd.startsWith("/") && OWNER_COMMANDS.includes(cmd)) {
          if (!OWNER_UIDS.includes(senderID)) {
            return api.sendMessage("❌ Owner only command", threadID, messageID);
          }
        }

        /* ================= COMMANDS ================= */

        // HELP
        if (cmd === "/help") {
          return api.sendMessage(
            `📌 Commands

/uid @name → member UID
/uid → group UID
/whois → reply se UID
/groupname <name>
/lockgroupname <name>
/unlockgroupname
/allname <name>
/rkb <text>
/stop
/photo
/stopphoto
/target <uid>
/cleartarget
/sticker<sec>
/stopsticker
/exit`,
            threadID
          );
        }

        /* ================= UID (MENTION + GROUP) ================= */

        if (cmd === "/uid") {
          // Mention based UID
          if (Object.keys(event.mentions || {}).length > 0) {
            const uid = Object.keys(event.mentions)[0];
            const name = event.mentions[uid];
            return api.sendMessage(
              `👤 User Info\n\n• Name: ${name}\n• UID: ${uid}`,
              threadID,
              messageID
            );
          }

          // Default group UID
          return api.sendMessage(`🆔 Group ID: ${threadID}`, threadID);
        }

        /* ================= WHOIS (REPLY UID) ================= */

        if (cmd === "/whois") {
          if (!event.messageReply) {
            return api.sendMessage(
              "❌ Kisi message pe reply karke /whois likho",
              threadID,
              messageID
            );
          }

          const uid = event.messageReply.senderID;
          try {
            const info = await api.getUserInfo(uid);
            const name = info[uid]?.name || "Unknown";
            return api.sendMessage(
              `👤 User Info\n\n• Name: ${name}\n• UID: ${uid}`,
              threadID,
              messageID
            );
          } catch {
            return api.sendMessage(`🆔 UID: ${uid}`, threadID);
          }
        }

        /* ================= GROUP CONTROLS ================= */

        if (cmd === "/groupname") {
          await api.setTitle(input, threadID);
          return api.sendMessage(`📝 Group name set: ${input}`, threadID);
        }

        if (cmd === "/lockgroupname") {
          await api.setTitle(input, threadID);
          lockedGroupNames[threadID] = input;
          return api.sendMessage(`🔒 Group name locked`, threadID);
        }

        if (cmd === "/unlockgroupname") {
          delete lockedGroupNames[threadID];
          return api.sendMessage("🔓 Group name unlocked", threadID);
        }

        if (cmd === "/exit") {
          await api.removeUserFromGroup(api.getCurrentUserID(), threadID);
          return;
        }

        /* ================= ALL NAME ================= */

        if (cmd === "/allname") {
          const info = await api.getThreadInfo(threadID);
          for (const uid of info.participantIDs) {
            await api.changeNickname(input, threadID, uid);
            await new Promise(r => setTimeout(r, 30000));
          }
          return api.sendMessage("✅ All nicknames changed", threadID);
        }

        /* ================= RKB ================= */

        if (cmd === "/rkb") {
          if (!fs.existsSync(FILES.NP))
            return api.sendMessage("❌ np.txt missing", threadID);

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

        /* ================= PHOTO LOOP ================= */

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
        }

        if (cmd === "/stopphoto") {
          if (mediaLoopInterval) clearInterval(mediaLoopInterval);
          mediaLoopInterval = null;
          lastMedia = null;
          return api.sendMessage("🛑 Media stopped", threadID);
        }

        /* ================= STICKER ================= */

        if (cmd.startsWith("/sticker")) {
          const delay = parseInt(cmd.replace("/sticker", ""));
          if (isNaN(delay) || delay < 5)
            return api.sendMessage("❌ Min 5 sec", threadID);

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
  }

);
