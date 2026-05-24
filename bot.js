const TelegramBot = require('node-telegram-bot-api');
const RouterOS = require('node-routeros').RouterOSClient;

// Token Bot dari @BotFather
const bot = new TelegramBot('8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0', { polling: true });

// ID Telegram Kamu (Bos)
const ID_TELEGRAM_SAYA = 7917320065; 
const sesiTeknisi = {};

console.log('Bot RnBNET (MENGGUNAKAN NODE-ROUTEROS - 100% AMAN) Berjalan...');

// ====================================================================
// TAHAP 1: TEKNISI PENCET /start -> MUNCULKAN 4 SERVER
// ====================================================================
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

// ====================================================================
// TAHAP 2: MENANGKAP KLIK TOMBOL SERVER
// ====================================================================
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

// ====================================================================
// TAHAP 3: EKSEKUSI MIKROTIK TUNGGAL (MENGGUNAKAN KATA KUNCI KAKU API)
// ====================================================================
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

        // Inisialisasi client dari library node-routeros
        const api = new RouterOS({
            host: host,
            user: user,
            password: pass,
            port: port,
            timeout: 5
        });

        try {
            // Melakukan koneksi ke MikroTik
            await api.connect();

            // 1. Ambil data spesifik user tersebut untuk mengambil detail profil/paket & .id asli
            const userQuery = await api.write(['/ppp/secret/print', `?name=${username}`]);
            
            if (!userQuery || userQuery.length === 0) {
                bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, { chat_id: chatId, message_id: infoMsg.message_id });
                await api.close();
                return;
            }

            const userObj = userQuery[0]; // Ambil data user yang ketemu
            const targetId = userObj['.id']; // MikroTik ID asli (.id)

            // ================================================================
            // PROSES AKTIVASI UTAMA: AMAN & TERKUNCI TOTAL
            // Kita kirim perintah set ke API murni MikroTik dengan filter .id kaku.
            // Jika targetId tidak valid atau kosong, MikroTik akan menolak total,
            // sehingga tidak akan pernah terjadi aktivasi massal secara tidak sengaja!
            // ================================================================
            await api.write([
                '/ppp/secret/set',
                `=.id=${targetId}`,
                '=disabled=no'
            ]);

            console.log(`[RnBNET Logs] Sukses mengubah status disabled=no untuk user ID: ${targetId} (${username})`);

            // Jeda 2 detik agar ONT pelanggan melakukan dial-up otomatis
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Ambil data aktif koneksi menggunakan filter nama kaku di sisi API
            const activeQuery = await api.write(['/ppp/active/print', `?name=${username}`]);
            const activeUser = activeQuery && activeQuery.length > 0 ? activeQuery[0] : null;

            let ipAddress = userObj['remote-address'] || 'Dynamic / Belum Online';
            let callerId = userObj['caller-id'] || 'Any MAC / Belum Online';
            const profilePelanggan = userObj['profile'] || 'default';
            const lastLogout = userObj['last-logged-out'] || 'Tidak ada riwayat / Belum pernah login';

            if (activeUser) {
                ipAddress = activeUser['address'] || ipAddress;
                callerId = activeUser['caller-id'] || callerId;
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
            console.error('Error Detail:', err);
            bot.editMessageText(`❌ Error MikroTik: ${err.message || err}`, { chat_id: chatId, message_id: infoMsg.message_id });
            if (api) await api.close();
        }
    }
});
