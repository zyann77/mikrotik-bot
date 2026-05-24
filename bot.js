// ======================================================
// VALIDASI ID
// ======================================================

if (!userObj.id) {

    throw new Error(
        'PPP Secret ID tidak ditemukan'
    );

}

// ======================================================
// AKTIFKAN HANYA 1 USER
// ======================================================

await conn.write(
    '/ppp/secret/set',
    [
        `=.id=${userObj.id}`,
        '=disabled=no'
    ]
);