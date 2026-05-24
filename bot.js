// ====================================================================
// TAHAP 3: EKSEKUSI MIKROTIK TUNGGAL (DENGAN PENANGANAN TIMEOUT KETAT)
// ====================================================================
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.text ? msg.text.trim() : '';
    if (!username || username.startsWith('/')) return;

    const dataSesi = sesiTeknisi[chatId];
    if (dataSesi && dataSesi.status === 'WAITING_FOR_NAME') {
        const namaTeknisi = msg.from.first_name || 'Tanpa Nama';
        const usernameTeknisi = msg.from.username ? `@${msg.from.username}` : 'Tidak ada';
        delete sesiTeknisi[chatId];

        const infoMsg = await bot.sendMessage(chatId, `⏳ Memproses *${username}* ke server *${dataSesi.server.toUpperCase()}*...`, { parse_mode: 'Markdown' });

        let host = '103.191.165.115', port = 705, user = 'berry', pass = 'subang21', serverLabel = 'Panglejar';
        if (dataSesi.server === 'perum') { host = '103.191.165.38'; port = 8725; serverLabel = 'Perum'; }
        else if (dataSesi.server === 'cibarola') { host = '103.191.165.115'; port = 3155; serverLabel = 'Cibarola'; }
        else if (dataSesi.server === 'sukamelang') { host = '103.191.165.126'; port = 8728; serverLabel = 'Sukamelang'; pass = 'Subang21'; }

        // Konfigurasi koneksi kaku dengan deteksi kegagalan cepat (timeout 5 detik)
        const api = new RouterOS({
            host: host,
            user: user,
            password: pass,
            port: port,
            timeout: 5,
            keepalive: false
        });

        // Buat pengaman tambahan agar script tidak hang jika library gagal memutus koneksi
        const koneksiMaksimal = setTimeout(() => {
            bot.editMessageText(`❌ Gagal terhubung ke Server ${serverLabel}: Batas waktu koneksi (Timeout) habis. Periksa port API / IP MikroTik Anda!`, { chat_id: chatId, message_id: infoMsg.message_id });
            try { api.close(); } catch(e){}
        }, 6000);

        try {
            await api.connect();
            clearTimeout(koneksiMaksimal); // Amankan, koneksi berhasil masuk sebelum 5 detik

            // 1. Cari user di Mikrotik
            const userQuery = await api.write(['/ppp/secret/print', `?name=${username}`]);
            
            if (!userQuery || userQuery.length === 0) {
                bot.editMessageText(`❌ User "${username}" tidak ditemukan di server ${serverLabel}`, { chat_id: chatId, message_id: infoMsg.message_id });
                await api.close();
                return;
            }

            const userObj = userQuery[0]; 
            const targetId = userObj['.id']; 

            // 2. Tembak AKTIF (Kunci ID Kaku agar tidak massal)
            await api.write([
                '/ppp/secret/set',
                `=.id=${targetId}`,
                '=disabled=no'
            ]);

            console.log(`[RnBNET] Sukses mengaktifkan user tunggal ID: ${targetId} (${username})`);

            // Jeda 2 detik biar ONT dial ulang
            await new Promise(resolve => setTimeout(resolve, 2000));

            const activeQuery = await api.write(['/ppp/active/print', `?name=${username}`]);
            const activeUser = activeQuery && activeQuery.length > 0 ? activeQuery[0] : null;

            let ipAddress = userObj['remote-address'] || 'Dynamic / Belum Online';
            let callerId = userObj['caller-id'] || 'Any MAC / Belum Online';
            const profilePelanggan = userObj['profile'] || 'default';
            const lastLogout = userObj['last-logged-out'] || 'Tidak ada riwayat / Belum pernah login';

            if (activeUser) {
                ipAddress = activeUser['address'] || ipAddress;
                callerId = activeUser['caller-id'] || callerId;
            }

            const waktuSederhana = new Date().toLocaleTimeString('id-ID', { 
                hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' 
            }) + ' WIB';

            const teksUntukTeknisi = 
                `✨ *RnB Network System Interface* ⚡️\n` +
                `-----------------------------------------------\n` +
                `📝 *Status Aktif :* SUKSES ✅\n` +
                `👤 *Pelanggan :* ${username}\n` +
                `🛜 *Paket :* ${profilePelanggan}\n` +
                `💻 *Server :* ${serverLabel.toUpperCase()}\n` +
                `🌐 *IP Address :* ${ipAddress}\n` +
                `🔒 *MAC Address :* ${callerId}\n` +
                `⏰ *Waktu :* ${waktuSederhana}\n` +
                `⏱️ *Last Logout :* ${lastLogout}\n` +
                `-----------------------------------------------\n` +
                `📌 _Masa isolir telah dibuka, perintah dial ulang dikirim ke ONT_`;

            const teksUntukBos = 
                `📢 *LAPORAN AKTIVASI TEKNISI*\n` +
                `👷 *Eksekutor :* ${namaTeknisi} (${usernameTeknisi})\n` +
                `-----------------------------------------------\n` +
                `✨ *RnB Network System Interface* ⚡️\n` +
                `📝 *Status :* SUKSES ✅\n` +
                `👤 *Pelanggan :* ${username}\n` +
                `🛜 *Paket :* ${profilePelanggan}\n` +
                `💻 *Server :* ${serverLabel.toUpperCase()}\n` +
                `🌐 *IP Address :* ${ipAddress}\n` +
                `🔒 *MAC Address :* ${callerId}\n` +
                `⏰ *Waktu :* ${waktuSederhana}\n` +
                `⏱️ *Last Logout :* ${lastLogout}\n` +
                `-----------------------------------------------`;

            bot.editMessageText(teksUntukTeknisi, { chat_id: chatId, message_id: infoMsg.message_id, parse_mode: 'Markdown' });
            bot.sendMessage(ID_TELEGRAM_SAYA, teksUntukBos, { parse_mode: 'Markdown' });

            await api.close();
        } catch (err) {
            clearTimeout(koneksiMaksimal);
            console.error('Error Detail:', err);
            bot.editMessageText(`❌ Error MikroTik: ${err.message || err}`, { chat_id: chatId, message_id: infoMsg.message_id });
            if (api) try { await api.close(); } catch(e){}
        }
    }
});
