const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    {
        polling: true
    }
);

console.log('Bot Running...');

bot.onText(/\/enable (.+)/, async (msg, match) => {

    const chatId = msg.chat.id;
    const username = match[1].trim();

    let api;

    try {

        api = new RouterOSClient({
            host: '103.191.165.115',
            user: 'berry',
            password: 'subang21',
            port: 705,
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
                `❌ User "${username}" tidak ditemukan`
            );

            await api.close();

            return;
        }

        // Ambil ID yang benar
        const id = user.id;

        console.log('ENABLE USER:', username);
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
            `✅ PPP Secret "${username}" berhasil di-enable`
        );

        // Tutup koneksi
        await api.close();

    } catch (err) {

        console.log(err);

        bot.sendMessage(
            chatId,
            '⚠️ Error:\n' + err.message
        );

        if (api) {
            try {
                await api.close();
            } catch {}
        }
    }

});