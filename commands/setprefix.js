const fs = require("fs");
const path = require("path");
const settings = require("../settings");
const { DEFAULT_PREFIX } = require("../lib/prefix");

function formatPrefixForSettings(prefix) {
  return Array.isArray(prefix)
    ? `[${prefix.map((p) => JSON.stringify(p)).join(", ")}]`
    : JSON.stringify(prefix);
}

function updatePrefixInSettingsFile(prefix) {
  const settingsPath = path.join(__dirname, "../settings.js");
  const settingsContent = fs.readFileSync(settingsPath, "utf8");
  const prefixString = formatPrefixForSettings(prefix);
  const prefixLine = /^(\s*prefix:\s*)(\[[^\]]*\]|"(?:\\.|[^"\\])*")(\s*,.*)$/m;

  if (!prefixLine.test(settingsContent)) {
    throw new Error("Could not find a valid prefix line in settings.js");
  }

  const updatedContent = settingsContent.replace(
    prefixLine,
    `$1${prefixString}$3`,
  );

  fs.writeFileSync(settingsPath, updatedContent, "utf8");
}

async function setprefixCommand(sock, chatId, message, args) {
  const newPrefix =
    args.length === 0 ? DEFAULT_PREFIX : args.length === 1 ? args[0] : args;

  try {
    updatePrefixInSettingsFile(newPrefix);
    settings.prefix = newPrefix;

    await sock.sendMessage(
      chatId,
      {
        text: `✅ Prefix has been updated to: *${Array.isArray(newPrefix) ? newPrefix.join(" ") : newPrefix}*\n\nCommands now use the new prefix immediately.`,
      },
      { quoted: message },
    );
  } catch (error) {
    console.error("Error updating prefix:", error);
    await sock.sendMessage(
      chatId,
      { text: "❌ Failed to update prefix in settings.js" },
      { quoted: message },
    );
  }
}

module.exports = setprefixCommand;
