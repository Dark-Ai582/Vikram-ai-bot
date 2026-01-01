// ================================
// 🔥 ULTIMATE GROUP BOT (FIXED)
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

let stickerInterval = null;
let stickerLoopActive = false;

let targetUID = null;
let targetLines = [];
let targetIndex = 0;

const lockedGroupNames = {};

/* ================= UTILS ================= */

const readList = (file) =>
  fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split("\n").map(x => x.trim()).filter(Boolean)
    : [];

const delay = ms => new Promise(r => setTimeout(r, ms));

/* ================= EXPRESS ================= */

const app = express();
app.get("/", (_, res) => res.send("<h2>🤖 Ultimate Group Bot Running</h2>"));
app.listen(20782, () => console.log("🌐 Server on :20782"));

/* ================= LOGIN ================= */

if (!fs.existsSync(FILES.APPSTATE)) {
  console.error("❌ appstate.json missing");
  process.exit(1);
}

login(
  { appState: JSON.parse(fs.readFileSync(FILES.APPSTATE, "utf8")) },
  (err, api) => {
    if (err) return console.error("❌ Login failed:", err);

    api.setOptions({
      listenEvents: true,
      selfListen: true,
      updatePresence: true,
      forceLogin: true
    });

    console.log("✅ Bot Logged In (Ultimate Mode)");

    api.listenMqtt(async (err, event) => {
      try {
        if (err || !event) return;

        const threadID = event.threadID;
        const senderID = event.senderID;
        const messageID = event.messageID;

        /* ================= SYSTEM EVENTS (GROUP NAME LOCK) ================= */

        if (event.type === "event") {
          if (event.logMessageType === "log:thread-name") {
            const current = event.logMessageData?.name;
            const locked = lockedGroupNames[threadID];
            if (locked && current !== locked) {
              await api.setTitle(locked, threadID);
              api.sendMessage(`🔒 Group name restored: ${locked}`, threadID);
            }
          }
          // ⚠️ event type hone pe bhi return nahi
        }

        /* ================= SAFE MESSAGE EXTRACT ================= */

        const text =
          event.body ||
          event.messageReply?.body ||
          "";

        // media‑only or empty messages ignore
        if (!text && !event.attachments) return;

        /* ================= TARGET AUTO‑REPLY (ALL GROUPS) ================= */

        if (
          targetUID &&
          senderID === targetUID &&
          targetLines.length > 0 &&
          !text.startsWith("/")
        ) {
          if (targetIndex >= targetLines.length) targetIndex = 0;

          await api.sendMessage(
            targetLines[targetIndex++],
            threadID,
            messageID
          );
          return;
        }

        /* ================= COMMAND PARSE (ULTIMATE) ================= */

        if (!text.startsWith("/")) return;

        const args = text.trim().split(/\s+/);
        const cmd = args[0].toLowerCase();
        const input = args.slice(1).join(" ");

        /* ================= OWNER‑ONLY (ONLY DANGEROUS) ================= */

        const OWNER_ONLY = [
          "/exit",
          "/lockgroupname",
          "/unlockgroupname"
        ];

        if (OWNER_ONLY.includes(cmd) && !OWNER_UIDS.includes(senderID)) {
          return api.sendMessage("❌ Owner only command", threadID, messageID);
        }

        /* ================= COMMANDS ================= */

        if (cmd === "/help") {
          return api.sendMessage(
`📌 Commands

/uid @name
/uid
/whois
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

        /* ================= UID ================= */

        if (cmd === "/uid") {
          if (Object.keys(event.mentions || {}).length > 0) {
            const uid = Object.keys(event.mentions)[0];
            return api.sendMessage(
              `👤 ${event.mentions[uid]}\n🆔 ${uid}`,
              threadID,
              messageID
            );
          }
          return api.sendMessage(`🆔 Group ID: ${threadID}`, threadID);
        }

        /* ================= WHOIS ================= */

        if (cmd === "/whois") {
          if (!event.messageReply)
            return api.sendMessage("❌ Reply on message", threadID, messageID);

          const uid = event.messageReply.senderID;
          const info = await api.getUserInfo(uid);
          return api.sendMessage(
            `👤 ${info[uid]?.name || "Unknown"}\n🆔 ${uid}`,
            threadID,
            messageID
          );
        }

        /* ================= GROUP ================= */

        if (cmd === "/groupname") {
          await api.setTitle(input, threadID);
          return api.sendMessage("📝 Group name set", threadID);
        }

        if (cmd === "/lockgroupname") {
          await api.setTitle(input, threadID);
          lockedGroupNames[threadID] = input;
          return api.sendMessage("🔒 Group locked", threadID);
        }

        if (cmd === "/unlockgroupname") {
          delete lockedGroupNames[threadID];
          return api.sendMessage("🔓 Group unlocked", threadID);
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
            await delay(30000);
          }
          return api.sendMessage("✅ Nicknames updated", threadID);
        }

        /* ================= RKB ================= */

        if (cmd === "/rkb") {
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

        /* ================= PHOTO ================= */

        if (cmd === "/photo") {
          api.sendMessage("📸 Send media", threadID);
          const handler = e => {
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
          return api.sendMessage("🛑 Media stopped", threadID);
        }

        /* ================= STICKER ================= */

        if (cmd.startsWith("/sticker")) {
          const delaySec = parseInt(cmd.replace("/sticker", ""));
          if (isNaN(delaySec) || delaySec < 5)
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
          }, delaySec * 1000);

          return api.sendMessage("📦 Sticker loop started", threadID);
        }

        if (cmd === "/stopsticker") {
          stickerLoopActive = false;
          if (stickerInterval) clearInterval(stickerInterval);
          stickerInterval = null;
          return api.sendMessage("🛑 Sticker stopped", threadID);
        }

        /* ================= TARGET ================= */

        if (cmd === "/target") {
          targetUID = input.trim();
          targetLines = readList(FILES.NP);
          targetIndex = 0;
          return api.sendMessage(`🎯 Target set: ${targetUID}`, threadID);
        }

        if (cmd === "/cleartarget") {
          targetUID = null;
          targetLines = [];
          return api.sendMessage("🧹 Target cleared", threadID);
        }

      } catch (e) {
        console.error("⚠️ Error:", e.message);
      }
    });
  }

);
