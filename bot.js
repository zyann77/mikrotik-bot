const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

// Token Bot kamu dari @BotFather
const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    { polling: true }
);

// ID Telegram kamu untuk memantau aktivitas teknisi
const ID_TELEGRAM_SAYA = 7917320065; 

// Penyimpanan sementara sesi server teknisi sebelum mengetik nama
const sesiTeknisi = {};

console.log('Bot RnBNET 4-Server (Full Code Fix) Berhasil Berjalan...');

// ====================================================================
// TAHAP 1: TEKNISI PENCET /start -> MUNCULKAN 4 SERVER DENGAN TAMPILAN RAPI
// ====================================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    delete sesiTeknisi[chatId]; // Bersihkan sesi lama jika ada yang menggantung

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
// TAHAP 2: MENANGKAP KLIK TOMBOL SERVER DARI TEKNISI
// ====================================================================
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

        bot.editMessageText(`✅ Terpilih: *Server ${serverLabel}*\n\nSilakan langsung ketik dan kirim *Nama Pelanggan* yang ingin diaktifkan:`, {
            chat_id: chatId,
            message_id: msg.message_id,
            parse_mode: 'Markdown'
        });
    }
});

// ====================================================================
// TAHAP 3: MENANGKAP NAMA PELANGGAN & EKSEKUSI MIKROTIK (INFO SANGAT KUMPLIT)
// ====================================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Abaikan jika pesan kosong, atau jika user mengetik perintah /start
    if (!text || text.startsWith('/start')) return;

    const dataSesi = sesiTeknisi[chatId];

    // Pastikan hanya memproses jika statusnya memang sedang menunggu nama pelanggan
    if (dataSesi && dataSesi.status === 'WAITING_FOR_NAME') {
        const username = text.trim();
        const targetServer = dataSesi.server;

        // Langsung hapus sesi agar tidak terjadi bentrok double input teks
        delete sesiTeknisi[chatId];

        // Kirim notifikasi awal (Loading) ke teknisi
        const infoMsg = await bot.sendMessage(chatId, `⏳ Sedang mengambil data & memproses *${username}* ke server *${targetServer.toUpperCase()}*...`, { parse_mode: 'Markdown' });

        // Konfigurasi IP, Port, dan Akun MikroTik berdasarkan server tujuan
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

            // Ambil data daftar PPP Secret
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

            // JALANKAN PERINTAH UTAMA MIKROTIK: disabled=no
            await conn.menu('/ppp/secret').set({
                id: user.id,
                disabled: 'no'
            });

            // Ambil parameter data pendukung dari MikroTik
            const profilePelanggan = user['profile'] || 'default';
            const lastLogoutValue = user['last-link-down-time'];
            
            // Cek jika riwayat logout kosong atau bawaan pabrik (1970)
            const lastLogout = (!lastLogoutValue || lastLogoutValue === 'jan/01/1970 00:00:00') 
                ? 'Tidak ada riwayat / Belum pernah login' 
                : lastLogoutValue;

            // Format jam menit detik saja (Contoh: 19:56:41 WIB)
            const waktuSederhana = new Date().toLocaleTimeString('id-ID', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                timeZone: 'Asia/Jakarta' 
            }) + ' WIB';

            // SUSUN TEMPLATE ANTARMUKA BARU SAMA PERSIS DENGAN BUKTI FOTO
            const teksInformasiKomplit = 
                `✨ *RnB Network System Interface* ⚡️\n` +
                `-----------------------------------------------\n` +
                `📝 *Status Aktif :* SUKSES ✅\n` +
                `👤 *Pelanggan :* ${username}\n` +
                `🛜 *Paket :* ${profilePelanggan}\n` +
                `💻 *Server :* ${serverLabel.toUpperCase()}\n` +
                `⏰ *Waktu :* ${waktuSederhana}\n` +
                `⏱️ *Last Logout :* ${lastLogout}\n` +
                `-----------------------------------------------\n` +
                `📌 _Masa isolir telah dibuka, perintah dial ulang dikirim ke ONT_`;

            // 1. Edit pesan loading di chat teknisi menjadi Ringkasan Komplit Premium
            bot.editMessageText(teksInformasiKomplit, {
                chat_id: chatId,
                message_id: infoMsg.message_id,
                parse_mode: 'Markdown'
            });

            // 2. KIRIM REKAP YANG SAMA PERSIS KE CHAT PRIBADI KAMU (MURNI TANPA LOG TAMBAHAN)
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
