const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// Deleted Messages Save කරගන්න Memory එකක්
const messageDatabase = {};

// Pairing Code එකක් Generate කිරීම
client.on('qr', async (qr) => {
    console.log('QR Code එකක් ලැබුණා, නමුත් අපි Pairing Code එකක් Generate කරනවා...');
    try {
        const myNumber = "9477XXXXXXX"; // <--- ඔයාගේ Bot Number එක මෙතනට දාන්න!
        const pairingCode = await client.requestPairingCode(myNumber);
        console.log('======================================');
        console.log(`YOUR WHATSAPP PAIRING CODE: ${pairingCode}`);
        console.log('======================================');
    } catch (err) {
        console.error('Pairing Code එක ගන්න බැරි වුණා:', err);
    }
});

client.on('ready', () => {
    console.log('නියමයි! Bot දැන් සාර්ථකව වැඩ කරනවා.');
});

// සෑම මැසේජ් එකක්ම Memory එකට Save කරගන්නවා (Anti-Delete සඳහා)
client.on('message_create', async (msg) => {
    messageDatabase[msg.id.id] = {
        body: msg.body,
        from: msg.from,
        sender: msg.author || msg.from,
        hasMedia: msg.hasMedia,
        timestamp: msg.timestamp
    };
});

// කවුරුහරි මැසේජ් එකක් Everyone Delete කළහොත් ක්‍රියාත්මක වන කොටස
client.on('message_revoke_everyone', async (after, before) => {
    if (before) {
        const deletedMsg = messageDatabase[before.id.id];
        if (deletedMsg) {
            let notification = `⚠️ *DELETE කළ මැසේජ් එකක් හමු විය!*\n\n`;
            notification += `👤 *එවූ පුද්ගලයා:* @${deletedMsg.sender.split('@')[0]}\n`;
            notification += `💬 *මැසේජ් එක:* ${deletedMsg.body || '[Media හෝ වෙනත් දෙයක්]'}`;
            
            // Bot ගේ Chat එකට හෝ Group එකට Notification එක යවයි
            await client.sendMessage(before.from, notification, {
                mentions: [deletedMsg.sender]
            });
        }
    }
});

// Bot commands සහ replies ක්‍රියාත්මක වන ප්‍රධාන කොටස
client.on('message', async (msg) => {
    const text = msg.body.trim();
    const command = text.toLowerCase();

    // 1. AUTO REPLY & MENU
    if (command === 'hi' || command === 'hello' || command === 'menu' || command === 'help') {
        const menuText = `👋 *හෙලෝ! මම ඔයාගේ 24/7 WhatsApp Bot.*\n\n` +
                         `🤖 *මගේ Commands පහතින් බලාගන්න:*\n\n` +
                         `📌 *.getdp @tag* - Tag කරන කෙනාගේ DP එක Download කරගන්න.\n` +
                         `📌 *.getdp number* - Number එක දීලා DP එක Download කරන්න (उदा: .getdp 94771234567)\n` +
                         `📌 *Status Download* - ඔයාට ඕනෙම Status එකක් Botට Forward කරන්න, Bot ඒක ඔයාට එවයි.\n` +
                         `📌 *Anti-Delete* - කවුරුහරි මැසේජ් එකක් Delete කලොත් මම ඒක ඔටෝ පෙන්වනවා.\n\n` +
                         `⚡ _Created by You_`;
        
        await msg.reply(menuText);
    }

    // 2. DP DOWNLOADER (.getdp @tag හෝ .getdp 9477xxxxxxx)
    if (command.startsWith('.getdp')) {
        let targetJid = '';
        
        // Tag කරලා තිබුණොත්
        if (msg.mentionedIds.length > 0) {
            targetJid = msg.mentionedIds[0];
        } else {
            // Number එකක් Type කරලා තිබුණොත්
            const num = text.replace('.getdp', '').trim();
            if (num) {
                targetJid = num.includes('@c.us') ? num : `${num}@c.us`;
            }
        }

        if (!targetJid) {
            return msg.reply('❌ කරුණාකර කෙනෙක්ව Tag කරන්න හෝ Number එකක් දෙන්න. (උදා: .getdp @name)');
        }

        try {
            msg.reply('🔄 Profile Picture එක ලබා ගනිමින් පවතී, කරුණාකර රැඳී සිටින්න...');
            const profilePicUrl = await client.getProfilePicUrl(targetJid);
            
            if (profilePicUrl) {
                const media = await MessageMedia.fromUrl(profilePicUrl);
                await client.sendMessage(msg.from, media, { caption: '📸 මෙන්න ඉල්ලපු Profile Picture එක!' });
            } else {
                msg.reply('❌ මේ ගිණුමට Profile Picture එකක් පොදුවේ දමා නැත.');
            }
        } catch (error) {
            console.error(error);
            msg.reply('❌ DP එක ලබා ගැනීමට නොහැකි විය. කරුණාකර අංකය නිවැරදිදැයි බලන්න.');
        }
    }

    // 3. STATUS DOWNLOADER (Forward කරපු Status වීඩියෝ/පින්තූර ඩවුන්ලෝඩ් කිරීම)
    // වෙනත් අයෙකුගේ Status එකක් Bot වෙත Forward කළ විට, Bot එය නැවත එවයි.
    if (msg.hasMedia && msg.isStatus === false) {
        // Chat එකකදී කෙලින්ම Forward කරන හෝ එවන ඕනෑම Media එකක් Bot හරහා නැවත ලබාගත හැක.
        if (text.toLowerCase() === '.status' || text.toLowerCase() === 'download') {
            try {
                const media = await msg.downloadMedia();
                await client.sendMessage(msg.from, media, { caption: '📥 මෙන්න ඔයාගේ Status/Media එක!' });
            } catch (error) {
                msg.reply('❌ Media එක Download කරගන්න අපහසු වුණා.');
            }
        }
    }
});

client.initialize();
