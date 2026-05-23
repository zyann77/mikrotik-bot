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

console.log('Bot RnBNET 4-Server (Fix No-Respon) Berhasil Berjalan...');

// ==========================================
// TAHAP 1: TEKNISI PENCET /start
// ==========================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    delete sesiTeknisi[chatId]; // Bersihkan sesi lama jika ada

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

// ==========================================
// TAHAP 2: MENANGKAP KLIK TOMBOL SERVER
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('srv_')) {
        const targetServer = data.replace('srv_', '');
        
        // Simpan data server pilihan ke memori
        sesiTeknisi[chatId] = {
            server: targetServer,
            status: 'WAITING_FOR_NAME'
        };

        bot.answerCallbackQuery(callbackQuery.id);
        let serverLabel = targetServer.charAt(0).toUpperCase() + targetServer.slice(1);

        // Edit pesan menu menjadi instruksi ketik nama
        bot.editMessageText(`✅ Terpilih: *Server ${serverLabel}*\n\nSilakan langsung ketik dan kirim *Nama Pelanggan* yang ingin diaktifkan:`, {
            chat_id: chatId,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// ==========================================
// TAHAP 3: MENANGKAP NAMA PELANGGAN & EKSEKUSI MIKROTIK
// ==========================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Abaikan jika pesan kosong, atau jika user mengetik /start
    if (!text || text.startsWith('/start')) return;

    const dataSesi = sesiTeknisi[chatId];

    // PASTIKAN HANYA MEMPROSES JIKA STATUSNYA SEDANG MENUNGGU NAMA
    if (dataSesi && dataSesi.status === 'WAITING_FOR_NAME') {
        const username = text.trim();
        const targetServer = dataSesi.server;
        const namaTeknisi = msg.from.first_name;
        const usernameTeknisi = msg.from.username ? `@${msg.from.username}` : 'Tidak ada';

        // Langsung hapus sesi agar tidak terjadi bentrok double input teks
        delete sesiTeknisi[chatId];

        // Kirim notifikasi awal (Loading) menggunakan sendMessage baru
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
                // Gunakan infoMsg.message_id untuk mengedit pesan loading milik bot sendiri
                bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, {
                    chat_id: chatId,
                    message_id: infoMsg.message_id
                });
                await api.close();
                return;
            }

            // Jalankan perintah ENABLE
            await conn.menu('/ppp/secret').set({
                id: user.id,
                disabled: 'no'
            });

            // Ambil variabel parameter komplit dari data rahasia MikroTik
            const ipAddress = user['remote-address'] || 'Dynamic / Belum diset';
            const profilePelanggan = user['profile'] || 'default';
            const serviceType = user['service'] || 'any';
            const callerId = user['caller-id'] || 'Lock MAC Kosong / Any MAC';
            const lastLinkDown = user['last-link-down-time'] || 'Tidak ada data';
            const comment = user['comment'] || 'Tidak ada catatan';

            // Set Format Waktu Sangat Komplit Indonesia (WIB)
            const opsiWaktu = { 
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
            };
            const waktuLengkap = new Date().toLocaleString('id-ID', { ...opsiWaktu, timeZone: 'Asia/Jakarta' });

            // Susun Teks Informasi Data Super Komplit
            const teksInformasiKomplit = 
                `✨ *AKTIVASI USER LAYANAN RnBNET* ✨\n` +
                `--------------------------------------------------\n` +
                `🖥️ *Server / Wilayah :* Server ${serverLabel}\n` +
                `👤 *Nama Pelanggan  :* \`${username}\`\n` +
                `🌐 *IP Address (Remote):* \`${ipAddress}\`\n` +
                `🔒 *MAC Address Lock  :* \`${callerId}\`\n` +
                `🚀 *Profile Paket    :* \`${profilePelanggan}\`\n` +
                `🛠️ *Service Type    :* \`${serviceType}\`\n` +
                `📝 *Keterangan/Comment:* \`${comment}\`\n` +
                `⏳ *Last Link Down  :* \`${lastLinkDown}\`\n` +
                `--------------------------------------------------\n` +
                `⚙️ *Status System    :* ✅ ENABLED (AKTIF)\n` +
                `工 *Teknisi Eksekutor:* ${namaTeknisi} (${usernameTeknisi})\n` +
                `📅 *Waktu Eksekusi   :* ${waktuLengkap}\n` +
                `--------------------------------------------------`;

            // 1. Edit pesan loading di chat teknisi menjadi Ringkasan Komplit
            bot.editMessageText(teksInformasiKomplit, {
                chat_id: chatId,
                message_id: infoMsg.message_id,
                parse_mode: 'Markdown'
            });

            // 2. Kirim laporan info komplit yang sama persis ke chat pribadi kamu (Bos)
            bot.sendMessage(ID_TELEGRAM_SAYA, `📢 *LOG LIVE PANTUAN BOS*\n\n${teksInformasiKomplit}`, { parse_mode: 'Markdown' });

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
