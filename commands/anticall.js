const fs = require("fs");

const ANTICALL_PATH = "./data/anticall.json";

function readState() {
  try {
    if (!fs.existsSync(ANTICALL_PATH)) return { enabled: false, mode: "block" };
    const raw = fs.readFileSync(ANTICALL_PATH, "utf8");
    const data = JSON.parse(raw || "{}");
    return {
      enabled: !!data.enabled,
      mode: data.mode || "block",
    };
  } catch {
    return { enabled: false, mode: "block" };
  }
}

function writeState(enabled, mode = "block") {
  try {
    if (!fs.existsSync("./data")) fs.mkdirSync("./data", { recursive: true });
    fs.writeFileSync(
      ANTICALL_PATH,
      JSON.stringify({ enabled: !!enabled, mode }, null, 2),
    );
  } catch {}
}

async function anticallCommand(sock, chatId, message, args) {
  const state = readState();
  const sub = (args || "").trim().toLowerCase();

  if (!sub || (sub !== "on" && sub !== "off" && sub !== "status" && sub !== "reject")) {
    await sock.sendMessage(
      chatId,
      {
        text: "*ANTICALL*\n\n.anticall on  - Enable auto-block on incoming calls\n.anticall reject - Enable rejection only (no block)\n.anticall off - Disable anticall\n.anticall status - Show current status",
      },
      { quoted: message },
    );
    return;
  }

  if (sub === "status") {
    let statusText = `Anticall is currently *${state.enabled ? "ON" : "OFF"}*.`;
    if (state.enabled) {
      statusText += `\nMode: *${state.mode === "reject" ? "Rejection Only" : "Auto-Block"}*`;
    }
    await sock.sendMessage(
      chatId,
      { text: statusText },
      { quoted: message },
    );
    return;
  }

  if (sub === "off") {
    writeState(false, state.mode);
    await sock.sendMessage(
      chatId,
      { text: "Anticall is now *DISABLED*." },
      { quoted: message },
    );
    return;
  }

  const mode = sub === "reject" ? "reject" : "block";
  writeState(true, mode);
  await sock.sendMessage(
    chatId,
    { text: `Anticall is now *ENABLED*.\nMode: *${mode === "reject" ? "Rejection Only" : "Auto-Block"}*.` },
    { quoted: message },
  );
}

module.exports = { anticallCommand, readState };
