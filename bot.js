const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

// Token Bot kamu dari @BotFather
const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    { polling: true }
);

// ID Telegram kamu untuk memantau aktivitas teknisi
const ID_TELEGRAM_SAYA = 7917320065; 

// Penyimpanan sementara sesi server teknisi
const sesiTeknisi = {};

console.log('Bot RnBNET (Fix Last Logout Reader) Berhasil Berjalan...');

// ====================================================================
// TAHAP 1: TEKNISI PENCET /start -> MUNCULKAN 4 SERVER
// ====================================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    delete sesiTeknisi[chatId]; 

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🌐 Panglejar', callback_data: 'srv_panglejar' },
                    { text: '🏢 Perum', callback_data: 'srv_perum' }
                ],
                [
                    { text: '🛰️ Cibarola', callback_data: 'srv_cibarola' },
                    { text: '🔥 Sukamelang', callback_data: 'srv_sukamelang' }
                ]
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
        
        sesiTeknisi[chatId] = {
            server: targetServer,
            status: 'WAITING_FOR_NAME'
        };

        bot.answerCallbackQuery(callbackQuery.id);
        let serverLabel = targetServer.charAt(0).toUpperCase() + targetServer.slice(1);

        bot.editMessageText(`✅ Terpilih: *Server ${serverLabel}*\n\nSilakan langsung ketik dan kirim *Nama Pelanggan* yang ingin diaktifkan:`, {
            chat_id: chatId,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// ====================================================================
// TAHAP 3: MENANGKAP NAMA PELANGGAN & EKSEKUSI MIKROTIK
// ====================================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    const dataSesi = sesiTeknisi[chatId];

    if (dataSesi && dataSesi.status === 'WAITING_FOR_NAME') {
        const username = text.trim();
        const targetServer = dataSesi.server;
        
        // Ambil nama teknisi
        const namaTeknisi = msg.from.first_name || 'Tanpa Nama';
        const usernameTeknisi = msg.from.username ? `@${msg.from.username}` : 'Tidak ada';

        delete sesiTeknisi[chatId];

        // Kirim status Loading awal
        const infoMsg = await bot.sendMessage(chatId, `⏳ Sedang mengambil data & memproses *${username}* ke server *${targetServer.toUpperCase()}*...`, { parse_mode: 'Markdown' });

        let hostMikrotik = '';
        let portMikrotik = 8728; 
        let userMikrotik = 'berry';
        let passMikrotik = 'subang21';
        let serverLabel = '';

        if (targetServer === 'perum') {
            hostMikrotik = '103.191.165.38'; portMikrotik = 8725; serverLabel = 'Perum';
        } else if (targetServer === 'cibarola') {
            hostMikrotik = '103.191.165.115'; portMikrotik = 3155; serverLabel = 'Cibarola';
        } else if (targetServer === 'sukamelang') {
            hostMikrotik = '103.191.165.126'; portMikrotik = 8728; serverLabel = 'Sukamelang'; passMikrotik = 'Subang21';
        } else {
            hostMikrotik = '103.191.165.115'; portMikrotik = 705; serverLabel = 'Panglejar';
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

            // Ambil data PPP Secret
            const secrets = await conn.menu('/ppp/secret').get();
            const user = secrets.find(x => x.name === username);

            if (!user) {
                bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, {
                    chat_id: chatId,
                    message_id: infoMsg.message_id
                });
                await api.close();
                return;
            }

            // EKSEKUSI ENABLE DI MIKROTIK
            await conn.menu('/ppp/secret').set({
                id: user.id,
                disabled: 'no'
            });

            // Beri jeda 2 detik agar ONT pelanggan sempat dial-up
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Cek data di menu active connection
            const activeUsers = await conn.menu('/ppp/active').get();
            const activeUser = activeUsers.find(x => x.name === username);

            // Pengambilan data IP dan MAC
            let ipAddress = user.remoteAddress || user['remote-address'] || 'Dynamic / Belum Online';
            let callerId = user.callerId || user['caller-id'] || 'Any MAC / Belum Online';
            const profilePelanggan = user.profile || 'default';
            
            // PERBAIKAN PEMBACAAN LAST LOGOUT (Menyesuaikan camelCase objek 'lastLoggedOut')
            const lastLogoutValue = user.lastLoggedOut || user['last-logged-out'] || user.lastLinkDownTime;
            
            const lastLogout = (!lastLogoutValue || lastLogoutValue === 'jan/01/1970 00:00:00') 
                ? 'Tidak ada riwayat / Belum pernah login' 
                : lastLogoutValue;

            if (activeUser) {
                ipAddress = activeUser.address || ipAddress;
                callerId = activeUser.callerId || callerId;
            }

            // Format Waktu Sederhana (HH:mm:ss WIB)
            const waktuSederhana = new Date().toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                timeZone: 'Asia/Jakarta' 
            }) + ' WIB';

            // TEMPLATE REKAP RNB NETWORK (SUDAH FIX SEMUA DATA)
            const teksInformasiKomplit = 
                `✨ *RnB Network System Interface* ⚡️\n` +
                `-----------------------------------------------\n` +
                `📝 *Status Aktif :* SUKSES ✅\n` +
                `👤 *Pelanggan :* ${username}\n` +
                `🛜 *Paket :* ${profilePelanggan}\n` +
                `💻 *Server :* ${serverLabel.toUpperCase()}\n` +
                `🌐 *IP Address :* ${ipAddress}\n` +
                `🔒 *MAC Address :* ${callerId}\n` +
                `👷 *Teknisi :* ${namaTeknisi} (${usernameTeknisi})\n` +
                `⏰ *Waktu :* ${waktuSederhana}\n` +
                `⏱️ *Last Logout :* ${lastLogout}\n` +
                `-----------------------------------------------\n` +
                `📌 _Masa isolir telah dibuka, perintah dial ulang dikirim ke ONT_`;

            // 1. Kirim laporan ke chat teknisi
            bot.editMessageText(teksInformasiKomplit, {
                chat_id: chatId,
                message_id: infoMsg.message_id,
                parse_mode: 'Markdown'
            });

            // 2. Kirim laporan murni ke chat pribadi kamu
            bot.sendMessage(ID_TELEGRAM_SAYA, teksInformasiKomplit, { 
                parse_mode: 'Markdown' 
            });

            await api.close();

        } catch (error) {
            console.error('Error MikroTik:', error);
            bot.editMessageText(`❌ Terjadi error saat mengeksekusi perintah di server ${serverLabel}`, {
                chat_id: chatId,
                message_id: infoMsg.message_id
            });
            if (api) await api.close();
        }
    }
});
