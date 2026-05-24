const TelegramBot = require('node-telegram-bot-api');
const RouterOS = require('node-routeros').RouterOS;

// ======================================================
// TOKEN BOT TELEGRAM
// ======================================================

const TOKEN_BOT_KAMU = '8588037946:AAGTU5sILB3M6W0acPRmODRbco79oGkG3DM';

// ======================================================
// TELEGRAM BOT
// ======================================================

const bot = new TelegramBot(TOKEN_BOT_KAMU, {
    polling: true
});

// ======================================================
// ID TELEGRAM BOS
// ======================================================

const ID_TELEGRAM_SAYA = 7917320065;

// ======================================================
// SESSION TEKNISI
// ======================================================

const sesiTeknisi = {};

console.log('Bot RnBNET FINAL FIX berjalan...');

// ======================================================
// ERROR TELEGRAM
// ======================================================

bot.on('polling_error', (error) => {
    console.error('[TELEGRAM ERROR]', error.message);
});

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

    await bot.sendMessage(
        chatId,
        'Silakan pilih lokasi server untuk aktivasi pelanggan:',
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
            status: 'WAITING_FOR_NAME'
        };

        await bot.answerCallbackQuery(
            callbackQuery.id
        );

        await bot.editMessageText(
            `✅ Server: *${targetServer.toUpperCase()}*\n\nSilakan ketik *Nama Pelanggan* yang ingin diaktifkan:`,
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

    const username =
        msg.text
            ? msg.text.trim()
            : '';

    if (!username) return;

    if (username.startsWith('/')) return;

    const dataSesi = sesiTeknisi[chatId];

    if (
        !dataSesi ||
        dataSesi.status !== 'WAITING_FOR_NAME'
    ) {
        return;
    }

    // ======================================================
    // DATA TEKNISI
    // ======================================================

    const namaTeknisi =
        msg.from.first_name || 'Tanpa Nama';

    const usernameTeknisi =
        msg.from.username
            ? `@${msg.from.username}`
            : 'Tidak ada';

    delete sesiTeknisi[chatId];

    // ======================================================
    // LOADING MESSAGE
    // ======================================================

    const infoMsg = await bot.sendMessage(
        chatId,
        `⏳ Memproses *${username}* ...`,
        {
            parse_mode: 'Markdown'
        }
    );

    // ======================================================
    // CONFIG SERVER
    // ======================================================

    let host = '103.191.165.115';
    let port = 705;
    let user = 'berry';
    let pass = 'subang21';
    let serverLabel = 'Panglejar';

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

    // ======================================================
    // CONNECT ROUTEROS
    // ======================================================

    const api = new RouterOS({
        host: host,
        user: user,
        password: pass,
        port: port,
        timeout: 8
    });

    let isDone = false;

    const timeoutKoneksi = setTimeout(async () => {

        if (isDone) return;

        isDone = true;

        try {

            await bot.editMessageText(
                `❌ Timeout koneksi ke server ${serverLabel}`,
                {
                    chat_id: chatId,
                    message_id: infoMsg.message_id
                }
            );

            api.close();

        } catch (e) {}

    }, 10000);

    try {

        // ======================================================
        // CONNECT
        // ======================================================

        await api.connect();

        if (isDone) return;

        // ======================================================
        // CARI USER PPP
        // ======================================================

        const secrets = await api.write(
            '/ppp/secret/print'
        );

        const userObj = secrets.find(
            x =>
                x.name &&
                x.name.trim().toLowerCase() ===
                username.trim().toLowerCase()
        );

        // ======================================================
        // USER TIDAK ADA
        // ======================================================

        if (!userObj) {

            isDone = true;

            clearTimeout(timeoutKoneksi);

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
        // VALIDASI ID
        // ======================================================

        if (!userObj['.id']) {

            throw new Error(
                'PPP Secret ID tidak ditemukan'
            );

        }

        // ======================================================
        // AKTIFKAN HANYA 1 USER
        // ======================================================

        await api.write([
            '/ppp/secret/set',
            `=.id=${userObj['.id']}`,
            '=disabled=no'
        ]);

        // ======================================================
        // DELAY
        // ======================================================

        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );

        // ======================================================
        // ACTIVE USER
        // ======================================================

        const activeUsers = await api.write(
            '/ppp/active/print'
        );

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
            userObj['remote-address'] ||
            'Dynamic / Belum Online';

        let callerId =
            userObj['caller-id'] ||
            'Any MAC / Belum Online';

        const profilePelanggan =
            userObj.profile || 'default';

        if (activeUser) {

            ipAddress =
                activeUser.address || ipAddress;

            callerId =
                activeUser['caller-id'] || callerId;

        }

        // ======================================================
        // JAM
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

        const teksTeknisi =
            `✨ *RnB Network System Interface* ⚡️\n` +
            `----------------------------------\n` +
            `✅ *Status:* SUKSES\n` +
            `👤 *Pelanggan:* ${username}\n` +
            `🛜 *Paket:* ${profilePelanggan}\n` +
            `💻 *Server:* ${serverLabel}\n` +
            `🌐 *IP:* ${ipAddress}\n` +
            `🔒 *MAC:* ${callerId}\n` +
            `⏰ *Waktu:* ${waktuSederhana}`;

        // ======================================================
        // PESAN BOS
        // ======================================================

        const teksBos =
            `📢 *LAPORAN AKTIVASI*\n` +
            `👷 *Teknisi:* ${namaTeknisi} (${usernameTeknisi})\n` +
            `👤 *Pelanggan:* ${username}\n` +
            `💻 *Server:* ${serverLabel}\n` +
            `🌐 *IP:* ${ipAddress}`;

        // ======================================================
        // KIRIM MESSAGE
        // ======================================================

        isDone = true;

        clearTimeout(timeoutKoneksi);

        await bot.editMessageText(
            teksTeknisi,
            {
                chat_id: chatId,
                message_id: infoMsg.message_id,
                parse_mode: 'Markdown'
            }
        );

        await bot.sendMessage(
            ID_TELEGRAM_SAYA,
            teksBos,
            {
                parse_mode: 'Markdown'
            }
        );

        // ======================================================
        // CLOSE
        // ======================================================

        await api.close();

    }
    catch (err) {

        console.error(err);

        if (!isDone) {

            isDone = true;

            clearTimeout(timeoutKoneksi);

            await bot.editMessageText(
                `❌ Error MikroTik\n\n${err.message || err}`,
                {
                    chat_id: chatId,
                    message_id: infoMsg.message_id
                }
            );

        }

        try {
            await api.close();
        } catch (e) {}

    }

});