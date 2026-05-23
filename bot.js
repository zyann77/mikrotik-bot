<?php
// ====================================================================
// CONFIGURATION
// ====================================================================
$TOKEN_BOT        = "8588037946:AAFbgeq3N_OcT_3ahZTGAYrXCwDzLw76sf0";
$ID_TELEGRAM_SAYA = 7917320065;

// File untuk menyimpan sesi sementara teknisi (karena PHP sifatnya stateless)
$SESSION_FILE = "sesi_teknisi.json";

// ====================================================================
// 1. MENERIMA DATA DARI TELEGRAM (WEBHOOK)
// ====================================================================
$content = file_get_contents("php://input");
$update  = json_decode($content, true);

if (!$update) {
    exit;
}

// Mengambil variabel dasar Telegram
$chatId          = isset($update['message']['chat']['id']) ? $update['message']['chat']['id'] : $update['callback_query']['message']['chat']['id'];
$text            = isset($update['message']['text']) ? trim($update['message']['text']) : '';
$callback_data   = isset($update['callback_query']['data']) ? $update['callback_query']['data'] : '';
$callback_id     = isset($update['callback_query']['id']) ? $update['callback_query']['id'] : '';
$message_id      = isset($update['callback_query']['message']['message_id']) ? $update['callback_query']['message']['message_id'] : (isset($update['message']['message_id']) ? $update['message']['message_id'] : '');
$first_name      = isset($update['message']['from']['first_name']) ? $update['message']['from']['first_name'] : $update['callback_query']['from']['first_name'];
$username_tele   = isset($update['message']['from']['username']) ? "@".$update['message']['from']['username'] : (isset($update['callback_query']['from']['username']) ? "@".$update['callback_query']['from']['username'] : 'Tidak ada');

// Load database sesi sementara
$sesi_db = file_exists($SESSION_FILE) ? json_decode(file_get_contents($SESSION_FILE), true) : [];

// ====================================================================
// TAHAP 1: TEKNISI KETIK /start -> MUNCULKAN 4 SERVER
// ====================================================================
if ($text === '/start') {
    unset($sesi_db[$chatId]); // Reset sesi lama jika ada
    file_put_contents($SESSION_FILE, json_encode($sesi_db));

    $keyboard = [
        'inline_keyboard' => [
            [
                ['text' => '🌐 Panglejar', 'callback_data' => 'srv_panglejar'],
                ['text' => '🏢 Perum', 'callback_data' => 'srv_perum']
            ],
            [
                ['text' => '🛰️ Cibarola', 'callback_data' => 'srv_cibarola'],
                ['text' => '🔥 Sukamelang', 'callback_data' => 'srv_sukamelang']
            ]
        ]
    ];

    kirimPesan($chatId, "Silakan pilih lokasi server untuk aktivasi pelanggan:", $keyboard);
    exit;
}

// ====================================================================
// TAHAP 2: MENANGKAP KLIK TOMBOL SERVER
// ====================================================================
if (strpos($callback_data, 'srv_') === 0) {
    $targetServer = str_replace('srv_', '', $callback_data);
    
    // Simpan pilihan server teknisi ke file JSON
    $sesi_db[$chatId] = [
        'server' => $targetServer,
        'status' => 'WAITING_FOR_NAME'
    ];
    file_put_contents($SESSION_FILE, json_encode($sesi_db));

    // Beri respon ke Telegram agar loading tombol hilang
    responCallback($callback_id);

    $serverLabel = ucfirst($targetServer);
    $teks = "✅ Terpilih: *Server $serverLabel*\n\nSilakan langsung ketik dan kirim *Nama Pelanggan* yang ingin diaktifkan:";
    
    editPesan($chatId, $message_id, $teks);
    exit;
}

