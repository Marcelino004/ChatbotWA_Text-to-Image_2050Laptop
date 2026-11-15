const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const path = require('path');

const AUTH_DATA_PATH = process.env.WA_AUTH_PATH || path.join(__dirname, '.wwebjs_auth');
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://127.0.0.1:5678/webhook/wa-txt2img';
const BRIDGE_HOST = process.env.BRIDGE_HOST || '127.0.0.1';
const BRIDGE_PORT = Number(process.env.BRIDGE_PORT || 3000);

const app = express();
app.use(express.json({ limit: '100mb' }));

const botStartTime = Math.floor(Date.now() / 1000);
const sentByBotIds = new Set();
let isBusy = false;
let busyTimer = null;
let lastChatId = null;
let lastMsg = null;
let lastInputImageBase64 = null;
let lastOriginalPrompt = '';
let isBackgroundReplaceMode = false;

function setBusyState(state) {
    isBusy = state;
    if (busyTimer) {
        clearTimeout(busyTimer);
        busyTimer = null;
    }
    if (state) {
        busyTimer = setTimeout(() => {
            console.log('[INFO] Membuka kunci antrean otomatis (Timeout 90s).');
            isBusy = false;
        }, 90000);
    }
}

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: AUTH_DATA_PATH
    }),
    puppeteer: {
        timeout: 120000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('SCAN QR CODE INI MENGGUNAKAN WHATSAPP DI HP ANDA:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    try {
        await client.pupPage.evaluate(() => {
            if (window.WWebJS) {
                window.WWebJS.sendSeen = async () => true;
                if (window.WWebJS.processMediaData && !window.WWebJS._patchedMedia) {
                    const orig = window.WWebJS.processMediaData;
                    window.WWebJS.processMediaData = async function(...args) {
                        const r = await orig.apply(this, args);
                        if (r && typeof r === 'object') delete r.__x_id;
                        return r;
                    };
                    window.WWebJS._patchedMedia = true;
                }
            }
        });
    } catch (e) {}

    console.log('==============================================================');
    console.log('BOT WA KELOMPOK 4 SIAP! (KUALITAS HD STUDIO & ANTI-BLUR)');
    console.log('==============================================================');
});

// Dekripsi Langsung File Gambar Full-HD dari Server WhatsApp (Bukan Thumbnail Buram)
async function extractFullHDImage(msg) {
    const data = msg._data || {};

    // Metode 1: Dekripsi AES-256-CBC Langsung dari CDN WhatsApp (100% Kualitas HD Asli)
    if (data.directPath && data.mediaKey) {
        try {
            const mediaKeyBuf = Buffer.from(data.mediaKey, 'base64');
            const info = Buffer.from('WhatsApp Image Keys', 'utf8');
            const salt = Buffer.alloc(32, 0);
            const expandedKey = Buffer.from(crypto.hkdfSync('sha256', mediaKeyBuf, salt, info, 112));

            const iv = expandedKey.subarray(0, 16);
            const cipherKey = expandedKey.subarray(16, 48);

            const url = 'https://mmg.whatsapp.net' + data.directPath;
            const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
            const encBuf = Buffer.from(response.data);
            const fileBuf = encBuf.subarray(0, encBuf.length - 10);

            const decipher = crypto.createDecipheriv('aes-256-cbc', cipherKey, iv);
            const decrypted = Buffer.concat([decipher.update(fileBuf), decipher.final()]);
            console.log('[OK HD] Foto Resolusi Penuh berhasil didekripsi (' + Math.round(decrypted.length / 1024) + ' KB)');
            return decrypted.toString('base64');
        } catch (err) {
            console.warn('[WARN CDN DECRYPT]:', err.message);
        }
    }

    // Metode 2: Coba downloadMedia standar
    try {
        const mediaData = await msg.downloadMedia();
        if (mediaData && mediaData.data) {
            return mediaData.data;
        }
    } catch (e) {}

    // Metode 3: Fallback terakhir
    if (data.body) {
        return data.body.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    }
    return null;
}

