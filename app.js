import { initializeModel, analyzeImage } from './model.js';
import { extractMetadata } from './utils.js';
import { createAnalysisLoader, createResultDisplay, createMetadataDisplay } from './components.js';

document.addEventListener('DOMContentLoaded', () => {
    const modelLoader = document.getElementById('model-loader');
    const detectorUi = document.getElementById('detector-ui');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const imagePreview = document.getElementById('image-preview');
    const previewContainer = document.getElementById('preview-container');
    const detectButton = document.getElementById('detect-button');
    const metadataButton = document.getElementById('metadata-button');
    const resultContainer = document.getElementById('result-container');

    const metadataModal = document.getElementById('metadata-modal');
    const metadataContent = document.getElementById('metadata-content');
    const closeModal = document.getElementById('close-modal');

    let uploadedFile = null;

    // -- App Initialization --
    async function main() {
        await initializeModel();
        modelLoader.classList.add('hidden');
        detectorUi.classList.remove('hidden');
    }

    // -- Event Handlers --
    function handleFileSelect(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        uploadedFile = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
            previewContainer.classList.remove('hidden');
            previewContainer.classList.add('flex');
            detectButton.disabled = false;
            metadataButton.disabled = false;
            resultContainer.innerHTML = '';
        };
        reader.readAsDataURL(file);
    }

    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('border-cyan-400', 'bg-gray-700');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-cyan-400', 'bg-gray-700');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-cyan-400', 'bg-gray-700');
        const files = e.dataTransfer.files;
        if (files.length) {
            handleFileSelect(files[0]);
        }
    });

    detectButton.addEventListener('click', async () => {
        if (!uploadedFile) return;

        resultContainer.innerHTML = createAnalysisLoader();
        detectButton.disabled = true;
        metadataButton.disabled = true;

        try {
            const metadata = await extractMetadata(uploadedFile);
            const result = await analyzeImage(imagePreview, metadata);
            resultContainer.innerHTML = createResultDisplay(result);
        } catch (error) {
            console.error("Analysis failed:", error);
            resultContainer.innerHTML = `<p class="text-red-400 text-center">An error occurred during analysis.</p>`;
        } finally {
            detectButton.disabled = false;
            metadataButton.disabled = false;
        }
    });

    metadataButton.addEventListener('click', async () => {
        if (!uploadedFile) return;
        const metadata = await extractMetadata(uploadedFile);
        metadataContent.innerHTML = createMetadataDisplay(metadata);
        metadataModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        metadataModal.classList.add('hidden');
    });

    metadataModal.addEventListener('click', (e) => {
        if (e.target === metadataModal) {
            metadataModal.classList.add('hidden');
        }
    });

    main();
});