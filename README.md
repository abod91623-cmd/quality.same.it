# TikTok Video Optimizer

A fully **client-side** web app that re-encodes videos with TikTok-friendly export
settings — high bitrate H.264, forced 60/30 fps, yuv420p, 320k audio, and an
optional cinematic motion blur filter — so uploads survive TikTok's aggressive
compression with much less quality loss.

Everything runs **in the visitor's browser** via [FFmpeg.wasm](https://ffmpegwasm.netlify.app/).
No backend, no file uploads to any server, no build step required.

## Features

- 🎯 Drag-and-drop (or click-to-browse) video upload
- ⚙️ Presets: Max Quality, High Quality, Balanced, 720p Saver, or fully Custom
- 🎞 Forced 1080×1920 or 720×1280 export with aspect-ratio-safe pad/scale
- 🚀 Forced 60fps or 30fps output
- 📈 High video bitrate (6–10 Mbps) + 320k/256k/192k AAC audio
- 🌫 Optional motion blur (temporal frame blending via FFmpeg's `tmix` filter)
  with Light / Medium / Strong intensity
- 📊 Real-time progress bar driven by FFmpeg's native progress events
- ⬇️ In-browser preview + one-click MP4 download
- 🔒 100% private — video data never leaves the device
- 📱 Fully responsive, dark-themed UI (Tailwind CSS)

## File Structure
