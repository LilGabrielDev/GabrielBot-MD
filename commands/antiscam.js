'use strict';

const fs   = require('fs');
const path = require('path');
const { fmt } = require('../lib/theme');
const isOwnerOrSudo = require('../lib/isOwner');
const isAdmin = require('../lib/isAdmin');

// ─── Scam phrase patterns ─────────────────────────────────────────────────────
// Each entry: { label, patterns: [RegExp] }
const SCAM_CATEGORIES = [
    {
        label: 'Investment Fraud',
        patterns: [
            /double\s+your\s+(money|investment|cash|crypto)/i,
            /\d+[x×%]\s*(profit|return|roi|gains?)\s*(guaranteed|daily|weekly|monthly)?/i,
            /guaranteed\s+(returns?|profits?|income|investment)/i,
            /invest\s+(and|to)\s+(earn|make|get)\s+\d/i,
            /minimum\s+invest(ment)?\s+of?\s+[a-z]*\s*\d/i,
            /withdrawal\s+of\s+[a-z]*\s*\d+\s*(daily|weekly|per day)/i,
            /ponzi|pyramid\s+scheme/i,
            /send\s+(btc|eth|usdt|crypto|coins?|money)\s+(to|and\s+get)/i,
        ]
    },
    {
        label: 'Fake Giveaway / Prize',
        patterns: [
            /you\s+(have|'ve|ve|hav)\s+(won|win|been\s+selected)/i,
            /congratulations.{0,40}(won|prize|winner|selected)/i,
            /claim\s+your\s+(prize|reward|gift|winnings?|free\s+iphone|cash)/i,
            /free\s+(iphone|airpods|laptop|car|cash|money|gift\s+card)/i,
            /click\s+(here|the\s+link)\s+to\s+(claim|collect|receive|win)/i,
            /\b(giveaway|give\s*away)\b.{0,30}(click|link|dm|text|whatsapp)/i,
            /send\s+(your\s+)?(details|info|number|address)\s+to\s+claim/i,
        ]
    },
    {
        label: 'Phishing / Credential Theft',
        patterns: [
            /verify\s+your\s+(account|whatsapp|bank|mpesa|paypal|number)/i,
            /your\s+account\s+(will\s+be\s+)?(suspended|closed|disabled|banned)/i,
            /enter\s+your\s+(pin|password|otp|code|details)/i,
            /otp\s+(code\s+)?(for\s+verification|expired|invalid)/i,
            /bank\s+(details?|account\s+number)\s+(required|needed|send)/i,
            /log\s*in\s+to\s+(verify|confirm|update)\s+your/i,
        ]
    },
    {
        label: 'Loan / Money Mule Scam',
        patterns: [
            /instant\s+loan.{0,30}(no\s+(credit|collateral|security)|apply\s+now)/i,
            /quick\s+(loan|cash)\s+(no\s+documents?|apply\s+now|within\s+\d+\s*(mins?|hours?))/i,
            /transfer\s+(money|funds?)\s+(for\s+me|on\s+my\s+behalf|to\s+this\s+account)/i,
            /i\s+will\s+pay\s+you\s+\d+(%|percent)\s+(commission|for\s+transferring)/i,
            /help\s+me\s+(transfer|move|send)\s+(money|funds?|cash)/i,
        ]
    },
    {
        label: 'Crypto / Forex Scam',
        patterns: [
            /forex\s+(trading\s+)?(signal|mentor|expert|guaranteed|profit)/i,
            /crypto\s+(trading\s+)?(signal|mentor|expert|guaranteed|roi)/i,
            /bitcoin\s+(flip|doubler|multiplier|generator)/i,
            /(recover\s+lost\s+crypto|crypto\s+recovery\s+expert)/i,
            /trade\s+(with\s+)?(me|us|our\s+(team|expert))\s+(and\s+earn|for\s+guaranteed)/i,
            /\$\d+\s+(per\s+day|daily)\s+(trading|forex|crypto|signal)/i,
        ]
    },
    {
        label: 'Fake Job Offer',
        patterns: [
            /earn\s+\$?\d+(,\d+)?\s+(per\s+(day|week|month)|daily|weekly)\s+(from\s+home|online|working)/i,
            /work\s+from\s+home.{0,40}earn\s+\$?\d+/i,
            /part[\s-]time\s+(job|work|earn).{0,30}(no\s+experience|anyone\s+can)/i,
            /whatsapp\s+(job|task|earn)\s+(daily|weekly|\$\d+)/i,
            /typing\s+job.{0,30}earn\s+\$?\d+/i,
            /data\s+entry.{0,40}no\s+(experience|skill|qualification)/i,
        ]
    },
];

// ─── Persistence ──────────────────────────────────────────────────────────────
const DATA_PATH = path.join(__dirname, '../data/antiscam.json');

function loadData() {
    try {
        if (fs.existsSync(DATA_PATH)) return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    } catch { /* ignore */ }
    return {};
}

function saveData(data) {
    try {
        const dir = path.dirname(DATA_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
    } catch { /* ignore */ }
}

let antiscamData = loadData();

// ─── Global config helpers ────────────────────────────────────────────────────

const DEFAULT_GLOBAL = { enabled: true, action: 'delete+warn' };

function getGlobalCfg() {
    const data = loadData();
    if (!data.global || typeof data.global !== 'object') return { ...DEFAULT_GLOBAL };
    return {
        enabled: typeof data.global.enabled === 'boolean' ? data.global.enabled : DEFAULT_GLOBAL.enabled,
        action: ['delete+warn', 'delete', 'warn', 'kick'].includes(data.global.action) ? data.global.action : DEFAULT_GLOBAL.action,
    };
}

/**
 * Get the effective configuration for a group.
 * Always reads global first. If a per-group override exists, it takes precedence.
 */
function getGroupCfg(jid) {
    const data = loadData();
    const globalCfg = getGlobalCfg();

    // Per-group override (only if it exists AND is not the global key)
    if (data[jid] && typeof data[jid] === 'object') {
        return {
            enabled: typeof data[jid].enabled === 'boolean' ? data[jid].enabled : globalCfg.enabled,
            action: ['delete+warn', 'delete', 'warn', 'kick'].includes(data[jid].action) ? data[jid].action : globalCfg.action,
        };
    }

    // No per-group entry — fall back to global
    return { ...globalCfg };
}

// ─── Match helper ─────────────────────────────────────────────────────────────
function detectScam(text) {
    for (const cat of SCAM_CATEGORIES) {
        for (const pattern of cat.patterns) {
            if (pattern.test(text)) return cat.label;
        }
    }
    return null;
}

// ─── Text extraction helper ──────────────────────────────────────────────────
function extractText(message) {
    return (
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        message.message?.imageMessage?.caption ||
        message.message?.videoMessage?.caption ||
        message.message?.documentMessage?.caption ||
        ''
    );
}

// ─── Plugin ───────────────────────────────────────────────────────────────────
module.exports = {
    commands:    ['antiscam', 'scamcheck', 'checkscam'],
    description: 'Auto-detect and act on scam/fraud messages in groups',
    usage:       '.antiscam on | .antiscam off | .antiscam delete | .antiscam warn | .antiscam kick | .scamcheck <text>',
    permission:  'admin',
    group:       true,
    private:     true,

    run: async (sock, message, args, ctx) => {
        const { jid, isAdmin: ctxIsAdmin, isOwner: ctxIsOwner, reply } = ctx;
        const allowedInPrivate = ctxIsOwner;

        // Allow .scamcheck in private for owner
        const rawText = extractText(message).trim();
        const rawCmd = rawText.split(/\s+/)[0].replace(/^\./, '').toLowerCase();

        if (rawCmd === 'scamcheck' || rawCmd === 'checkscam') {
            const checkText = args.join(' ');
            if (!checkText) return reply(fmt('❓ Provide text to check.\n\nExample: `.scamcheck I will double your investment`'));
            const hit = detectScam(checkText);
            if (hit) {
                return reply(fmt(`🚨 *Scam Detected!*\n\nCategory: *${hit}*\n\n_The provided text matches a known scam pattern._`));
            }
            return reply(fmt('✅ *No scam patterns detected.*\n\n_Text appears clean based on known patterns._'));
        }

        if (!ctxIsAdmin && !ctxIsOwner) return reply(fmt('⛔ Only admins can configure antiscam.'));

        const globalCfg = getGlobalCfg();
        const sub = (args[0] || '').toLowerCase();

        // No sub-command → show status
        if (!sub) {
            return reply(fmt(
                `🕵️ *Anti-Scam Filter (Global)*\n\n` +
                `Status: ${globalCfg.enabled ? '✅ ON' : '❌ OFF'}\n` +
                `Action: *${globalCfg.action}*\n\n` +
                `*Commands:*\n` +
                `• \`.antiscam on\` — enable globally\n` +
                `• \`.antiscam off\` — disable globally\n` +
                `• \`.antiscam delete\` — delete msg (silent)\n` +
                `• \`.antiscam warn\` — delete + warn sender\n` +
                `• \`.antiscam kick\` — delete + kick sender\n\n` +
                `*Detects:*\n` +
                SCAM_CATEGORIES.map(c => `• ${c.label}`).join('\n') + '\n\n' +
                `• \`.scamcheck <text>\` — test any text`
            ));
        }

        // ─── on ───
        if (sub === 'on') {
            antiscamData = loadData();
            if (!antiscamData.global || typeof antiscamData.global !== 'object') {
                antiscamData.global = { ...DEFAULT_GLOBAL };
            }
            antiscamData.global.enabled = true;
            saveData(antiscamData);
            return reply(fmt(`🕵️ *Anti-Scam: ON*\n\nAction: *${antiscamData.global.action}*\nI will scan every message for fraud patterns in ALL groups.`));
        }

        // ─── off ───
        if (sub === 'off') {
            antiscamData = loadData();
            if (!antiscamData.global || typeof antiscamData.global !== 'object') {
                antiscamData.global = { ...DEFAULT_GLOBAL };
            }
            antiscamData.global.enabled = false;
            saveData(antiscamData);
            return reply(fmt('🕵️ *Anti-Scam: OFF*\n\nAutomatic scam detection is now disabled globally.'));
        }

        // ─── delete (silent delete) ───
        if (sub === 'delete') {
            antiscamData = loadData();
            if (!antiscamData.global || typeof antiscamData.global !== 'object') {
                antiscamData.global = { ...DEFAULT_GLOBAL };
            }
            antiscamData.global.action = 'delete';
            saveData(antiscamData);
            return reply(fmt(`✅ Action set to *delete* globally.\n\nScam messages will be silently deleted.`));
        }

        // ─── warn (delete + warn) ───
        if (sub === 'warn') {
            antiscamData = loadData();
            if (!antiscamData.global || typeof antiscamData.global !== 'object') {
                antiscamData.global = { ...DEFAULT_GLOBAL };
            }
            antiscamData.global.action = 'delete+warn';
            saveData(antiscamData);
            return reply(fmt(`✅ Action set to *warn* globally.\n\nScam messages will be deleted and the sender warned.`));
        }

        // ─── kick (delete + kick) ───
        if (sub === 'kick') {
            antiscamData = loadData();
            if (!antiscamData.global || typeof antiscamData.global !== 'object') {
                antiscamData.global = { ...DEFAULT_GLOBAL };
            }
            antiscamData.global.action = 'kick';
            saveData(antiscamData);
            return reply(fmt(`✅ Action set to *kick* globally.\n\nScam messages will be deleted and the sender removed from the group.`));
        }

        return reply(fmt('Usage: `.antiscam on | off | delete | warn | kick | scamcheck <text>`'));
    },

    // ── Message event hook ────────────────────────────────────────────────────
    onMessage: async (sock, message, ctx) => {
        const { groupId, sender, isAdmin: ctxIsAdmin, isOwner: ctxIsOwner, isBotAdmin } = ctx;
        if (!groupId) return;

        const cfg = getGroupCfg(groupId);
        if (!cfg.enabled) return;
        if (ctxIsAdmin || ctxIsOwner) return; // exempt admins

        const text = extractText(message);
        if (!text || text.length < 15) return;

        const hit = detectScam(text);
        if (!hit) return;

        const senderNum = sender.split('@')[0];
        const action    = cfg.action;

        // Delete
        if (action === 'delete' || action === 'delete+warn' || action === 'kick') {
            if (isBotAdmin) {
                try { await sock.sendMessage(groupId, { delete: message.key }); } catch { /* ignore */ }
            }
        }

        // Warn / notify
        if (action === 'delete+warn' || action === 'warn') {
            try {
                await sock.sendMessage(groupId, {
                    text: fmt(
                        `🚨 *Scam Alert!*\n\n` +
                        `@${senderNum} — your message was flagged as a potential *${hit}*.\n\n` +
                        `⚠️ Sharing fraudulent content may result in removal.\n` +
                        `_If this was a mistake, admins can review._`
                    ),
                    mentions: [sender]
                });
            } catch { /* ignore */ }
        }

        // Kick
        if (action === 'kick' && isBotAdmin) {
            try {
                await sock.groupParticipantsUpdate(groupId, [sender], 'remove');
                await sock.sendMessage(groupId, {
                    text: fmt(
                        `🚫 @${senderNum} was *removed* for posting suspected *${hit}* content.\n\n` +
                        `_Protect your group — report scammers to authorities._`
                    ),
                    mentions: [sender]
                });
            } catch { /* ignore */ }
        }
    }
};

// ─── Backward-compatible named exports (for main.js integration) ────────────

async function antiscamCommand(sock, chatId, message, args) {
    const senderId = message.key.participant || message.key.remoteJid;

    // Reconstruct ctx from the arguments main.js provides
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const rawText = extractText(message).trim();
    const rawCmd = rawText.split(/\s+/)[0].replace(/^\./, '').toLowerCase();

    // scamcheck can work without full ctx
    if (rawCmd === 'scamcheck' || rawCmd === 'checkscam') {
        const checkText = args.join(' ');
        if (!checkText) return reply(fmt('❓ Provide text to check.\n\nExample: `.scamcheck I will double your investment`'));
        const hit = detectScam(checkText);
        if (hit) return reply(fmt(`🚨 *Scam Detected!*\n\nCategory: *${hit}*\n\n_The provided text matches a known scam pattern._`));
        return reply(fmt('✅ *No scam patterns detected.*\n\n_Text appears clean based on known patterns._'));
    }

    // For admin/owner checks, we need to resolve via sock
    let isOwner = false;
    let isAdminUser = false;
    try {
        isOwner = await isOwnerOrSudo(senderId, sock, chatId);
        if (!isOwner) {
            const participants = (await sock.groupMetadata(chatId)).participants || [];
            const botId = sock.user?.id || '';
            isAdminUser = participants.some((p) => {
                const pId = (p.id || '').split('@')[0];
                const senderNum = senderId.includes('@') ? senderId.split('@')[0] : senderId;
                return senderNum === pId && (p.admin === 'admin' || p.admin === 'superadmin');
            });
        }
    } catch { /* ignore */ }

    if (!isOwner && !isAdminUser) return reply(fmt('⛔ Only admins can configure antiscam.'));

    const globalCfg = getGlobalCfg();
    const sub = (args[0] || '').toLowerCase();

    // No sub-command → show status
    if (!sub) {
        return reply(fmt(
            `🕵️ *Anti-Scam Filter (Global)*\n\n` +
            `Status: ${globalCfg.enabled ? '✅ ON' : '❌ OFF'}\n` +
            `Action: *${globalCfg.action}*\n\n` +
            `*Commands:*\n` +
            `• \`.antiscam on\` — enable globally\n` +
            `• \`.antiscam off\` — disable globally\n` +
            `• \`.antiscam delete\` — delete msg (silent)\n` +
            `• \`.antiscam warn\` — delete + warn sender\n` +
            `• \`.antiscam kick\` — delete + kick sender\n\n` +
            `*Detects:*\n` +
            SCAM_CATEGORIES.map(c => `• ${c.label}`).join('\n') + '\n\n' +
            `• \`.scamcheck <text>\` — test any text`
        ));
    }

    if (sub === 'on') {
        antiscamData = loadData();
        if (!antiscamData.global || typeof antiscamData.global !== 'object') antiscamData.global = { ...DEFAULT_GLOBAL };
        antiscamData.global.enabled = true;
        saveData(antiscamData);
        return reply(fmt(`🕵️ *Anti-Scam: ON*\n\nAction: *${antiscamData.global.action}*\nI will scan every message for fraud patterns in ALL groups.`));
    }

    if (sub === 'off') {
        antiscamData = loadData();
        if (!antiscamData.global || typeof antiscamData.global !== 'object') antiscamData.global = { ...DEFAULT_GLOBAL };
        antiscamData.global.enabled = false;
        saveData(antiscamData);
        return reply(fmt('🕵️ *Anti-Scam: OFF*\n\nAutomatic scam detection is now disabled globally.'));
    }

    if (sub === 'delete') {
        antiscamData = loadData();
        if (!antiscamData.global || typeof antiscamData.global !== 'object') antiscamData.global = { ...DEFAULT_GLOBAL };
        antiscamData.global.action = 'delete';
        saveData(antiscamData);
        return reply(fmt(`✅ Action set to *delete* globally.\n\nScam messages will be silently deleted.`));
    }

    if (sub === 'warn') {
        antiscamData = loadData();
        if (!antiscamData.global || typeof antiscamData.global !== 'object') antiscamData.global = { ...DEFAULT_GLOBAL };
        antiscamData.global.action = 'delete+warn';
        saveData(antiscamData);
        return reply(fmt(`✅ Action set to *warn* globally.\n\nScam messages will be deleted and the sender warned.`));
    }

    if (sub === 'kick') {
        antiscamData = loadData();
        if (!antiscamData.global || typeof antiscamData.global !== 'object') antiscamData.global = { ...DEFAULT_GLOBAL };
        antiscamData.global.action = 'kick';
        saveData(antiscamData);
        return reply(fmt(`✅ Action set to *kick* globally.\n\nScam messages will be deleted and the sender removed from the group.`));
    }

    return reply(fmt('Usage: `.antiscam on | off | delete | warn | kick | scamcheck <text>`'));
}

async function handleScamDetection(sock, chatId, message, text, senderId) {
    if (!chatId.endsWith('@g.us')) return;
    if (message._moderationHandled) return;
    if (!text || text.trim().length < 15) return;

    const cfg = getGroupCfg(chatId);
    if (!cfg.enabled) return;

    const isMe = message.key.fromMe;
    if (isMe) return;

    const hit = detectScam(text);
    if (!hit) return;

    // Check if bot is admin and sender is not admin/owner
    let participants = [];
    try {
        participants = (await sock.groupMetadata(chatId)).participants || [];
    } catch { return; }

    const botId = sock.user?.id || '';
    const botLid = sock.user?.lid || '';

    const isBotAdmin = participants.some((p) => {
        const pId = (p.id || '').split('@')[0];
        const bId = botId.includes(':') ? botId.split(':')[0] : botId.includes('@') ? botId.split('@')[0] : botId;
        return bId === pId && (p.admin === 'admin' || p.admin === 'superadmin');
    });

    if (!isBotAdmin) return;

    // Check if sender is admin/owner
    const senderNum = senderId.split('@')[0];
    const senderIsAdmin = participants.some((p) => {
        const pId = (p.id || '').split('@')[0];
        return senderNum === pId && (p.admin === 'admin' || p.admin === 'superadmin');
    });

    if (senderIsAdmin) return;

    const action = cfg.action;

    // Delete
    if (action === 'delete' || action === 'delete+warn' || action === 'kick') {
        void sock.sendMessage(chatId, { delete: message.key }).catch(() => {});
    }

    // Warn
    if (action === 'delete+warn' || action === 'warn') {
        void sock.sendMessage(chatId, {
            text: `🚨 *Scam Alert!*\n\n@${senderNum} — your message was flagged as a potential *${hit}*.\n\n⚠️ Sharing fraudulent content may result in removal.\n_If this was a mistake, admins can review._`,
            mentions: [senderId],
        }).catch(() => {});
    }

    // Kick
    if (action === 'kick') {
        void sock.groupParticipantsUpdate(chatId, [senderId], 'remove').catch(() => {});
        void sock.sendMessage(chatId, {
            text: `🚫 @${senderNum} was *removed* for posting suspected *${hit}* content.`,
            mentions: [senderId],
        }).catch(() => {});
    }
}

// Export both the plugin interface and the named functions main.js expects
const pluginExport = module.exports;
pluginExport.antiscamCommand = antiscamCommand;
pluginExport.handleScamDetection = handleScamDetection;
pluginExport.detectScam = detectScam;
pluginExport.readState = loadData;
