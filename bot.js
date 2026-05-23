const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

// Token Bot kamu dari @BotFather
const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    { polling: true }
);

// ID Telegram kamu untuk memantau aktivitas teknisi
const ID_TELEGRAM_SAYA = 7917320065; 

// Penyimpanan sementara untuk mengingat server yang dipilih teknisi sebelum mengetik nama
const sesiTeknisi = {};

console.log('Bot RnBNET 4-Server (Start -> Pilih Server -> Input Nama) Berhasil Berjalan...');

// ==========================================
// TAHAP 1: TEKNISI PENCET /start -> MUNCULKAN 4 SERVER
// ==========================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Hapus sesi lama jika ada proses yang menggantung
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

// ==========================================
// TAHAP 2: MENANGKAP KLIK TOMBOL SERVER
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    // Pastikan callback berasal dari tombol server (srv_)
    if (data.startsWith('srv_')) {
        const targetServer = data.replace('srv_', '');
        
        // Simpan server pilihan teknisi ke memori sementara
        sesiTeknisi[chatId] = {
            server: targetServer,
            status: 'WAITING_FOR_NAME'
        };

        bot.answerCallbackQuery(callbackQuery.id);

        // Format label server agar rapi (huruf pertama kapital)
        let serverLabel = targetServer.charAt(0).toUpperCase() + targetServer.slice(1);

        // Ubah teks tombol menjadi instruksi ketik nama
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

    // Abaikan jika pesan kosong atau berupa perintah /start
    if (!text || text.startsWith('/start')) return;

    const dataSesi = sesiTeknisi[chatId];

    // Cek apakah teknisi ini memang sedang di tahap mengirim nama pelanggan
    if (dataSesi && dataSesi.status === 'WAITING_FOR_NAME') {
        const username = text.trim();
        const targetServer = dataSesi.server;
        const namaTeknisi = msg.from.first_name;
        const usernameTeknisi = msg.from.username ? `@${msg.from.username}` : 'Tidak ada username';

        // Hapus status sesi agar tidak terjadi double input
        delete sesiTeknisi[chatId];

        // Kirim status loading awal ke teknisi yang sedang memproses
        const infoMsg = await bot.sendMessage(chatId, `⏳ Sedang memproses *${username}* ke server *${targetServer.toUpperCase()}*...`, { parse_mode: 'Markdown' });

        // Konfigurasi IP, Port, dan Akun MikroTik sesuai kepunyaan kamu
        let hostMikrotik = '';
        let portMikrotik = 8728; 
        let userMikrotik = 'berry';
        let passMikrotik = 'subang21';
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
            passMikrotik = 'Subang21'; // Password khusus Sukamelang huruf S besar
        } else {
            hostMikrotik = '103.191.165.115';
            portMikrotik = 705; 
            serverLabel = 'Panglejar';
        }

        let api;

        try {
            // Inisialisasi koneksi RouterOS API
            api = new RouterOSClient({
                host: hostMikrotik,
                user: userMikrotik,
                password: passMikrotik,
                port: portMikrotik,
                timeout: 5
            });

            const conn = await api.connect();

            // Ambil semua daftar PPP Secret
            const secrets = await conn.menu('/ppp/secret').get();
            const user = secrets.find(x => x.name === username);

            // Jika user tidak ditemukan di MikroTik
            if (!user) {
                bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, {
                    chat_id: chatId,
                    message_id: infoMsg.message_id
                });
                await api.close();
                return;
            }

            const id = user.id;

            console.log(`ENABLE USER [${serverLabel}]:`, username);
            console.log('ID:', id);

            // LOGIKA UTAMA: Mengubah disabled=no (Mengaktifkan User)
            await conn.menu('/ppp/secret').set({
                id: id,
                disabled: 'no'
            });

            // 1. Notifikasi sukses balik ke HP Teknisi
            bot.editMessageText(`✅ Sukses! Pelanggan *${username}* di server *${serverLabel.toUpperCase()}* berhasil diaktifkan.`, {
                chat_id: chatId,
                message_id: infoMsg.message_id,
                parse_mode: 'Markdown'
            });

            // 2. MONITORING LIVE: Kirim laporan ke chat pribadi kamu (Bos)
            bot.sendMessage(
                ID_TELEGRAM_SAYA,
                `📢 *PANTAUAN AKTIVASI MIKROTIK (RnBNET)*\n\n` +
                `👤 *Teknisi:* ${namaTeknisi} (${usernameTeknisi})\n` +
                `🖥️ *Lokasi Server:* Server ${serverLabel}\n` +
                `📌 *Nama Pelanggan:* ${username}\n` +
                `⏰ *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\n` +
                `Status: _User telah di-enable (Aktif)_`,
                { parse_mode: 'Markdown' }
            );

            // Tutup koneksi API
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
