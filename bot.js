const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot('8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0', { polling: true });
const ID_TELEGRAM_SAYA = 7917320065; 
const sesiTeknisi = {};

console.log('Bot RnBNET (Fitur Isolir Enable/Disable) Aktif...');

// TAHAP 1: PILIH SERVER
bot.onText(/\/start/, (msg) => {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: '🌐 Panglejar', callback_data: 'srv_panglejar' }, { text: '🏢 Perum', callback_data: 'srv_perum' }],
                [{ text: '🛰️ Cibarola', callback_data: 'srv_cibarola' }, { text: '🔥 Sukamelang', callback_data: 'srv_sukamelang' }]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, 'Pilih lokasi server:', opts);
});

// TAHAP 2: PILIH AKSI (ENABLE / DISABLE)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data.startsWith('srv_')) {
        const server = data.replace('srv_', '');
        sesiTeknisi[chatId] = { server };
        
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '✅ Hidupkan Pelanggan', callback_data: `act_enable_${server}` }],
                    [{ text: '❌ Matikan (Isolir)', callback_data: `act_disable_${server}` }]
                ]
            }
        };
        bot.editMessageText(`Server: *${server.toUpperCase()}*\nPilih Aksi:`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown', ...opts });
    } 
    
    // TAHAP 3: EKSEKUSI
    else if (data.startsWith('act_')) {
        const [_, action, server] = data.split('_');
        sesiTeknisi[chatId] = { server, action, status: 'WAITING_NAME' };
        bot.editMessageText(`Aksi: *${action.toUpperCase()}*\nSilakan ketik *Nama Pelanggan*:`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
    }
});

// TAHAP 4: PROSES MIKROTIK
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text || msg.text.startsWith('/')) return;
    const sesi = sesiTeknisi[chatId];
    if (!sesi || sesi.status !== 'WAITING_NAME') return;

    const username = msg.text.trim();
    const { server, action } = sesi;
    delete sesiTeknisi[chatId];

    const infoMsg = await bot.sendMessage(chatId, `⏳ Memproses *${action}* untuk *${username}*...`, { parse_mode: 'Markdown' });

    // Koneksi MikroTik
    let host = '103.191.165.115', port = 705, user = 'berry', pass = 'subang21';
    if(server === 'perum') { host = '103.191.165.38'; port = 8725; }
    else if(server === 'cibarola') { host = '103.191.165.115'; port = 3155; }
    else if(server === 'sukamelang') { host = '103.191.165.126'; port = 8728; pass = 'Subang21'; }

    try {
        const api = new RouterOSClient({ host, user, password: pass, port, timeout: 5 });
        const conn = await api.connect();

        const secrets = await conn.menu('/ppp/secret').get();
        const userFound = secrets.find(x => x.name === username);

        if (!userFound) {
            bot.editMessageText(`❌ User *${username}* tidak ditemukan!`, { chat_id: chatId, message_id: infoMsg.message_id, parse_mode: 'Markdown' });
            return await api.close();
        }

        // EKSEKUSI
        await conn.menu('/ppp/secret').set({ id: userFound.id, disabled: action === 'enable' ? 'no' : 'yes' });

        // JIKA DISABLE, KICK DARI ACTIVE CONNECTION
        if (action === 'disable') {
            const active = await conn.menu('/ppp/active').get();
            const activeUser = active.find(x => x.name === username);
            if (activeUser) {
                await conn.menu('/ppp/active').remove({ id: activeUser.id });
            }
        }

        bot.editMessageText(`✅ Berhasil *${action}* user *${username}* di server *${server.toUpperCase()}*`, { chat_id: chatId, message_id: infoMsg.message_id, parse_mode: 'Markdown' });
        
        // Notif ke Bos
        bot.sendMessage(ID_TELEGRAM_SAYA, `📢 *LAPORAN ISOLIR/AKTIVASI*\n👤 Teknisi: ${msg.from.first_name}\n💻 Aksi: ${action.toUpperCase()}\n👤 Pelanggan: ${username}\n🖥️ Server: ${server.toUpperCase()}`, { parse_mode: 'Markdown' });

        await api.close();
    } catch (err) {
        bot.sendMessage(chatId, `❌ Error: ${err.message}`);
    }
});
