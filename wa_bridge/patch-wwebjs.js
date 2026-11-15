const fs = require('fs');
const path = require('path');

const utilsPath = path.join(
    __dirname,
    'node_modules',
    'whatsapp-web.js',
    'src',
    'util',
    'Injected',
    'Utils.js'
);

if (!fs.existsSync(utilsPath)) {
    console.log('[patch-wwebjs] Utils.js belum tersedia, lewati patch.');
    process.exit(0);
}

let content = fs.readFileSync(utilsPath, 'utf8');
if (content.includes('delete mediaOptions.__x_id')) {
    console.log('[patch-wwebjs] Utils.js sudah ter-patch.');
    process.exit(0);
}

let updated = content.replace('...mediaOptions, __x_id: undefined,', '...mediaOptions,');
if (updated.includes('...mediaOptions,')) {
    updated = updated.replace('...mediaOptions,', '...(delete mediaOptions.__x_id, mediaOptions),');
    fs.writeFileSync(utilsPath, updated, 'utf8');
    console.log('[patch-wwebjs] Patch __x_id pada Utils.js berhasil diterapkan.');
} else {
    console.log('[patch-wwebjs] Pola ...mediaOptions tidak ditemukan, tidak ada perubahan.');
}
