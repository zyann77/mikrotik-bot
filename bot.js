const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot('8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0', { polling: true });
const ID_TELEGRAM_SAYA = 7917320065; 
const sesiTeknisi = {};

console.log('Bot RnBNET (FINAL FIX AKTIVASI TUNGGAL) Berjalan...');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    delete sesiTeknisi[chatId]; 
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🌐 Panglejar', callback_data: 'srv_panglejar' }, { text: '🏢 Perum', callback_data: 'srv_perum' }],
                [{ text: '🛰️ Cibarola', callback_data: 'srv_cibarola' }, { text: '🔥 Sukamelang', callback_data: 'srv_sukamelang' }]
            ]
        }
    };
    bot.sendMessage(chatId, 'Pilih server:', opts);
});

bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('srv_')) {
        const targetServer = data.replace('srv_', '');
        sesiTeknisi[chatId] = { server: targetServer, status: 'WAITING_FOR_NAME' };
        bot.answerCallbackQuery(callbackQuery.id);
        bot.editMessageText(`✅ Server: *${targetServer.toUpperCase()}*\nKetik *Nama Pelanggan*:`, { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' });
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.text ? msg.text.trim() : '';
    if (!username || username.startsWith('/')) return;

    const dataSesi = sesiTeknisi[chatId];
    if (dataSesi && dataSesi.status === 'WAITING_FOR_NAME') {
        const namaTeknisi = msg.from.first_name || 'Tanpa Nama';
        const usernameTeknisi = msg.from.username ? `@${msg.from.username}` : 'Tidak ada';
        delete sesiTeknisi[chatId];

        const infoMsg = await bot.sendMessage(chatId, `⏳ Memproses *${username}*...`, { parse_mode: 'Markdown' });

        let host = '103.191.165.115', port = 705, user = 'berry', pass = 'subang21', serverLabel = 'Panglejar';
        if (dataSesi.server === 'perum') { host = '103.191.165.38'; port = 8725; serverLabel = 'Perum'; }
        else if (dataSesi.server === 'cibarola') { host = '103.191.165.115'; port = 3155; serverLabel = 'Cibarola'; }
        else if (dataSesi.server === 'sukamelang') { host = '103.191.165.126'; port = 8728; serverLabel = 'Sukamelang'; pass = 'Subang21'; }

        try {
            const api = new RouterOSClient({ host, user, password: pass, port, timeout: 5 });
            const conn = await api.connect();

            const secrets = await conn.menu('/ppp/secret').get();
            const userObj = secrets.find(x => x.name === username);

            if (!userObj) {
                bot.editMessageText(`❌ User "${username}" tidak ditemukan!`, { chat_id: chatId, message_id: infoMsg.message_id });
                await api.close();
                return;
            }

            // KUNCI EKSEKUSI: MENGGUNAKAN .id UNIK AGAR TIDAK MASSAL
            const targetId = userObj['.id'];
            await conn.menu('/ppp/secret').update({
                '.id': targetId,
                'disabled': 'no'
            });

            await new Promise(resolve => setTimeout(resolve, 1500));

            const activeUsers = await conn.menu('/ppp/active').get();
            const activeUser = activeUsers.find(x => x.name === username);

            let ipAddress = userObj.remoteAddress || 'Dynamic';
            let callerId = userObj.callerId || 'Any';
            if (activeUser) {
                ipAddress = activeUser.address || ipAddress;
                callerId = activeUser.callerId || callerId;
            }

            const waktu = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
            
            const teksT = `✨ *RnB Network*\n📝 *Status:* SUKSES ✅\n👤 *Pelanggan:* ${username}\n🌐 *IP:* ${ipAddress}\n🔒 *MAC:* ${callerId}\n⏰ *Waktu:* ${waktu} WIB`;
            const teksB = `📢 *LAPORAN TEKNISI*\n👷 *Eksekutor:* ${namaTeknisi} (${usernameTeknisi})\n-----------------\n${teksT}`;

            bot.editMessageText(teksT, { chat_id: chatId, message_id: infoMsg.message_id, parse_mode: 'Markdown' });
            bot.sendMessage(ID_TELEGRAM_SAYA, teksB, { parse_mode: 'Markdown' });

            await api.close();
        } catch (err) {
            bot.editMessageText(`❌ Error MikroTik: ${err.message}`, { chat_id: chatId, message_id: infoMsg.message_id });
        }
    }
});
