const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    {
        polling: true
    }
);

console.log('Bot 4-Server dengan Menu Tombol Running...');

// 1. MENANGKAP PERINTAH UTAMA: /aktif [nama_user]
bot.onText(/\/aktif (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const username = match[1].trim();

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🌐 Panglejar', callback_data: `aktif_panglejar:${username}` },
                    { text: '🏢 Perum', callback_data: `aktif_perum:${username}` }
                ],
                [
                    { text: '🛰️ Cibarola', callback_data: `aktif_cibarola:${username}` },
                    { text: '🔥 Sukamelang', callback_data: `aktif_sukamelang:${username}` }
                ]
            ]
        }
    };

    bot.sendMessage(chatId, `Silakan pilih server untuk mengaktifkan user *${username}*:`, { parse_mode: 'Markdown', ...opts });
});

// 2. MENANGKAP KLIK DARI TOMBOL PILIHAN SERVER
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    const [serverAction, username] = data.split(':');
    const targetServer = serverAction.replace('aktif_', '');

    bot.answerCallbackQuery(callbackQuery.id);

    bot.editMessageText(`⏳ Sedang memproses *${username}* ke server *${targetServer.toUpperCase()}*...`, {
        chat_id: chatId,
        message_id: msg.message_id,
        parse_mode: 'Markdown'
    });

    let hostMikrotik = '';
    let portMikrotik = 8728; 
    let userMikrotik = 'berry';
    let passMikrotik = 'subang21';[cite: 1]
    let serverLabel = '';

    if (targetServer === 'perum') {
        hostMikrotik = '103.191.165.38';
        portMikrotik = 8725;
        serverLabel = 'Perum';
    } else if (targetServer === 'cibarola') {
        hostMikrotik = '103.191.165.115';
        portMikrotik = 3155; 
        serverLabel = 'Cibarola';
    } else if (targetServer === 'sukamelang') {
        hostMikrotik = '103.191.165.126'; 
        portMikrotik = 8728; 
        serverLabel = 'Sukamelang';
        passMikrotik = 'Subang21';[cite: 1]
    } else {
        hostMikrotik = '103.191.165.115';
        portMikrotik = 705; 
        serverLabel = 'Panglejar';
    }

    let api;

    try {
        api = new RouterOSClient({
            host: hostMikrotik,
            user: userMikrotik,
            password: passMikrotik,
            port: portMikrotik,
            timeout: 5
        });

        const conn = await api.connect();

        const secrets = await conn.menu('/ppp/secret').get();
        const user = secrets.find(x => x.name === username);

        if (!user) {
            bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, {
                chat_id: chatId,
                message_id: msg.message_id
            });
            await api.close();
            return;
        }

        const id = user.id;

        console.log(`ENABLE USER [${serverLabel}]:`, username);
        console.log('ID:', id);

        await conn.menu('/ppp/secret').update({ disabled: 'no' }, id);

        // --- BAGIAN EDIT TEKS BALASAN LEBIH KEREN & DILENGKAPI JAM ---
        const sekarang = new Date();
        const jam = String(sekarang.getHours()).padStart(2, '0');
        const menit = String(sekarang.getMinutes()).padStart(2, '0');
        const detik = String(sekarang.getSeconds()).padStart(2, '0');
        const waktuOn = `${jam}:${menit}:${detik} WIB`;

        const teksSukses = 
            `🟢 *RnBNET NETWORK SYSTEM INTERFACE*\n` +
            `-----------------------------------------------\n` +
            `📝 *Status* : Sukses Diaktifkan\n` +
            `👤 *Pelanggan* : \`${username}\`\n` +
            `🚀 *Server* : ${serverLabel.toUpperCase()}\n` +
            `⏰ *Waktu ON* : \`${waktuOn}\`\n` +
            `-----------------------------------------------\n` +
            `⚡ _Masa isolir telah dibuka, koneksi dial PPPoE kembali normal._`;

        bot.editMessageText(teksSukses, {
            chat_id: chatId,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
        });

        await api.close();

    } catch (err) {
        console.log(err);
        bot.editMessageText(`⚠️ Error [${serverLabel}]:\n` + err.message, {
            chat_id: chatId,
            message_id: msg.message_id
        });

        if (api) {
            try { await api.close(); } catch {}
        }
    }
});
