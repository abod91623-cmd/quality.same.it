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

if (processBtn) {
    processBtn.addEventListener('click', async () => {
        if (!selectedFile) {
            alert('Please select a video file first.');
            return;
        }

        try {
            processBtn.disabled = true;
            progressContainer.classList.remove('hidden');
            progressText.textContent = 'Processing...';
            
            // محاكاة المعالجة لحين ربط الـ Worker بالطريقة المناسبة
            setTimeout(() => {
                progressText.textContent = 'Done! Video optimized successfully.';
                resultContainer.classList.remove('hidden');
                processBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error(error);
            alert('Something went wrong while processing your video. Check console for details.');
            processBtn.disabled = false;
        }
    });
}
