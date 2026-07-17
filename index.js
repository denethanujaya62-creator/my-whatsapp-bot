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
        const myNumber = "94756086474"; // <--- ඔයාගේ Bot Number එක මෙතනට දාන්න!
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
            
            await client.sendMessage(before.from, notification, {
                mentions: [deletedMsg.sender]
            });
        }
    }
});

// Bot commands සහ replies
client.on('message', async (msg) => {
    const text = msg.body.trim();
    const command = text.toLowerCase();

    // 1. AUTO REPLY & NEW BEAUTIFUL PHOTO MENU WITH NAME (.menu හෝ help ගැහුවාම)
    if (command === '.menu' || command === 'menu' || command === 'help' || command === 'hi' || command === 'hello') {
        
        // Menu එකත් එක්ක යවන්න ඕන Photo එකේ Link එක (මෙතනට ඔයාට කැමති Image Link එකක් දාන්න පුළුවන්)
        const imageUrl = 'https://raw.githubusercontent.com/wwebjs/webjs-site/main/static/img/whatsapp-web-js.png';
        
        const menuText = 
`╔══════════════════════╗
   🤖  *DENETH MD BOT*  🤖
╚══════════════════════╝

👋 *හෙලෝ! මම Deneth MD 24/7 ක්‍රියාකාරී WhatsApp Bot එකයි.*

📊 *BOT STATUS:* Active 🟢
⏰ *RUNTIME:* 24 Hours

👑 *【 MAIN COMMANDS / මෙනුව 】*

⚡ *.menu* 
└─ දැනට තියෙන සියලුම Commands බලාගැනීමට.

📸 *【 PROFILE TOOLS 】*

⚡ *.getdp @tag*
└─ Tag කරන කෙනාගේ Profile Picture එක Download කරගැනීමට.

⚡ *.getdp [Number]*
└─ Number එකක් දීලා DP එක ගැනීමට.
   *(උදා: .getdp 94771234567)*

📥 *【 DOWNLOAD TOOLS 】*

⚡ *.status* (Reply/Forward)
└─ ඔයාට ලැබෙන Status (Video/Image) එකක් Bot වෙත Forward කර, ඊට Reply එකක් ලෙස *.status* ලෙස යැවීමෙන් එය Download කරගත හැක.

🛡️ *【 SAFETY TOOLS 】*

🚫 *Anti-Delete (Auto)*
└─ ඕනෑම කෙනෙක් Chat එකට එවූ මැසේජ් එකක් Delete කලහොත්, Bot එය ස්වයංක්‍රීයව නැවත පෙන්වයි. (Command අවශ්‍ය නොවේ)

💡 *වැඩේ සුපිරියටම කරන්න, Commands නිවැරදිව පාවිච්චි කරන්න.*
───────────────────────`;
        
        try {
            // Internet එකෙන් Photo එක Load කරගන්නවා
            const media = await MessageMedia.fromUrl(imageUrl);
            // Photo එකත් එක්ක Text එක Caption එක විදිහට යවනවා
            await client.sendMessage(msg.from, media, { caption: menuText });
        } catch (error) {
            console.error('Menu Photo එක යවන්න බැරි වුණා:', error);
            // මොකක් හරි හේතුවකින් Photo එක Load නොවුනොත් සාමාන්‍ය විදිහට මැසේජ් එක විතරක් යවනවා
            await msg.reply(menuText);
        }
    }

    // 2. DP DOWNLOADER (.getdp @tag හෝ .getdp 9477xxxxxxx)
    if (command.startsWith('.getdp')) {
        let targetJid = '';
        
        if (msg.mentionedIds.length > 0) {
            targetJid = msg.mentionedIds[0];
        } else {
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

    // 3. STATUS DOWNLOADER
    if (msg.hasMedia && msg.isStatus === false) {
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