client.on('message_create', async (msg) => {
    try {
        if (msg.timestamp && msg.timestamp < botStartTime) return;
        if (msg.from === 'status@broadcast' || msg.to === 'status@broadcast') return;
        if (msg.type !== 'chat' && msg.type !== 'image') return;

        const msgId = (msg.id && msg.id._serialized) ? msg.id._serialized : '';
        if (sentByBotIds.has(msgId)) return;

        const text = (msg.body || '').trim();

        if (
            text.startsWith('⏳') ||
            text.startsWith('⚠️') ||
            text.startsWith('✅') ||
            text.startsWith('*TUGAS KELOMPOK 4') ||
            text.includes('TUGAS KELOMPOK 4 - SAINS DATA') ||
            text.includes('Mode Pipeline:')
        ) {
            return;
        }

        if (text.length < 3) return;

        const chatId = msg.fromMe ? msg.to : msg.from;

        if (chatId.endsWith('@g.us') && !msg.fromMe && !text.toLowerCase().startsWith('!img')) {
            return;
        }

        if (isBusy) {
            console.log('[ANTREAN] Bot masih memproses gambar sebelumnya, tunggu sebentar...');
            return;
        }

        let rawPrompt = text.toLowerCase().startsWith('!img') ? text.slice(4).trim() : text;
        if (!rawPrompt) return;

        setBusyState(true);
        lastChatId = chatId;
        lastMsg = msg;
        lastOriginalPrompt = rawPrompt;
        lastInputImageBase64 = null;
        isBackgroundReplaceMode = false;

        let modeProses = 'txt2img';
        let promptUntukN8n = rawPrompt;
        let imgForN8n = null;

        if (msg.hasMedia && msg.type === 'image') {
            console.log('\n[1/3] MENGUNDUH FOTO RESOLUSI PENUH (HD) DARI WHATSAPP...');
            lastInputImageBase64 = await extractFullHDImage(msg);

            if (lastInputImageBase64) {
                const lowerP = rawPrompt.toLowerCase();
                if (lowerP.includes('latar') || lowerP.includes('background') || lowerP.includes('belakang')) {
                    isBackgroundReplaceMode = true;
                    modeProses = 'txt2img';

                    let lokasiBaru = rawPrompt
                        .replace(/tambahkan latar belakang/gi, '')
                        .replace(/ubah foto latar belakang/gi, '')
                        .replace(/ubah latar belakang menjadi/gi, '')
                        .replace(/ubah latar belakang sedang di/gi, '')
                        .replace(/ubah latar belakang/gi, '')
                        .replace(/ganti latar belakang/gi, '')
                        .replace(/ganti background/gi, '')
                        .replace(/sedang di/gi, '')
                        .trim();

                    if (lokasiBaru.toLowerCase().includes('kebun binatang')) {
                        promptUntukN8n = 'Pemandangan latar kebun binatang modern yang asri di siang hari dengan jerapah dan rusa di kejauhan, pepohonan hijau rindang, pagar kayu taman, cahaya matahari hangat, efek bokeh kamera DSLR';
                    } else if (lokasiBaru.toLowerCase().includes('taman')) {
                        promptUntukN8n = 'Pemandangan taman kota yang indah dan asri dengan pepohonan hijau, bunga warna-warni, jalan setapak taman, suasana cerah matahari pagi, efek bokeh fotografi DSLR';
                    } else {
                        promptUntukN8n = 'Pemandangan latar belakang ' + lokasiBaru + ' yang sangat indah, pencahayaan alami sinematik, efek bokeh kamera DSLR, tanpa orang di depan';
                    }
                } else {
                    modeProses = 'img2img';
                    // Kecilkan ke 512x512 khusus untuk input img2img agar ringan di VRAM 4GB
                    imgForN8n = await client.pupPage.evaluate(async (b64) => {
                        return await new Promise((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                const c = document.createElement('canvas');
                                c.width = 512; c.height = 512;
                                const ctx = c.getContext('2d');
                                const s = Math.max(512 / img.width, 512 / img.height);
                                ctx.drawImage(img, (512 - img.width * s) / 2, (512 - img.height * s) / 2, img.width * s, img.height * s);
                                resolve(c.toDataURL('image/png').split(',')[1]);
                            };
                            img.onerror = () => resolve(b64);
                            img.src = 'data:image/jpeg;base64,' + b64;
                        });
                    }, lastInputImageBase64);
                }
            }
        }

        console.log('[1/3] INPUT DITERIMA (' + (isBackgroundReplaceMode ? 'HD-BG-STUDIO' : modeProses.toUpperCase()) + '):', rawPrompt);

        const infoTunggu = isBackgroundReplaceMode
            ? '⏳ _Foto HD diterima! Merender latar baru di GPU & menyatukan subjek kualitas Studio HD..._'
            : (modeProses === 'img2img'
                ? '⏳ _Foto HD diterima! Memproses transformasi Image-to-Image di GPU..._'
                : '⏳ _Memproses pipeline NLP & merender gambar baru di GPU..._');

        const waitMsg = await client.sendMessage(chatId, infoTunggu, { sendSeen: false });
        if (waitMsg && waitMsg.id) {
            sentByBotIds.add(waitMsg.id._serialized);
        }

        console.log('[2/3] MENGIRIM KE WORKFLOW N8N...');
        await axios.post(N8N_WEBHOOK_URL, {
            chatId: chatId,
            prompt_asli: promptUntukN8n,
            mode: modeProses,
            input_image: imgForN8n,
            timestamp_masuk: Date.now()
        }, {
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
    } catch (err) {
        setBusyState(false);
        const detailErr = err.response ? ('HTTP ' + err.response.status) : err.message;
        console.error('[ERROR PIPELINE]:', detailErr);
        if (lastChatId) {
            const errMsg = await client.sendMessage(
                lastChatId,
                '⚠️ _Terjadi kendala koneksi (' + detailErr + '). Pastikan n8n aktif di port 5678._',
                { sendSeen: false }
            );
            if (errMsg && errMsg.id) sentByBotIds.add(errMsg.id._serialized);
        }
    }
});

app.post('/send-image', async (req, res) => {
    const {
        chatId,
        imageBase64,
        promptAsli,
        subjectTranslated,
        enrichedPrompt,
        detectedStyle,
        modeProses,
        waktuProses
    } = req.body;

    const targetChat = (chatId && typeof chatId === 'string' && chatId.includes('@')) ? chatId : lastChatId;
    console.log('[3/3] GAMBAR SELESAI DIRENDER! Memproses hasil akhir ke WhatsApp:', targetChat);

    try {
        let finalImageBase64 = imageBase64;
        let labelMode = (modeProses === 'img2img')
            ? '🖼️ Image-to-Image (Transformasi Foto)'
            : '✨ Text-to-Image (Sintesis Baru)';
        let resolusiLabel = '512x512 px (25 Steps)';

        // Pemrosesan Studio HD Background Replacement (Anti-Blur, Pelindung Topi Biru & Penghilang Halo Biru)
        if (isBackgroundReplaceMode && lastInputImageBase64) {
            labelMode = '🪄 Studio HD Background Replacement (AI Matting + Bokeh)';
            try {
                const compResult = await client.pupPage.evaluate(async (fgB64, bgB64) => {
                    const loadImg = (b64) => new Promise((resolve) => {
                        const i = new Image();
                        i.onload = () => resolve(i);
                        i.src = 'data:image/png;base64,' + b64;
                    });
                    const fgImg = await loadImg(fgB64);
                    const bgImg = await loadImg(bgB64);

                    // Pertahankan rasio asli foto pada resolusi HD (maksimal sisi terpanjang 960px)
                    const maxDim = 960;
                    const scale = Math.min(maxDim / fgImg.width, maxDim / fgImg.height, 1.5);
                    const W = Math.round(fgImg.width * scale);
                    const H = Math.round(fgImg.height * scale);

                    const canvas = document.createElement('canvas');
                    canvas.width = W; canvas.height = H;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(fgImg, 0, 0, W, H);

                    const fgData = ctx.getImageData(0, 0, W, H);
                    const d = fgData.data;

                    // Ambil profil warna latar studio dari beberapa titik tepi atas/kiri/kanan
                    const samplePoints = [
                        [10, 10], [Math.floor(W * 0.25), 10], [Math.floor(W * 0.5), 10],
                        [10, Math.floor(H * 0.4)], [10, Math.floor(H * 0.8)], [W - 10, 10]
                    ];
                    let sumR = 0, sumG = 0, sumB = 0;
                    for (const [sx, sy] of samplePoints) {
                        const idx = (sy * W + sx) * 4;
                        sumR += d[idx]; sumG += d[idx + 1]; sumB += d[idx + 2];
                    }
                    const bgR = sumR / samplePoints.length;
                    const bgG = sumG / samplePoints.length;
                    const bgB = sumB / samplePoints.length;

                    const distToBg = (r, g, b) => Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);

                    // 1. Flood-Fill Presisi Tinggi dengan Pelindung Batas Objek (Edge Barrier agar Topi Biru Aman)
                    const visited = new Uint8Array(W * H);
                    const isBg = new Uint8Array(W * H);
                    const queue = new Int32Array(W * H);
                    let head = 0, tail = 0;

                    const trySeed = (x, y) => {
                        const pos = y * W + x;
                        if (visited[pos]) return;
                        const idx = pos * 4;
                        if (distToBg(d[idx], d[idx + 1], d[idx + 2]) < 52) {
                            visited[pos] = 1;
                            isBg[pos] = 1;
                            queue[tail++] = pos;
                        }
                    };

                    for (let x = 0; x < W; x++) trySeed(x, 0);
                    for (let y = 0; y < H; y++) { trySeed(0, y); trySeed(W - 1, y); }

                    while (head < tail) {
                        const pos = queue[head++];
                        const x = pos % W;
                        const y = (pos - x) / W;
                        const cIdx = pos * 4;
                        const cR = d[cIdx], cG = d[cIdx + 1], cB = d[cIdx + 2];

                        const nPositions = [];
                        if (x > 0) nPositions.push(pos - 1);
                        if (x < W - 1) nPositions.push(pos + 1);
                        if (y > 0) nPositions.push(pos - W);
                        if (y < H - 1) nPositions.push(pos + W);

                        for (let i = 0; i < nPositions.length; i++) {
                            const np = nPositions[i];
                            if (!visited[np]) {
                                const nIdx = np * 4;
                                const nR = d[nIdx], nG = d[nIdx + 1], nB = d[nIdx + 2];
                                // Hanya merambat jika warna masih halus (stepDist < 16) dan dekat dengan warna latar (dist < 48)
                                const stepDist = Math.abs(nR - cR) + Math.abs(nG - cG) + Math.abs(nB - cB);
                                if (stepDist < 18 && distToBg(nR, nG, nB) < 48) {
                                    visited[np] = 1;
                                    isBg[np] = 1;
                                    queue[tail++] = np;
                                }
                            }
                        }
                    }

                    // 2. Hitung Jarak Tepi & Terapkan Color Decontamination (Hapus Garis/Halo Biru di Rambut & Baju)
                    const alphaMap = new Float32Array(W * H);
                    for (let i = 0; i < W * H; i++) {
                        alphaMap[i] = isBg[i] ? 0.0 : 1.0;
                    }

                    // Haluskan alpha (Feathering 2 lapis) & unmix warna biru di perbatasan subjek
                    const smoothAlpha = new Float32Array(W * H);
                    for (let y = 2; y < H - 2; y++) {
                        for (let x = 2; x < W - 2; x++) {
                            const pos = y * W + x;
                            let sumA = 0;
                            for (let dy = -2; dy <= 2; dy++) {
                                for (let dx = -2; dx <= 2; dx++) {
                                    sumA += alphaMap[(y + dy) * W + (x + dx)];
                                }
                            }
                            const avgA = sumA / 25.0;
                            smoothAlpha[pos] = avgA;

                            const idx = pos * 4;
                            if (avgA <= 0.05) {
                                d[idx + 3] = 0;
                            } else if (avgA < 0.98) {
                                // Rumus Adobe Color Unmixing: bersihkan kontaminasi warna biru latar dari piksel tepi
                                const a = Math.max(0.25, avgA);
                                d[idx]     = Math.min(255, Math.max(0, (d[idx]     - (1 - a) * bgR) / a));
                                d[idx + 1] = Math.min(255, Math.max(0, (d[idx + 1] - (1 - a) * bgG) / a));
                                d[idx + 2] = Math.min(255, Math.max(0, (d[idx + 2] - (1 - a) * bgB) / a));
                                d[idx + 3] = Math.round(Math.pow(avgA, 0.85) * 255);
                            } else {
                                // Bersihkan bias biru tipis pada helai rambut terluar
                                const nearBg = isBg[pos - 3] || isBg[pos + 3] || isBg[pos - 3 * W] || isBg[pos + 3 * W];
                                if (nearBg && d[idx + 2] > d[idx] + 30 && distToBg(d[idx], d[idx + 1], d[idx + 2]) < 75) {
                                    d[idx + 2] = Math.round((d[idx] + d[idx + 1]) / 2);
                                }
                                d[idx + 3] = 255;
                            }
                        }
                    }

                    // 3. Render Latar Belakang AI dengan Efek Bokeh Lembut (f/1.8 DSLR) & Rasio Penuh
                    const outCanvas = document.createElement('canvas');
                    outCanvas.width = W; outCanvas.height = H;
                    const outCtx = outCanvas.getContext('2d');

                    const bgScale = Math.max(W / bgImg.width, H / bgImg.height);
                    const bgW = bgImg.width * bgScale;
                    const bgH = bgImg.height * bgScale;
                    const bgX = (W - bgW) / 2;
                    const bgY = (H - bgH) / 2;

                    outCtx.filter = 'blur(2.5px) brightness(1.03)';
                    outCtx.drawImage(bgImg, bgX, bgY, bgW, bgH);
                    outCtx.filter = 'none';

                    // 4. Tempelkan Subjek Foto HD di Atas Latar Belakang
                    const fgCanvas = document.createElement('canvas');
                    fgCanvas.width = W; fgCanvas.height = H;
                    fgCanvas.getContext('2d').putImageData(fgData, 0, 0);
                    outCtx.drawImage(fgCanvas, 0, 0);

                    return {
                        b64: outCanvas.toDataURL('image/png').split(',')[1],
                        res: W + 'x' + H + ' px (HD Studio)'
                    };
                }, lastInputImageBase64, imageBase64);

                if (compResult && compResult.b64) {
                    finalImageBase64 = compResult.b64;
                    resolusiLabel = compResult.res;
                }
            } catch (compErr) {
                console.warn('[WARN COMPOSITE]:', compErr.message);
            }
        }

        await client.pupPage.evaluate(() => {
            if (window.WWebJS) {
                window.WWebJS.sendSeen = async () => true;
                if (window.WWebJS.processMediaData && !window.WWebJS._patchedMedia) {
                    const orig = window.WWebJS.processMediaData;
                    window.WWebJS.processMediaData = async function(...args) {
                        const r = await orig.apply(this, args);
                        if (r && typeof r === 'object') delete r.__x_id;
                        return r;
                    };
                    window.WWebJS._patchedMedia = true;
                }
            }
        });

        // Rapikan tampilan teks NLP agar tidak menampilkan kunci JSON mentah
        const cleanSubject = String(subjectTranslated || '-')
            .replace(/subject_en:/gi, '')
            .replace(/details_en:.*/gis, '')
            .trim();

        const media = new MessageMedia('image/png', finalImageBase64, 'hasil_kelompok4_hd.png');
        const caption = '*TUGAS KELOMPOK 4 - SAINS DATA*\n' +
                        '_Unstructured Data, NLP, LMM & Generative AI_\n\n' +
                        '🔄 *Mode Pipeline:* ' + labelMode + '\n' +
                        '📝 *Instruksi Pengguna:*\n"' + (lastOriginalPrompt || promptAsli || '-') + '"\n\n' +
                        '🎯 *Deteksi Subjek & Gaya (NLP):*\n' + cleanSubject + ' [' + (detectedStyle || 'Photorealistic') + ']\n\n' +
                        '🧠 *Ekspansi Prompt (LLM GPU):*\n"' + (enrichedPrompt || '-') + '"\n\n' +
                        '⚙️ *Detail Komputasi:*\n' +
                        '• Model: DreamShaper 8 (DPM++ 2M Karras)\n' +
                        '• Resolusi: ' + resolusiLabel + '\n' +
                        '• Waktu Proses: ' + (waktuProses || '-') + ' detik';

        let sentMsg;
        try {
            sentMsg = await client.sendMessage(targetChat, media, {
                caption: caption,
                sendSeen: false
            });
        } catch (sendErr) {
            if (lastMsg) {
                sentMsg = await lastMsg.reply(media, undefined, {
                    caption: caption,
                    sendSeen: false
                });
            } else {
                throw sendErr;
            }
        }

        if (sentMsg && sentMsg.id) {
            sentByBotIds.add(sentMsg.id._serialized);
        }

        console.log('[SUKSES] Gambar HD berhasil terkirim ke WhatsApp!\n');
        isBackgroundReplaceMode = false;
        setBusyState(false);
        res.json({ status: 'Terkirim' });
    } catch (err) {
        isBackgroundReplaceMode = false;
        setBusyState(false);
        console.error('[GAGAL KIRIM GAMBAR]:', err.message);
        res.status(500).json({ error: err.message });
    }
});

client.initialize();
app.listen(BRIDGE_PORT, BRIDGE_HOST, () => {
    console.log(`Server jembatan WA aktif di http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
});
