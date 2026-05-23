const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    {
        polling: true
    }
);

console.log('Bot 4-Server Running...');

bot.onText(/\/aktif (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;
    const inputParam = match[1].trim();
    
    const args = inputParam.split(' ');
    const username = args[0].trim();
    const targetServer = args[1] ? args[1].toLowerCase().trim() : 'panglejar';

    // Inisialisasi variabel default login global
    let hostMikrotik = '';
    let portMikrotik = 8728; 
    let userMikrotik = 'berry';
    let passMikrotik = 'subang21'; // Password default untuk Panglejar, Perum, Cibarola
    let serverLabel = '';

    // ROUTING MULTI-SERVER DENGAN KREDENSIAL KHUSUS SUKAMELANG
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
        passMikrotik = 'Subang21'; // PERBAIKAN: Menggunakan 'S' kapital khusus Sukamelang
    } else {
        // Default otomatis ke Panglejar
        hostMikrotik = '103.191.165.115';
        portMikrotik = 705; 
        serverLabel = 'Panglejar';
    }

    let api;

    try {

        // Menggunakan variabel user & password yang dinamis sesuai server target
        api = new RouterOSClient({
            host: hostMikrotik,
            user: userMikrotik,
            password: passMikrotik,
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

        // EKSEKUSI ENABLE
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
