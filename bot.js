const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

// TOKEN BOT
const bot = new TelegramBot(
    'ISI_TOKEN_BOT_KAMU',
    { polling: true }
);

// ID TELEGRAM BOS
const ID_TELEGRAM_SAYA = 7917320065;

// SESSION TEKNISI
const sesiTeknisi = {};

console.log('Bot RnBNET FINAL ACTIVE USER berjalan...');

// ======================================================
// START
// ======================================================
bot.onText(/\/start/, async (msg) => {

    const chatId = msg.chat.id;

    delete sesiTeknisi[chatId];

    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '🌐 Panglejar',
                        callback_data: 'srv_panglejar'
                    },
                    {
                        text: '🏢 Perum',
                        callback_data: 'srv_perum'
                    }
                ],
                [
                    {
                        text: '🛰️ Cibarola',
                        callback_data: 'srv_cibarola'
                    },
                    {
                        text: '🔥 Sukamelang',
                        callback_data: 'srv_sukamelang'
                    }
                ]
            ]
        }
    };

    bot.sendMessage(
        chatId,
        'Silakan pilih server pelanggan:',
        opts
    );

});

// ======================================================
// CALLBACK BUTTON
// ======================================================
bot.on('callback_query', async (callbackQuery) => {

    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const data = callbackQuery.data;

    if (data.startsWith('srv_')) {

        const targetServer = data.replace('srv_', '');

        sesiTeknisi[chatId] = {
            server: targetServer,
            status: 'WAITING_USERNAME'
        };

        await bot.answerCallbackQuery(callbackQuery.id);

        let serverLabel =
            targetServer.charAt(0).toUpperCase() +
            targetServer.slice(1);

        bot.editMessageText(
            `✅ Server *${serverLabel}* dipilih\n\nKetik username PPP pelanggan:`,
            {
                chat_id: chatId,
                message_id: msg.message_id,
                parse_mode: 'Markdown'
            }
        );

    }

});