// ====================================================================
// TAHAP 3: MENANGKAP NAMA PELANGGAN & EKSEKUSI MIKROTIK
// ====================================================================
if (!empty($text) && isset($sesi_db[$chatId]) && $sesi_db[$chatId]['status'] === 'WAITING_FOR_NAME') {
    $username     = $text;
    $targetServer = $sesi_db[$chatId]['server'];

    // Hapus sesi agar tidak double post
    unset($sesi_db[$chatId]);
    file_put_contents($SESSION_FILE, json_encode($sesi_db));

    // Kirim status loading ke teknisi
    $loading_text = "⏳ Sedang mengambil data & memproses *".$username."* ke server *".strtoupper($targetServer)."*...";
    $infoMsg = json_decode(kirimPesan($chatId, $loading_text), true);
    $info_msg_id = $infoMsg['result']['message_id'];

    // Data router kamu kemarin
    $hostMikrotik = ''; $portMikrotik = 8728; $userMikrotik = 'berry'; $passMikrotik = 'subang21'; $serverLabel = '';

    if ($targetServer === 'perum') {
        $hostMikrotik = '103.191.165.38'; $portMikrotik = 8725; $serverLabel = 'Perum';
    } else if ($targetServer === 'cibarola') {
        $hostMikrotik = '103.191.165.115'; $portMikrotik = 3155; $serverLabel = 'Cibarola';
    } else if ($targetServer === 'sukamelang') {
        $hostMikrotik = '103.191.165.126'; $portMikrotik = 8728; $serverLabel = 'Sukamelang'; $passMikrotik = 'Subang21';
    } else {
        $hostMikrotik = '103.191.165.115'; $portMikrotik = 705; $serverLabel = 'Panglejar';
    }

    // Inisialisasi RouterOS API PHP Class
    $API = new RouterosAPI();
    $API->timeout = 5;

    if ($API->connect($hostMikrotik, $userMikrotik, $passMikrotik, $portMikrotik)) {
        
        // Cari user di /ppp/secret
        $API->write('/ppp/secret/print', false);
        $API->write('?name=' . $username);
        $READ = $API->read();

        if (empty($READ)) {
            editPesan($chatId, $info_msg_id, "❌ User \"$username\" tidak ditemukan di server $serverLabel");
            $API->disconnect();
            exit;
        }

        $user_data = $READ[0];
        $internal_id = $user_data['.id'];

        // EKSEKUSI ENABLE: disabled=no
        $API->write('/ppp/secret/set', false);
        $API->write('=.id=' . $internal_id, false);
        $API->write('=disabled=no');
        $API->read();

        // Ambil info detail untuk laporan komplit kamu
        $ipAddress       = isset($user_data['remote-address']) ? $user_data['remote-address'] : 'Dynamic / Belum diset';
        $profilePelanggan= isset($user_data['profile']) ? $user_data['profile'] : 'default';
        $serviceType     = isset($user_data['service']) ? $user_data['service'] : 'any';
        $callerId        = isset($user_data['caller-id']) ? $user_data['caller-id'] : 'Lock MAC Kosong';
        $lastLinkDown    = isset($user_data['last-link-down-time']) ? $user_data['last-link-down-time'] : 'Tidak ada data';
        $comment         = isset($user_data['comment']) ? $user_data['comment'] : 'Tidak ada catatan';
        
        date_default_timezone_set('Asia/Jakarta');
        $waktuLengkap = date('l, d F Y, H:i:s') . ' WIB';

        // Susun template info sangat kumplit
        $teksInformasiKomplit = 
            "✨ *AKTIVASI USER LAYANAN RnBNET* ✨\n" .
            "--------------------------------------------------\n" .
            "🖥️ *Server / Wilayah :* Server $serverLabel\n" .
            "👤 *Nama Pelanggan  :* `$username`\n" .
            "🌐 *IP Address (Remote):* `$ipAddress`\n" .
            "🔒 *MAC Address Lock  :* `$callerId`\n" .
            "🚀 *Profile Paket    :* `$profilePelanggan`\n" .
            "🛠️ *Service Type    :* `$serviceType`\n" .
            "📝 *Keterangan/Comment:* `$comment`\n" .
            "⏳ *Last Link Down  :* `$lastLinkDown`\n" .
            "--------------------------------------------------\n" .
            "⚙️ *Status System    :* ✅ ENABLED (AKTIF)\n" .
            "👷 *Teknisi Eksekutor:* $first_name ($username_tele)\n" .
            "📅 *Waktu Eksekusi   :* $waktuLengkap\n" .
            "--------------------------------------------------";

        // 1. Update status sukses ke HP Teknisi
        editPesan($chatId, $info_msg_id, $teksInformasiKomplit);

        // 2. KIRIM NOTIFIKASI LIVE PANTUAN SANGAT KUMPLIT KE TELEGRAM PRIBADI KAMU
        kirimPesan($ID_TELEGRAM_SAYA, "📢 *LOG LIVE PANTUAN BOS*\n\n" . $teksInformasiKomplit);

        $API->disconnect();
    } else {
        editPesan($chatId, $info_msg_id, "❌ Gagal menyambung ke API MikroTik server $serverLabel");
    }
    exit;
}

