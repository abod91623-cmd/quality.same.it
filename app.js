import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { toBlobURL } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js';

let ffmpeg = null;
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const processBtn = document.getElementById('processBtn');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const resultContainer = document.getElementById('resultContainer');
const videoOutput = document.getElementById('videoOutput');
const downloadBtn = document.getElementById('downloadBtn');

let selectedFile = null;

if (fileInput) {
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            selectedFile = e.target.files[0];
            updateFileInfo(selectedFile);
        }
    });
}

function updateFileInfo(file) {
    const dropText = document.getElementById('dropText');
    if (dropText) {
        dropText.textContent = Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB);
    }
}

async function loadFFmpeg() {
    if (ffmpeg) return;
    
    processBtn.disabled = true;
    progressContainer.classList.remove('hidden');
    progressText.textContent = 'Loading FFmpeg core (WASM)...';

    ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
        console.log(message);
    });

    ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100);
        progressBar.style.width = ${percent}%;
        progressText.textContent = Processing video: ${percent}%;
    });

    try {
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        progressText.textContent = 'FFmpeg loaded successfully!';
    } catch (error) {
        console.error(error);
        progressText.textContent = 'Failed to load FFmpeg. Check console.';
        alert('Failed to load FFmpeg core. Please check your browser console.');
    } finally {
        processBtn.disabled = false;
    }
}

if (processBtn) {
    processBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            alert('Please select a video file first.');
            return;
        }

        await loadFFmpeg();

        try {
            processBtn.disabled = true;
            progressContainer.classList.remove('hidden');
            
            const inputFileName = 'input.mp4';
            const outputFileName = 'output.mp4';

            progressText.textContent = 'Reading input file...';
            const { fetchFile } = await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js');
            await ffmpeg.writeFile(inputFileName, await fetchFile(selectedFile));

            // قراءة الخيارات من الواجهة
            const resolution = document.getElementById('resolutionSelect')?.value || '1080';
            const fps = document.getElementById('fpsSelect')?.value || '60';
            const motionBlur = document.getElementById('motionBlurToggle')?.checked || false;

            let scaleFilter = resolution === '1080' ? 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2' : 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2';
            
            let vfFilters = [scaleFilter, `fps=${fps}`];
            if (motionBlur) {
                // تصفية الموشن بلور البسيطة عبر الدمج الإطاري
                vfFilters.push('tblend=all_mode=average');
            }

            const args = [
                '-i', inputFileName,
                '-vf', vfFilters.join(','),
                '-c:v', 'libx264',
                '-preset', 'medium',
               '-b:v', '8M',
                '-maxrate', '10M',
                '-bufsize', '16M',
                '-pix_fmt', 'yuv420p',
                '-c:a', 'aac',
                '-b:a', '320k',
                outputFileName
            ];

            progressText.textContent = 'Processing and re-encoding video...';
            await ffmpeg.exec(args);

            progressText.textContent = 'Generating final video...';
            const data = await ffmpeg.readFile(outputFileName);
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const videoUrl = URL.createObjectURL(blob);

            videoOutput.src = videoUrl;
            resultContainer.classList.remove('hidden');
            downloadBtn.href = videoUrl;
            downloadBtn.download = 'tiktok-optimized.mp4';

            progressText.textContent = 'Done! Video optimized successfully.';
        } catch (error) {
            console.error(error);
            alert('Something went wrong while processing your video. Check console for details.');
        } finally {
            processBtn.disabled = false;
        }
    });
}
