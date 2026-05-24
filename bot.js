const TelegramBot = require('node-telegram-bot-api');
const { RouterOSClient } = require('routeros-client');

// ======================================================
// TOKEN BOT
// ======================================================

const bot = new TelegramBot(
    '8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0',
    {
        polling: true
    }
);

// ======================================================
// ID TELEGRAM BOS
// ======================================================

const ID_TELEGRAM_SAYA = 7917320065;

// ======================================================
// SESSION
// ======================================================

const sesiTeknisi = {};

console.log('Bot RnBNET FINAL FIX berjalan...');

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
        'Silakan pilih lokasi server pelanggan:',
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

        const targetServer =
            data.replace('srv_', '');

        sesiTeknisi[chatId] = {
            server: targetServer,
            status: 'WAITING_USERNAME'
        };

        await bot.answerCallbackQuery(
            callbackQuery.id
        );

        bot.editMessageText(
            `✅ Server *${targetServer.toUpperCase()}* dipilih\n\nSilakan ketik username PPP pelanggan:`,
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

    if (!text) return;

    if (text.startsWith('/start')) return;

    const dataSesi = sesiTeknisi[chatId];

    if (!dataSesi) return;

    if (dataSesi.status !== 'WAITING_USERNAME') return;

    const username = text.trim();

    delete sesiTeknisi[chatId];

    // ======================================================
    // DATA TEKNISI
    // ======================================================

    const namaTeknisi =
        msg.from.first_name || 'Tanpa Nama';

    const usernameTeknisi =
        msg.from.username
            ? `@${msg.from.username}`
            : 'Tidak ada';

    // ======================================================
    // MESSAGE LOADING
    // ======================================================

    const infoMsg = await bot.sendMessage(
        chatId,
        `⏳ Memproses user *${username}* ...`,
        {
            parse_mode: 'Markdown'
        }
    );

    // ======================================================
    // SERVER CONFIG
    // ======================================================

    let host = '';
    let port = 8728;
    let user = 'berry';
    let pass = 'subang21';
    let serverLabel = '';

    if (dataSesi.server === 'perum') {

        host = '103.191.165.38';
        port = 8725;
        serverLabel = 'Perum';

    }
    else if (dataSesi.server === 'cibarola') {

        host = '103.191.165.115';
        port = 3155;
        serverLabel = 'Cibarola';

    }
    else if (dataSesi.server === 'sukamelang') {

        host = '103.191.165.126';
        port = 8728;
        pass = 'Subang21';
        serverLabel = 'Sukamelang';

    }
    else {

        host = '103.191.165.115';
        port = 705;
        serverLabel = 'Panglejar';

    }

    let api;

    try {

        // ======================================================
        // CONNECT
        // ======================================================

        api = new RouterOSClient({
            host,
            user,
            password: pass,
            port,
            timeout: 5000
        });

        const conn = await api.connect();

        // ======================================================
        // AMBIL PPP SECRET
        // ======================================================

        const secrets = await conn
            .menu('/ppp/secret')
            .get();

        const userObj = secrets.find(
            x =>
                x.name &&
                x.name.trim().toLowerCase() ===
                username.trim().toLowerCase()
        );

        // ======================================================
        // USER TIDAK DITEMUKAN
        // ======================================================

        if (!userObj) {

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

        // ======================================================
        // DEBUG
        // ======================================================

        console.log('PPP SECRET:', userObj);

        // ======================================================
        // VALIDASI .ID
        // ======================================================

        if (!userObj['.id']) {

            throw new Error(
                'PPP Secret .id tidak ditemukan'
            );

        }

        // ======================================================
        // AKTIFKAN HANYA 1 USER
        // ======================================================

        await conn.write(
            '/ppp/secret/set',
            [
                `=.id=${userObj['.id']}`,
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
        // AMBIL ACTIVE USER
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
        // DATA USER
        // ======================================================

        let ipAddress =
            userObj.remoteAddress ||
            userObj['remote-address'] ||
            'Dynamic / Belum Online';

        let callerId =
            userObj.callerId ||
            userObj['caller-id'] ||
            'Any MAC / Belum Online';

        const profilePelanggan =
            userObj.profile || 'default';

        const lastLogoutValue =
            userObj.lastLoggedOut ||
            userObj['last-logged-out'] ||
            userObj.lastLinkDownTime;

        const lastLogout =
            (!lastLogoutValue ||
            lastLogoutValue === 'jan/01/1970 00:00:00')
                ? 'Tidak ada riwayat'
                : lastLogoutValue;

        if (activeUser) {

            ipAddress =
                activeUser.address || ipAddress;

            callerId =
                activeUser.callerId || callerId;

        }

        // ======================================================
        // WAKTU
        // ======================================================

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
        // PESAN TEKNISI
        // ======================================================

        const teksUntukTeknisi =
            `✨ *RnB Network System Interface* ⚡️\n` +
            `----------------------------------\n` +
            `✅ *Status:* SUKSES\n` +
            `👤 *Pelanggan:* ${username}\n` +
            `🛜 *Paket:* ${profilePelanggan}\n` +
            `💻 *Server:* ${serverLabel}\n` +
            `🌐 *IP:* ${ipAddress}\n` +
            `🔒 *MAC:* ${callerId}\n` +
            `⏰ *Waktu:* ${waktuSederhana}\n` +
            `⏱️ *Last Logout:* ${lastLogout}\n` +
            `----------------------------------\n` +
            `📌 _Masa isolir telah dibuka_`;

        // ======================================================
        // PESAN BOS
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
        // SEND MESSAGE
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

        // ======================================================
        // CLOSE API
        // ======================================================

        await api.close();

    }
    catch (err) {

        console.error(err);

        await bot.editMessageText(
            `❌ Error MikroTik\n\n${err.message}`,
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