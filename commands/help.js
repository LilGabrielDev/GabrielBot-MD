const settings = require("../settings");
const fs = require("fs");
const path = require("path");

async function helpCommand(sock, chatId, message) {
  const helpMessage = `
╔═══════════════════╗
   *🤖 ${settings.botName || "GabrielBot-MD"}*  
   Version: *${settings.version || "1.0.0"}*
   by ${settings.botOwner || "Lil Gabriel Dev"}
   YT : ${global.ytch}
╚═══════════════════╝

*Available Commands:*

╔═══════════════════╗
🌐 *General Commands*:
║ ➤ .help or .menu
║ ➤ .ping
║ ➤ .alive
║ ➤ .tts
║ ➤ .owner
║ ➤ .joke
║ ➤ .quote
║ ➤ .fact
║ ➤ .weather
║ ➤ .news
║ ➤ .attp
║ ➤ .lyrics
║ ➤ .8ball
║ ➤ .trt <text> <lang>
║ ➤ .ss <link>
║ ➤ .jid
║ ➤ .url
╚═══════════════════╝ 

╔═══════════════════╗
👮‍♂️ * Admin Commands*:
║ ➤ .ban @user
║ ➤ .promote @user
║ ➤ .demote @user
║ ➤ .mute <minutes>
║ ➤ .unmute
║ ➤ .delete or .del
║ ➤ .kick @user
║ ➤ .staff or .admins 
║ ➤ .warnings @user
║ ➤ .warn @user
║ ➤ .antilink
║ ➤ .antibadword
║ ➤ .clear
║ ➤ .groupinfo
║ ➤ .tag
║ ➤ .tagall
║ ➤ .tagnotadmin
║ ➤ .hidetag
║ ➤ .chatbot
║ ➤ .resetlink
║ ➤ .antitag
║ ➤ .welcome
║ ➤ .goodbye
║ ➤ .setgdesc <description>
║ ➤ .setgname
║ ➤ .setgpp
╚═══════════════════╝

╔═══════════════════╗
🔒 *Owner Commands*:
║ ➤ .mode
║ ➤ .clearsession
║ ➤ .antidelete
║ ➤ .cleartmp
║ ➤ .update
║ ➤ .vv
║ ➤ .settings
║ ➤ .setpp
║ ➤ .autoreact 
║ ➤ .autostatus
║ ➤ .autostatus react
║ ➤ .autotyping
║ ➤ .autoread
║ ➤ .anticall
║ ➤ .pmblocker
║ ➤ .pmblocker setmsg <text>
║ ➤ .setmention
║ ➤ .mention
╚═══════════════════╝

╔═══════════════════╗
🎨 *Image/Sticker Commands*:
║ ➤ .blur <image>
║ ➤ .simage <reply to sticker>
║ ➤ .sticker <reply to image>
║ ➤ .removebg
║ ➤ .remini
║ ➤ .crop <reply to image>
║ ➤ .tgsticker <Link>
║ ➤ .meme
║ ➤ .take <packname> 
║ ➤ .emojimix <emj1>+<emj2>
║ ➤ .igs <insta link>
║ ➤ .igsc <insta link>
╚═══════════════════╝  

╔═══════════════════╗
🖼️ *Pies Commands*:
║ ➤ .pies <country>
║ ➤ .china 
║ ➤ .indonesia 
║ ➤ .japan 
║ ➤ .korea 
║ ➤ .hijab
╚═══════════════════╝

╔═══════════════════╗
🎮 *Game Commands*:
║ ➤ .tictactoe @user
║ ➤ .hangman
║ ➤ .guess <letter>
║ ➤ .trivia
║ ➤ .answer <answer>
║ ➤ .truth
║ ➤ .dare
╚═══════════════════╝

╔═══════════════════╗
🤖 *AI Commands*:
║ ➤ .gpt <question>
║ ➤ .gemini <question>
║ ➤ .imagine <prompt>
║ ➤ .flux <prompt>
║ ➤ .sora <prompt>
╚═══════════════════╝

╔═══════════════════╗
🎯 *Fun Commands*:
║ ➤ .compliment @user
║ ➤ .insult @user
║ ➤ .flirt 
║ ➤ .shayari
║ ➤ .goodnight
║ ➤ .roseday
║ ➤ .character @user
║ ➤ .wasted @user
║ ➤ .ship @user
║ ➤ .simp @user
║ ➤ .stupid @user [text]
╚═══════════════════╝

╔═══════════════════╗
🔤 *Textmaker*:
║ ➤ .metallic
║ ➤ .ice
║ ➤ .snow
║ ➤ .impressive
║ ➤ .matrix
║ ➤ .light
║ ➤ .neon
║ ➤ .devil
║ ➤ .purple
║ ➤ .thunder
║ ➤ .leaves
║ ➤ .1917
║ ➤ .arena
║ ➤ .hacker
║ ➤ .sand
║ ➤ .blackpink
║ ➤ .glitch
║ ➤ .fire
╚═══════════════════╝

╔═══════════════════╗
📥 *Downloader*:
║ ➤ .play <song_name>
║ ➤ .song <song_name>
║ ➤ .spotify <query>
║ ➤ .instagram <link>
║ ➤ .facebook <link>
║ ➤ .tiktok <link>
║ ➤ .video <song name>
║ ➤ .ytmp4 <Link>
╚═══════════════════╝

╔═══════════════════╗
🧩 *MISC*:
║ ➤ .heart
║ ➤ .horny
║ ➤ .circle
║ ➤ .lgbt
║ ➤ .lolice
║ ➤ .its-so-stupid
║ ➤ .namecard 
║ ➤ .oogway
║ ➤ .tweet
║ ➤ .ytcomment 
║ ➤ .comrade 
║ ➤ .gay 
║ ➤ .glass 
║ ➤ .jail 
║ ➤ .passed 
║ ➤ .triggered
╚═══════════════════╝

╔═══════════════════╗
🖼️ *ANIME*:
║ ➤ .nom 
║ ➤ .poke 
║ ➤ .cry 
║ ➤ .kiss 
║ ➤ .pat 
║ ➤ .hug 
║ ➤ .wink 
║ ➤ .facepalm 
╚═══════════════════╝

╔═══════════════════╗
💻 *Github Commands:*
║ ➤ .git
║ ➤ .github
║ ➤ .sc
║ ➤ .script
║ ➤ .repo
╚═══════════════════╝

GABRIEL BOT MD`;

  try {
    const imagePath = path.join(__dirname, "../assets/bot_image.jpg");

    if (fs.existsSync(imagePath)) {
      const imageBuffer = fs.readFileSync(imagePath);

      await sock.sendMessage(
        chatId,
        {
          image: imageBuffer,
          caption: helpMessage,

        },
        { quoted: message },
      );
    } else {
      console.error("Bot image not found at:", imagePath);
      await sock.sendMessage(chatId, {
        text: helpMessage,

      });
    }
  } catch (error) {
    console.error("Error in help command:", error);
    await sock.sendMessage(chatId, { text: helpMessage });
  }
}

module.exports = helpCommand;
