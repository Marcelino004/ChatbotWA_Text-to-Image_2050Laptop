# Kelompok 4 - WhatsApp AI Image Generator Bot

Pipeline lokal AI Image Generator berbasis WhatsApp yang mengintegrasikan **WhatsApp Web (`whatsapp-web.js`)**, **n8n Workflow**, **Ollama (`qwen2.5:1.5b`)**, dan **AUTOMATIC1111 Stable Diffusion WebUI (`dreamshaper_8`)**.

## Arsitektur Pipeline

1. **WhatsApp Bridge (`wa_bridge/bridge.js`)**: Menerima prompt teks maupun gambar + caption dari WhatsApp, melakukan praproses input (termasuk dekripsi media HD & compositing background studio), lalu meneruskannya ke webhook n8n (`http://127.0.0.1:5678/webhook/wa-txt2img`).
2. **n8n Workflow (`workflows/pipeline-sains-data.json`)**:
   - Deteksi gaya visual otomatis (*Photorealistic*, *Anime / Illustration*, *3D Render*, *Digital Painting*, *Cyberpunk Sci-Fi*).
   - Translasi & ekspansi prompt Indonesia -> Inggris via **Ollama** (`qwen2.5:1.5b` di `http://127.0.0.1:11434`).
   - Routing mode `txt2img` atau `img2img` ke **Stable Diffusion WebUI API** (`http://127.0.0.1:7860`).
   - Mengirimkan gambar hasil + metrik kembali ke `http://127.0.0.1:3000/send-image`.

## Struktur Repositori

- `JALANKAN_SEMUA.bat` — Menjalankan 4 layanan utama (Ollama, Stable Diffusion WebUI, n8n, WhatsApp Bridge).
- `start_ollama.bat`, `start_n8n.bat`, `start_wa.bat` — Launcher masing-masing layanan.
- `wa_bridge/` — Source code jembatan WhatsApp & Express callback server (`bridge.js`, `patch-wwebjs.js`).
- `n8n_app/` — Definisi dependensi lokal `n8n`.
- `workflows/pipeline-sains-data.json` — Template workflow n8n siap impor (tanpa kredensial maupun riwayat eksekusi).
- `docs/webui-user.example.bat` — Contoh konfigurasi `webui-user.bat` untuk Stable Diffusion WebUI.

## Setup Instalasi (Fresh Clone)

### Prasyarat
- Windows 10/11 dengan GPU NVIDIA (direkomendasikan VRAM >= 4 GB)
- [Node.js LTS](https://nodejs.org/)
- [Python 3.10.6](https://www.python.org/)
- [Ollama](https://ollama.com/)
- [AUTOMATIC1111 Stable Diffusion WebUI](https://github.com/AUTOMATIC1111/stable-diffusion-webui)

### Langkah Setup
1. **Install dependensi Node.js**:
   ```cmd
   cd wa_bridge
   npm install

   cd ..\n8n_app
   npm install
   ```
   *(Skrip `postinstall` di `wa_bridge` otomatis menjalankan `patch-wwebjs.js`.)*

2. **Siapkan model Ollama**:
   ```cmd
   ollama pull qwen2.5:1.5b
   ```

3. **Siapkan Stable Diffusion WebUI**:
   - Clone `AUTOMATIC1111/stable-diffusion-webui` ke folder `stable-diffusion-webui/`.
   - Unduh checkpoint `dreamshaper_8.safetensors` ke `stable-diffusion-webui/models/Stable-diffusion/`.
   - Salin `docs/webui-user.example.bat` ke `stable-diffusion-webui/webui-user.bat` lalu sesuaikan path `PYTHON` bila perlu (pastikan flag `--api` aktif).

4. **Impor Workflow n8n**:
   - Jalankan `start_n8n.bat`, buka `http://localhost:5678`, buat akun lokal Anda, lalu impor `workflows/pipeline-sains-data.json` dan aktifkan (*Publish/Active*).

5. **Jalankan Semua Layanan & Scan QR WhatsApp**:
   - Jalankan `JALANKAN_SEMUA.bat`, lalu scan QR Code WhatsApp di terminal `[4/4] WhatsApp Bridge`.
   - Di chat pribadi, kirim prompt teks langsung atau kirim foto + caption. Di grup WhatsApp, awali pesan dengan `!img <prompt>`.

## Keamanan & Privasi

Folder berikut berisi sesi pribadi, database lokal, log, dependensi, atau file model berukuran besar sehingga **wajib tetap diabaikan oleh `.gitignore`** dan tidak pernah di-push ke GitHub:
- `wa_bridge/.wwebjs_auth/` & `wa_bridge/.wwebjs_cache/` (sesi login WhatsApp Web)
- `n8n_data/` (database SQLite n8n, akun pengguna, encryption key, dan riwayat eksekusi)
- `cache/`, `apps/`, `installers/`, `ollama_models/`, `stable-diffusion-webui/`, `**/node_modules/`
- `.env` dan file `*.sqlite`, `*.log`, `*.safetensors`, `*.ckpt`