// ======================================================
// MESSAGE
// ======================================================
bot.on('message', async (msg) => {

    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/start')) return;

    const dataSesi = sesiTeknisi[chatId];

    if (!dataSesi) return;

    if (dataSesi.status !== 'WAITING_USERNAME') return;

    const username = text.trim();
    const targetServer = dataSesi.server;

    delete sesiTeknisi[chatId];

    const namaTeknisi =
        msg.from.first_name || 'Tanpa Nama';

    const usernameTeknisi =
        msg.from.username
            ? `@${msg.from.username}`
            : 'Tidak ada';

    const infoMsg = await bot.sendMessage(
        chatId,
        `⏳ Memproses user *${username}* ...`,
        {
            parse_mode: 'Markdown'
        }
    );

    let hostMikrotik = '';
    let portMikrotik = 8728;
    let userMikrotik = 'berry';
    let passMikrotik = 'subang21';
    let serverLabel = '';

    // ======================================================
    // SERVER
    // ======================================================

    if (targetServer === 'perum') {

        hostMikrotik = '103.191.165.38';
        portMikrotik = 8725;
        serverLabel = 'Perum';

    }
    else if (targetServer === 'cibarola') {

        hostMikrotik = '103.191.165.115';
        portMikrotik = 3155;
        serverLabel = 'Cibarola';

    }
    else if (targetServer === 'sukamelang') {

        hostMikrotik = '103.191.165.126';
        portMikrotik = 8728;
        passMikrotik = 'Subang21';
        serverLabel = 'Sukamelang';

    }
    else {

        hostMikrotik = '103.191.165.115';
        portMikrotik = 705;
        serverLabel = 'Panglejar';

    }

    let api;

    try {

        // ======================================================
        // CONNECT
        // ======================================================

        api = new RouterOSClient({
            host: hostMikrotik,
            user: userMikrotik,
            password: passMikrotik,
            port: portMikrotik,
            timeout: 5000
        });

        const conn = await api.connect();

        // ======================================================
        // GET SECRET
        // ======================================================

        const secrets = await conn
            .menu('/ppp/secret')
            .get();

        const user = secrets.find(
            x =>
                x.name &&
                x.name.trim().toLowerCase() ===
                username.trim().toLowerCase()
        );

        // ======================================================
        // USER TIDAK ADA
        // ======================================================

        if (!user) {

            await bot.editMessageText(
                `❌ User "${username}" tidak ditemukan di server ${serverLabel}`,
                {
                    chat_id: chatId,
                    message_id: infoMsg.message_id
                }
            );

            await api.close();

            return;

        }

        // DEBUG
        console.log('PPP SECRET:', user);

        // ======================================================
        // VALIDASI ID
        // ======================================================

        if (!user['.id']) {
            throw new Error(
                'PPP Secret tidak memiliki .id'
            );
        }

        // ======================================================
        // AKTIFKAN HANYA 1 USER
        // ======================================================

        await conn.write(
            '/ppp/secret/set',
            [
                `=.id=${user['.id']}`,
                '=disabled=no'
            ]
        );

        // ======================================================
        // DELAY
        // ======================================================

        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );

        // ======================================================
        // ACTIVE USER
        // ======================================================

        const activeUsers = await conn
            .menu('/ppp/active')
            .get();

        const activeUser = activeUsers.find(
            x =>
                x.name &&
                x.name.trim().toLowerCase() ===
                username.trim().toLowerCase()
        );

        // ======================================================
        // DATA
        // ======================================================

        let ipAddress =
            user.remoteAddress ||
            user['remote-address'] ||
            'Dynamic';

        let callerId =
            user.callerId ||
            user['caller-id'] ||
            'Any MAC';

        const profilePelanggan =
            user.profile || 'default';

        const lastLogoutValue =
            user.lastLoggedOut ||
            user['last-logged-out'] ||
            '-';

        const lastLogout =
            !lastLogoutValue ||
            lastLogoutValue === 'jan/01/1970 00:00:00'
                ? 'Belum ada'
                : lastLogoutValue;

        if (activeUser) {

            ipAddress =
                activeUser.address || ipAddress;

            callerId =
                activeUser.callerId || callerId;

        }

        const waktuSederhana =
            new Date().toLocaleTimeString(
                'id-ID',
                {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Asia/Jakarta'
                }
            ) + ' WIB';

        // ======================================================
        // MESSAGE TEKNISI
        // ======================================================

        const teksUntukTeknisi =
            `✨ *RnB Network System* ⚡️\n` +
            `----------------------------------\n` +
            `✅ *Status:* BERHASIL\n` +
            `👤 *Pelanggan:* ${username}\n` +
            `🛜 *Paket:* ${profilePelanggan}\n` +
            `💻 *Server:* ${serverLabel}\n` +
            `🌐 *IP:* ${ipAddress}\n` +
            `🔒 *MAC:* ${callerId}\n` +
            `⏰ *Waktu:* ${waktuSederhana}\n` +
            `⏱️ *Last Logout:* ${lastLogout}`;

        // ======================================================
        // MESSAGE BOS
        // ======================================================

        const teksUntukBos =
            `📢 *LAPORAN AKTIVASI*\n` +
            `👷 *Teknisi:* ${namaTeknisi} (${usernameTeknisi})\n` +
            `----------------------------------\n` +
            `👤 *Pelanggan:* ${username}\n` +
            `🛜 *Paket:* ${profilePelanggan}\n` +
            `💻 *Server:* ${serverLabel}\n` +
            `🌐 *IP:* ${ipAddress}\n` +
            `🔒 *MAC:* ${callerId}\n` +
            `⏰ *Waktu:* ${waktuSederhana}`;

        // ======================================================
        // SEND
        // ======================================================

        await bot.editMessageText(
            teksUntukTeknisi,
            {
                chat_id: chatId,
                message_id: infoMsg.message_id,
                parse_mode: 'Markdown'
            }
        );

        await bot.sendMessage(
            ID_TELEGRAM_SAYA,
            teksUntukBos,
            {
                parse_mode: 'Markdown'
            }
        );

        await api.close();

    }
    catch (error) {

        console.log(error);

        await bot.editMessageText(
            `❌ Error server ${serverLabel}\n\n${error.message}`,
            {
                chat_id: chatId,
                message_id: infoMsg.message_id
            }
        );

        if (api) {
            await api.close();
        }

    }

});