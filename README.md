WhatsApp AI Image Generator Bot

Pipeline lokal AI Image Generator berbasis WhatsApp yang mengintegrasikan **WhatsApp Web (`whatsapp-web.js`)**, **n8n Workflow**, **Ollama (`qwen2.5:1.5b`)**, dan **AUTOMATIC1111 Stable Diffusion WebUI (`dreamshaper_8`)**.

## Cara Cepat Menjalankan (Dari Download ZIP / Git Clone)

> **Prasyarat di Windows 10/11 (GPU NVIDIA direkomendasikan VRAM >= 4 GB):**
> - [Node.js LTS](https://nodejs.org/)
> - [Git](https://git-scm.com/downloads)
> - [Python 3.10](https://www.python.org/downloads/release/python-3106/) *(wajib versi 3.10 untuk Stable Diffusion WebUI)*
> - [Ollama](https://ollama.com/download)
> *(Jika belum terpasang, `SETUP.bat` juga menawarkan instalasi otomatis via `winget`.)*

### Langkah Menjalankan:
1. **Download ZIP** (atau `git clone`) lalu ekstrak foldernya.
2. Klik dua kali **`SETUP.bat`** (atau langsung klik dua kali **`JALANKAN_SEMUA.bat`** — otomatis menjalankan `SETUP.bat` jika baru pertama kali).
   `SETUP.bat` akan otomatis:
   - Menginstall dependensi `wa_bridge` & `n8n_app` (termasuk patch `whatsapp-web.js`).
   - Mengimpor & mengaktifkan workflow `workflows/pipeline-sains-data.json` ke `n8n_data/`.
   - Mengunduh model LLM `qwen2.5:1.5b` ke `ollama_models/`.
   - Mengkloning `AUTOMATIC1111/stable-diffusion-webui` (`v1.10.1`), membuat `webui-user.bat`, dan mengunduh checkpoint `dreamshaper_8.safetensors` (~2.1 GB).
3. Klik dua kali **`JALANKAN_SEMUA.bat`** untuk menyalakan keempat layanan (Ollama, Stable Diffusion WebUI, n8n, WhatsApp Bridge).
   *(Pada jalankan pertama, jendela Stable Diffusion WebUI akan menyiapkan virtual environment Python/PyTorch beberapa menit.)*
4. **Scan QR Code WhatsApp** yang muncul di jendela `[4/4] WhatsApp Bridge`.
5. Kirim pesan teks (atau foto + caption) ke bot:
   - Chat pribadi: langsung ketik prompt atau kirim gambar + caption.
   - Grup WhatsApp: awali prompt dengan `!img <prompt>`.
   - Ganti latar foto: kirim foto dengan caption mengandung kata `latar` atau `background` (misal: `ganti latar belakang taman`).

## Arsitektur Pipeline

1. **WhatsApp Bridge (`wa_bridge/bridge.js`)**: Menerima prompt teks maupun gambar + caption dari WhatsApp, mendekripsi foto HD & memproses compositing latar studio, lalu meneruskan payload ke webhook n8n (`http://127.0.0.1:5678/webhook/wa-txt2img`).
2. **n8n Workflow (`workflows/pipeline-sains-data.json`)**:
   - Deteksi gaya visual otomatis (*Photorealistic*, *Anime / Illustration*, *3D Render*, *Digital Painting*, *Cyberpunk Sci-Fi*).
   - Translasi & ekspansi prompt Indonesia -> Inggris via **Ollama** (`qwen2.5:1.5b` di `http://127.0.0.1:11434`).
   - Routing mode `txt2img` atau `img2img` ke **Stable Diffusion WebUI API** (`http://127.0.0.1:7860`).
   - Mengirim hasil gambar + metrik kembali ke `http://127.0.0.1:3000/send-image`.

## Struktur Repositori

- `SETUP.bat` — Skrip instalasi otomatis 1-klik untuk pengguna baru.
- `JALANKAN_SEMUA.bat` — Menjalankan 4 layanan utama (otomatis memicu `SETUP.bat` jika belum disiapkan).
- `start_ollama.bat`, `start_n8n.bat`, `start_wa.bat` — Launcher masing-masing layanan.
- `wa_bridge/` — Source code jembatan WhatsApp & server callback Express (`bridge.js`, `patch-wwebjs.js`).
- `n8n_app/` — Definisi dependensi lokal `n8n`.
- `workflows/pipeline-sains-data.json` — Definisi workflow 6-node n8n (tanpa data pribadi maupun riwayat eksekusi).
- `docs/webui-user.example.bat` — Contoh konfigurasi `webui-user.bat`.
- `.env.example` — Contoh override environment variable opsional untuk `wa_bridge`.

## Keamanan & Privasi

Folder berikut dibuat lokal saat dijalankan dan **wajib tetap diabaikan oleh `.gitignore`** agar tidak pernah terunggah ke GitHub:
- `wa_bridge/.wwebjs_auth/` & `wa_bridge/.wwebjs_cache/` (sesi login WhatsApp Web)
- `n8n_data/` (database SQLite n8n, akun pengguna, encryption key, dan riwayat eksekusi)
- `cache/`, `apps/`, `installers/`, `ollama_models/`, `stable-diffusion-webui/`, `**/node_modules/`
- `.env` serta file `*.sqlite`, `*.log`, `*.safetensors`, `*.ckpt`
