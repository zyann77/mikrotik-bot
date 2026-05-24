const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot('8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0', { polling: true });
const ID_TELEGRAM_SAYA = 7917320065; 
const sesiTeknisi = {};

console.log('Bot RnBNET (FIX TOTAL 100% - AMAN) Berjalan...');

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
    bot.sendMessage(chatId, 'Silakan pilih lokasi server untuk aktivasi pelanggan:', opts);
});

bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('srv_')) {
        const targetServer = data.replace('srv_', '');
        sesiTeknisi[chatId] = { server: targetServer, status: 'WAITING_FOR_NAME' };
        bot.answerCallbackQuery(callbackQuery.id);
        bot.editMessageText(`✅ Server: *${targetServer.toUpperCase()}*\n\nSilakan ketik *Nama Pelanggan* yang ingin diaktifkan:`, { chat_id: chatId, message_id: msg.message_id, parse_mode: 'Markdown' });
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

        const infoMsg = await bot.sendMessage(chatId, `⏳ Memproses *${username}* ke server *${dataSesi.server.toUpperCase()}*...`, { parse_mode: 'Markdown' });

        let host = '103.191.165.115', port = 705, user = 'berry', pass = 'subang21', serverLabel = 'Panglejar';
        if (dataSesi.server === 'perum') { host = '103.191.165.38'; port = 8725; serverLabel = 'Perum'; }
        else if (dataSesi.server === 'cibarola') { host = '103.191.165.115'; port = 3155; serverLabel = 'Cibarola'; }
        else if (dataSesi.server === 'sukamelang') { host = '103.191.165.126'; port = 8728; serverLabel = 'Sukamelang'; pass = 'Subang21'; }

        let api;

        try {
            api = new RouterOSClient({ host, user, password: pass, port, timeout: 5 });
            const conn = await api.connect();

            // KUNCI UTAMA: Cari langsung pake filter query MikroTik (.pro())
            // Ini nge-filter langsung di sisi Router, jadi library ga bakal pusing ato nge-bug massal
            const pppMenu = conn.menu('/ppp/secret');
            const userFound = await pppMenu.where({ name: username }).get();

            // Jika array kosong atau user tidak ketemu
            if (!userFound || userFound.length === 0) {
                bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, { chat_id: chatId, message_id: infoMsg.message_id });
                await api.close();
                return;
            }

            // Ambil object user pertama dari hasil filter query
            const targetUser = userFound[0];

            // KUNCI EKSEKUSI TUNGGAL: Tembak via .set() pake ID murni yang dapet dari query di atas
            await pppMenu.set({
                id: targetUser.id,
                disabled: 'no'
            });

            console.log(`[RnBNET] Sukses mengaktifkan 1 user: ${username}`);

            // Jeda 2 detik biar ONT dial-up
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Ambil data active connection untuk ditarik IP dan MAC real-time
            const activeMenu = conn.menu('/ppp/active');
            const activeUsers = await activeMenu.where({ name: username }).get();
            const activeUser = activeUsers && activeUsers.length > 0 ? activeUsers[0] : null;

            let ipAddress = targetUser.remoteAddress || targetUser['remote-address'] || 'Dynamic / Belum Online';
            let callerId = targetUser.callerId || targetUser['caller-id'] || 'Any MAC / Belum Online';
            const profilePelanggan = targetUser.profile || 'default';
            
            const lastLogoutValue = targetUser.lastLoggedOut || targetUser['last-logged-out'] || targetUser.lastLinkDownTime;
            const lastLogout = (!lastLogoutValue || lastLogoutValue === 'jan/01/1970 00:00:00') 
                ? 'Tidak ada riwayat / Belum pernah login' 
                : lastLogoutValue;

            if (activeUser) {
                ipAddress = activeUser.address || ipAddress;
                callerId = activeUser.callerId || callerId;
            }

            const waktuSederhana = new Date().toLocaleTimeString('id-ID', { 
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' 
            }) + ' WIB';

            // Template rekap bersih untuk teknisi
            const teksUntukTeknisi = 
                `✨ *RnB Network System Interface* ⚡️\n` +
                `-----------------------------------------------\n` +
                `📝 *Status Aktif :* SUKSES ✅\n` +
                `👤 *Pelanggan :* ${username}\n` +
                `🛜 *Paket :* ${profilePelanggan}\n` +
                `💻 *Server :* ${serverLabel.toUpperCase()}\n` +
                `🌐 *IP Address :* ${ipAddress}\n` +
                `🔒 *MAC Address :* ${callerId}\n` +
                `⏰ *Waktu :* ${waktuSederhana}\n` +
                `⏱️ *Last Logout :* ${lastLogout}\n` +
                `-----------------------------------------------\n` +
                `📌 _Masa isolir telah dibuka, perintah dial ulang dikirim ke ONT_`;

            // Template rekap detail untuk kamu (Bos)
            const teksUntukBos = 
                `📢 *LAPORAN AKTIVASI TEKNISI*\n` +
                `👷 *Eksekutor :* ${namaTeknisi} (${usernameTeknisi})\n` +
                `-----------------------------------------------\n` +
                `✨ *RnB Network System Interface* ⚡️\n` +
                `📝 *Status :* SUKSES ✅\n` +
                `👤 *Pelanggan :* ${username}\n` +
                `🛜 *Paket :* ${profilePelanggan}\n` +
                `💻 *Server :* ${serverLabel.toUpperCase()}\n` +
                `🌐 *IP Address :* ${ipAddress}\n` +
                `🔒 *MAC Address :* ${callerId}\n` +
                `⏰ *Waktu :* ${waktuSederhana}\n` +
                `⏱️ *Last Logout :* ${lastLogout}\n` +
                `-----------------------------------------------`;

            bot.editMessageText(teksUntukTeknisi, { chat_id: chatId, message_id: infoMsg.message_id, parse_mode: 'Markdown' });
            bot.sendMessage(ID_TELEGRAM_SAYA, teksUntukBos, { parse_mode: 'Markdown' });

            await api.close();
        } catch (err) {
            console.error(err);
            bot.editMessageText(`❌ Error MikroTik: ${err.message}`, { chat_id: chatId, message_id: infoMsg.message_id });
            if (api) await api.close();
        }
    }
});
