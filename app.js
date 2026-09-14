/* =========================================================================
   TikTok Video Optimizer — Client-Side Processing Engine
   Powered by FFmpeg.wasm (single-thread core — no COOP/COEP headers needed,
   works on plain static hosting such as GitHub Pages).
   ========================================================================= */

(() => {
  'use strict';

  /* ---------------------------------------------------------------------
   * DOM references
   * ------------------------------------------------------------------- */
  const dropzone            = document.getElementById('dropzone');
  const fileInput           = document.getElementById('fileInput');
  const fileInfo            = document.getElementById('fileInfo');
  const fileNameEl          = document.getElementById('fileName');
  const fileMetaEl          = document.getElementById('fileMeta');
  const removeFileBtn       = document.getElementById('removeFile');

  const settingsPanel       = document.getElementById('settingsPanel');
  const presetSelect        = document.getElementById('presetSelect');
  const advancedSettings    = document.getElementById('advancedSettings');
  const resolutionSelect    = document.getElementById('resolutionSelect');
  const fpsSelect            = document.getElementById('fpsSelect');
  const bitrateInput        = document.getElementById('bitrateInput');
  const audioBitrateSelect  = document.getElementById('audioBitrateSelect');

  const motionBlurToggle        = document.getElementById('motionBlurToggle');
  const motionBlurIntensityWrap = document.getElementById('motionBlurIntensityWrap');
  const intensityBtns           = document.querySelectorAll('.intensity-btn');

  const settingsSummary     = document.getElementById('settingsSummary');
  const processBtn          = document.getElementById('processBtn');

  const progressSection     = document.getElementById('progressSection');
  const progressBar         = document.getElementById('progressBar');
  const progressPercent     = document.getElementById('progressPercent');
  const progressStatus      = document.getElementById('progressStatus');

  const downloadSection     = document.getElementById('downloadSection');
  const outputPreview       = document.getElementById('outputPreview');
  const outputMeta          = document.getElementById('outputMeta');
  const downloadBtn         = document.getElementById('downloadBtn');
  const processAnotherBtn   = document.getElementById('processAnotherBtn');

  /* ---------------------------------------------------------------------
   * State
   * ------------------------------------------------------------------- */
  let selectedFile   = null;
  let ffmpeg         = null;
  let ffmpegLoaded   = false;
  let motionBlurOn   = false;
  let motionBlurLevel = 'medium'; // light | medium | strong
  let objectUrlForOutput = null;

  const PRESETS = {
    max:      { resolution: '1080x1920', fps: '60', bitrate: 10, audio: 320 },
    high:     { resolution: '1080x1920', fps: '60', bitrate: 8,  audio: 320 },
    balanced: { resolution: '1080x1920', fps: '30', bitrate: 8,  audio: 256 },
    hd720:    { resolution: '720x1280',  fps: '60', bitrate: 6,  audio: 256 },
  };

  // Maps intensity level -> number of frames blended by the tmix filter.
  const MOTION_BLUR_FRAMES = {
    light:  2,
    medium: 3,
    strong: 5,
  };

  /* ---------------------------------------------------------------------
   * Utility helpers
   * ------------------------------------------------------------------- */
  function bytesToSize(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  function show(el) { el.classList.remove('hidden'); el.classList.add('fade-in'); }
  function hide(el) { el.classList.add('hidden'); el.classList.remove('fade-in'); }

  function setProgress(pct, statusText) {
    const clamped = Math.max(0, Math.min(100, pct));
    progressBar.style.width = `${clamped}%`;
    progressPercent.textContent = `${clamped.toFixed(0)}%`;
    if (statusText) progressStatus.textContent = statusText;
  }

  /* ---------------------------------------------------------------------
   * File selection (drag & drop + click-to-browse)
   * ------------------------------------------------------------------- */
  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('drag-active');
    });
  });

  ['dragleave', 'dragend'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('drag-active');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('drag-active');
    const files = e.dataTransfer.files;
    if (files && files.length) handleFileSelect(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) handleFileSelect(e.target.files[0]);
  });

  removeFileBtn.addEventListener('click', resetToUpload);

  function handleFileSelect(file) {
    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file.');
      return;
    }
    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileMetaEl.textContent = `${bytesToSize(file.size)} · ${file.type || 'video'}`;
    show(fileInfo);
    show(settingsPanel);
    updateSummary();
    settingsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function resetToUpload() {
    selectedFile = null;
    fileInput.value = '';
    hide(fileInfo);
    hide(settingsPanel);
    hide(progressSection);
    hide(downloadSection);
  }

  /* ---------------------------------------------------------------------
   * Settings panel interactions
   * ------------------------------------------------------------------- */
  presetSelect.addEventListener('change', () => {
    const val = presetSelect.value;
    if (val === 'custom') {
      show(advancedSettings);
    } else {
      hide(advancedSettings);
      const p = PRESETS[val];
      resolutionSelect.value = p.resolution;
      fpsSelect.value = p.fps;
      bitrateInput.value = p.bitrate;
      audioBitrateSelect.value = p.audio;
    }
    updateSummary();
  });

  [resolutionSelect, fpsSelect, bitrateInput, audioBitrateSelect].forEach(el => {
    el.addEventListener('input', updateSummary);
    el.addEventListener('change', updateSummary);
  });

  motionBlurToggle.addEventListener('click', () => {
    motionBlurOn = !motionBlurOn;
    motionBlurToggle.classList.toggle('active', motionBlurOn);
    motionBlurIntensityWrap.classList.toggle('opacity-40', !motionBlurOn);
    motionBlurIntensityWrap.classList.toggle('pointer-events-none', !motionBlurOn);
    updateSummary();
  });

  intensityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      intensityBtns.forEach(b => b.classList.remove('active', 'border-sky-400', 'bg-sky-400/10', 'text-sky-300'));
      btn.classList.add('active', 'border-sky-400', 'bg-sky-400/10', 'text-sky-300');
      motionBlurLevel = btn.dataset.intensity;
      updateSummary();
    });
  });

  function getCurrentSettings() {
    return {
      resolution: resolutionSelect.value,          // "1080x1920" | "720x1280" | "original"
      fps: fpsSelect.value,                          // "60" | "30" | "original"
      videoBitrateMbps: parseFloat(bitrateInput.value) || 8,
      audioBitrateKbps: parseInt(audioBitrateSelect.value, 10) || 320,
      motionBlur: motionBlurOn,
      motionBlurLevel,
    };
  }

  function updateSummary() {
    const s = getCurrentSettings();
    const resText = s.resolution === 'original' ? 'original resolution' : s.resolution.replace('x', '×');
    const fpsText = s.fps === 'original' ? 'original fps' : `${s.fps}fps`;
    const blurText = s.motionBlur ? `, ${s.motionBlurLevel} motion blur` : '';
    settingsSummary.textContent =
      `Exporting at ${resText} · ${fpsText} · ${s.videoBitrateMbps}Mbps video / ${s.audioBitrateKbps}kbps audio${blurText}`;
  }

  // Initialize default preset (max) on load
  presetSelect.value = 'max';
  presetSelect.dispatchEvent(new Event('change'));

  /* ---------------------------------------------------------------------
   * FFmpeg.wasm loading
   * ------------------------------------------------------------------- */
  async function ensureFFmpegLoaded() {
    if (ffmpegLoaded) return;

    const { FFmpeg } = window.FFmpegWASM;
    const { toBlobURL } = window.FFmpegUtil;

    ffmpeg = new FFmpeg();

    ffmpeg.on('log', ({ message }) => {
      // Surface raw ffmpeg log lines as status text (useful during the
      // initial "analyzing" phase before numeric progress is available).
      progressStatus.textContent = message;
    });

    ffmpeg.on('progress', ({ progress }) => {
      if (typeof progress === 'number' && !Number.isNaN(progress)) {
        const pct = Math.min(100, Math.max(0, progress * 100));
        setProgress(pct, progressStatus.textContent);
      }
    });

    setProgress(0, 'Downloading FFmpeg core (first time only, ~25MB)…');

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpegLoaded = true;
  }

  /* ---------------------------------------------------------------------
   * Build the FFmpeg filter graph + argument list from current settings
   * ------------------------------------------------------------------- */
  function buildFilterChain(settings) {
    const filters = [];

    // 1. Resolution: scale to fit target box, then pad to exact target
    //    dimensions so aspect ratio is preserved without stretching.
    if (settings.resolution !== 'original') {
      const [w, h] = settings.resolution.split('x');
      filters.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`);
      filters.push(`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`);
    }

    // 2. Framerate: force output fps via fps filter (this also handles
    //    frame duplication/dropping as needed).
    if (settings.fps !== 'original') {
      filters.push(`fps=${settings.fps}`);
    }

    // 3. Motion Blur: temporal frame-blend using tmix. Applied AFTER fps
    //    normalization so blending happens at the final output framerate.
    if (settings.motionBlur) {
      const frames = MOTION_BLUR_FRAMES[settings.motionBlurLevel] || 3;
      // Weighted average, heavier on the center frame for a natural look.
      const weights = frames === 2 ? '1 1'
                     : frames === 3 ? '1 2 1'
                     : '1 2 3 2 1'; // strong (5 frames)
      filters.push(`tmix=frames=${frames}:weights='${weights}'`);
    }

    // 4. Always force yuv420p for maximum compatibility with TikTok's
    //    decoder and to avoid chroma subsampling issues.
    filters.push('format=yuv420p');

    return filters.join(',');
  }

  function buildFFmpegArgs(inputName, outputName, settings) {
    const vf = buildFilterChain(settings);
    const vBitrate = `${settings.videoBitrateMbps}M`;
    const vBufsize = `${settings.videoBitrateMbps * 2}M`;
    const aBitrate = `${settings.audioBitrateKbps}k`;

    return [
      '-i', inputName,
      '-vf', vf,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-profile:v', 'high',
      '-level', '4.2',
      '-b:v', vBitrate,
      '-maxrate', vBitrate,
      '-bufsize', vBufsize,
      '-pix_fmt', 'yuv420p',
      '-g', settings.fps !== 'original' ? String(parseInt(settings.fps, 10) * 2) : '120',
      '-c:a', 'aac',
      '-b:a', aBitrate,
      '-ar', '48000',
      '-movflags', '+faststart',
      outputName,
    ];
  }

  /* ---------------------------------------------------------------------
   * Main processing pipeline
   * ------------------------------------------------------------------- */
  processBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    const settings = getCurrentSettings();

    hide(settingsPanel);
    hide(downloadSection);
    show(progressSection);
    setProgress(0, 'Initializing…');
    processBtn.disabled = true;

    try {
      await ensureFFmpegLoaded();

      const inputExt = (selectedFile.name.split('.').pop() || 'mp4').toLowerCase();
      const inputName = `input.${inputExt}`;
      const outputName = 'output.mp4';

      setProgress(2, 'Loading video into memory…');
      const { fetchFile } = window.FFmpegUtil;
      const inputData = await fetchFile(selectedFile);
      await ffmpeg.writeFile(inputName, inputData);

      setProgress(5, 'Starting encode…');
      const args = buildFFmpegArgs(inputName, outputName, settings);

      await ffmpeg.exec(args);

      setProgress(97, 'Finalizing file…');
      const outputData = await ffmpeg.readFile(outputName);

      // Clean up virtual FS to free memory for subsequent runs.
      try { await ffmpeg.deleteFile(inputName); } catch (_) {}
      try { await ffmpeg.deleteFile(outputName); } catch (_) {}

      const blob = new Blob([outputData.buffer], { type: 'video/mp4' });
      if (objectUrlForOutput) URL.revokeObjectURL(objectUrlForOutput);
      objectUrlForOutput = URL.createObjectURL(blob);

      setProgress(100, 'Done!');
      outputPreview.src = objectUrlForOutput;
      outputMeta.textContent =
        `${bytesToSize(blob.size)} · ${settings.resolution === 'original' ? 'original res' : settings.resolution.replace('x','×')} · ` +
        `${settings.fps === 'original' ? 'original fps' : settings.fps + 'fps'} · ${settings.videoBitrateMbps}Mbps` +
        (settings.motionBlur ? ` · ${settings.motionBlurLevel} motion blur` : '');
      downloadBtn.href = objectUrlForOutput;

      const cleanName = (selectedFile.name.replace(/\.[^/.]+$/, '') || 'video');
      downloadBtn.setAttribute('download', `${cleanName}-tiktok-optimized.mp4`);

      hide(progressSection);
      show(downloadSection);
      downloadSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (err) {
      console.error(err);
      setProgress(0, 'An error occurred.');
      alert('Something went wrong while processing your video. Check the browser console for details, or try a smaller file / different browser (Chrome or Edge recommended).');
      hide(progressSection);
      show(settingsPanel);
    } finally {
      processBtn.disabled = false;
    }
  });

  processAnotherBtn.addEventListener('click', () => {
    hide(downloadSection);
    resetToUpload();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

})();
