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

    // Generator UI elements
    const promptInput = document.getElementById('prompt-input');
    const generateButton = document.getElementById('generate-button');
    const generateText = document.getElementById('generate-text');
    const generateLoader = document.getElementById('generate-loader');

    let uploadedFile = null;

    // -- App Initialization --
    async function main() {
        try {
            await initializeModel();
            modelLoader.classList.add('hidden');
            detectorUi.classList.remove('hidden');
        } catch (error) {
            console.error("Initialization failed:", error);
            modelLoader.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center">
                    <h3 class="text-xl font-bold text-red-400 mb-2">Initialization Failed</h3>
                    <p class="text-sm text-gray-400">Could not load the AI detection model.</p>
                    <pre class="mt-4 p-3 bg-gray-900 rounded-md text-left text-xs text-red-300 max-w-full overflow-x-auto">${error.message}</pre>
                </div>
            `;
        }
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

    generateButton.addEventListener('click', async () => {
        const prompt = promptInput.value.trim();
        if (!prompt) {
            alert('Please enter a prompt to generate an image.');
            return;
        }

        // --- Start loading state ---
        generateButton.disabled = true;
        generateText.classList.add('hidden');
        generateLoader.classList.remove('hidden');
        resultContainer.innerHTML = ''; // Clear previous results

        try {
            // 1. Generate the image
            resultContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center p-6 space-y-3 bg-gray-700/50 rounded-lg">
                    <div class="loader"></div>
                    <p class="text-gray-300">Generating AI image... (this can take a moment)</p>
                </div>`;
            
            const genResult = await websim.imageGen({ prompt });

            // 2. Convert URL to a File object
            const response = await fetch(genResult.url);
            const blob = await response.blob();
            const generatedFile = new File([blob], "ai-generated-image.png", { type: blob.type || 'image/png' });

            // 3. Feed the file into the existing UI flow
            handleFileSelect(generatedFile);
            
            // 4. Automatically trigger detection
            // A short delay to ensure the image preview is rendered
            setTimeout(() => {
                detectButton.click();
                previewContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);

        } catch (error) {
            console.error("Image generation failed:", error);
            resultContainer.innerHTML = `<p class="text-red-400 text-center">An error occurred during image generation.</p>`;
        } finally {
            // --- End loading state ---
            generateButton.disabled = false;
            generateText.classList.remove('hidden');
            generateLoader.classList.add('hidden');
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