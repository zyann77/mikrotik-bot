const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    {
        polling: true
    }
);

console.log('Bot Running...');

// Menerima perintah /aktif [nama] [server]
bot.onText(/\/aktif (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;
    const inputParam = match[1].trim();
    
    // Memisahkan nama user dan nama server berdasarkan spasi
    const args = inputParam.split(' ');
    const username = args[0].trim();
    const targetServer = args[1] ? args[1].toLowerCase().trim() : 'panglejar';

    // Default setting menggunakan data Panglejar asli Anda yang sudah sukses 100%
    let hostMikrotik = '103.191.165.115';
    let portMikrotik = 705;
    let serverLabel = 'Panglejar';

    // Logika pengalihan khusus untuk server Perum
    if (targetServer === 'perum') {
        hostMikrotik = '103.191.165.38';
        portMikrotik = 8725;
        serverLabel = 'Perum';
    }

    let api;

    try {

        // Konfigurasi RouterOSClient otomatis mengikuti server target
        api = new RouterOSClient({
            host: hostMikrotik,
            user: 'berry',
            password: 'subang21',
            port: portMikrotik,
            timeout: 5
        });

        const conn = await api.connect();

        // Ambil semua PPP Secret
        const secrets = await conn.menu('/ppp/secret').get();

        // Cari EXACT username
        const user = secrets.find(
            x => x.name === username
        );

        // Jika tidak ditemukan
        if (!user) {

            bot.sendMessage(
                chatId,
                `❌ User "${username}" tidak ditemukan di server ${serverLabel}`
            );

            await api.close();

            return;
        }

        // Ambil ID yang benar
        const id = user.id;

        console.log(`ENABLE USER [${serverLabel}]:`, username);
        console.log('ID:', id);

        // ENABLE USER
        await conn.menu('/ppp/secret').update(
            {
                disabled: 'no'
            },
            id
        );

        bot.sendMessage(
            chatId,
            `✅ PPP Secret "${username}" berhasil di-enable di server ${serverLabel}`
        );

        // Tutup koneksi
        await api.close();

    } catch (err) {

        console.log(err);

        bot.sendMessage(
            chatId,
            `⚠️ Error [${serverLabel}]:\n` + err.message
        );

        if (api) {
            try {
                await api.close();
            } catch {}
        }
    }

});