// ====================================================================
// HELPER FUNCTIONS (CURL TELEGRAM API)
// ====================================================================
function kirimPesan($chatId, $text, $keyboard = null) {
    global $TOKEN_BOT;
    $url = "https://api.telegram.org/bot" . $TOKEN_BOT . "/sendMessage";
    $post_fields = ['chat_id' => $chatId, 'text' => $text, 'parse_mode' => 'Markdown'];
    if ($keyboard) { $post_fields['reply_markup'] = json_encode($keyboard); }
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $result = curl_exec($ch);
    curl_close($ch);
    return $result;
}

function editPesan($chatId, $message_id, $text) {
    global $TOKEN_BOT;
    $url = "https://api.telegram.org/bot" . $TOKEN_BOT . "/editMessageText";
    $post_fields = ['chat_id' => $chatId, 'message_id' => $message_id, 'text' => $text, 'parse_mode' => 'Markdown'];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);
}

function responCallback($callback_id) {
    global $TOKEN_BOT;
    $url = "https://api.telegram.org/bot" . $TOKEN_BOT . "/answerCallbackQuery";
    $post_fields = ['callback_query_id' => $callback_id];
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, 1);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $post_fields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_exec($ch);
    curl_close($ch);
}

// ====================================================================
// MIKROTIK ROUTEROS API CLASS Sederhana (Supaya tidak perlu include file luar)
// ====================================================================
class RouterosAPI {
    var $debug = false; var $error_no = 0; var $error_str = ''; var $timeout = 5; var $socket; var $connected = false;
    function connect($host, $username, $password, $port = 8728) {
        $this->socket = @fsockopen($host, $port, $this->error_no, $this->error_str, $this->timeout);
        if (!$this->socket) return false;
        $this->write('/login'); $res = $this->read(false);
        if (isset($res[0]['!trap'])) return false;
        if (isset($res[0]['=ret'])) {
            $chap_chal = pack('H*', $res[0]['=ret']);
            $chap_md5 = md5(chr(0) . $password . $chap_chal);
            $this->write('/login', false); $this->write('=name=' . $username, false); $this->write('=response=00' . $chap_md5);
            $res = $this->read();
            if (isset($res[0]['!trap'])) return false;
        }
        $this->connected = true; return true;
    }
    function disconnect() { if (is_resource($this->socket)) { fclose($this->socket); } $this->connected = false; }
    function write($command, $param = true) {
        if ($command) {
            $data = explode("\n", $command);
            foreach ($data as $com) {
                $com = trim($com);
                $this->sendWord($com);
            }
            if ($param) $this->sendWord('');
        }
    }
    function sendWord($word) {
        $length = strlen($word);
        if ($length < 0x80) echo fwrite($this->socket, chr($length));
        elseif ($length < 0x4000) { $length |= 0x8000; echo fwrite($this->socket, chr(($length >> 8) & 0xFF) . chr($length & 0xFF)); }
        fwrite($this->socket, $word);
    }
    function read($parse = true) {
        $res = array(); $STATUS = true;
        while ($STATUS) {
            $byte = ord(fread($this->socket, 1));
            if ($byte == 0) continue;
            if ($byte & 0x80) {
                if (($byte & 0xC0) == 0x80) $len = (($byte & 0x3F) << 8) + ord(fread($this->socket, 1));
                else return $res;
            } else $len = $byte;
            $word = ''; while (strlen($word) < $len) { $word .= fread($this->socket, $len - strlen($word)); }
            if ($word == '!done') $STATUS = false;
            else {
                if (preg_match("/^=([^=]+)=(.*)/s", $word, $matches)) {
                    $res[count($res) - 1][$matches[1]] = $matches[2];
                } elseif (preg_match("/^!(.*)/s", $word, $matches)) {
                    $res[] = array('!' . $matches[1] => '');
                }
            }
        }
        return $parse ? $res : $res;
    }
}
?>
