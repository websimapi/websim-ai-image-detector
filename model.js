import { preprocessImage } from './utils.js';

let session;
let modelReady = false;

/**
 * Loads the ONNX model and initializes the inference session.
 * @returns {Promise<void>}
 */
export async function initializeModel() {
    try {
        // Explicitly set the path for WASM files to ensure they are loaded correctly from the CDN.
        // This is a common fix for model loading issues with onnxruntime-web.
        ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

        const modelPath = '/model.onnx';
        // Explicitly use the 'wasm' execution provider.
        session = await ort.InferenceSession.create(modelPath, { executionProviders: ['wasm'] });
        modelReady = true;
        console.log("ONNX model initialized successfully.");
    } catch (e) {
        console.error("Failed to initialize ONNX model.", e);
        // The error object `e` might have useful details. We'll pass its message.
        const errorMessage = e.message || "An unknown error occurred.";
        throw new Error(`Could not load the detection model. This might be due to a network issue or browser incompatibility. Please try refreshing the page. (Details: ${errorMessage})`);
    }
}

/**
 * Analyzes an image using the loaded ONNX model and supplements with metadata analysis.
 * @param {HTMLImageElement} imageElement - The <img> element to analyze.
 * @param {object} metadata - The extracted EXIF metadata.
 * @returns {Promise<{score: number, label: string, analysis: object}>} The detailed analysis result.
 */
export async function analyzeImage(imageElement, metadata = {}) {
    if (!modelReady || !session) {
        throw new Error("Model is not initialized.");
    }

    const analysis = {};

    // --- 1. Metadata Analysis (kept from previous version for detail) ---
    const software = metadata.Software || '';
    let metadataScore = 0;
    let metadataConclusion = "No suspicious software tags found in metadata. This is common for real photos.";
    if (/stable diffusion|midjourney|dall-e/i.test(software)) {
        metadataScore = 95;
        metadataConclusion = `Strong indicator: Image metadata explicitly mentions "${software}", a known AI image generator.`;
    } else if (/photoshop|lightroom|gimp/i.test(software)) {
        metadataScore = 15;
        metadataConclusion = `Weak indicator: Image was processed with "${software}". This is common for both real and AI images.`;
    }
    analysis.metadata = { score: metadataScore, conclusion: metadataConclusion, name: "Metadata Check" };

    // --- 2. ONNX Model Inference ---
    const tensorData = preprocessImage(imageElement);
    const tensor = new ort.Tensor('float32', tensorData, [1, 3, 224, 224]);
    
    const feeds = { 'input': tensor };
    const results = await session.run(feeds);
    
    // The model output is typically logits. We apply softmax to get probabilities.
    const outputData = results.output.data;
    const softmax = (logits) => {
        const maxLogit = Math.max(...logits);
        const exps = logits.map(l => Math.exp(l - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b);
        return exps.map(e => e / sumExps);
    };
    const probabilities = softmax(outputData);

    // Assuming index 0 = 'real', index 1 = 'fake' (AI)
    // This may need adjustment based on the specific model's output mapping.
    // From the model card, it seems index 1 is for 'fake'.
    const aiProbability = probabilities[1];
    const modelScore = Math.round(aiProbability * 100);
    
    let modelConclusion = `The model is ${modelScore}% confident the image is AI-generated based on its visual patterns.`;
    if (modelScore < 50) {
        modelConclusion = `The model is ${100 - modelScore}% confident the image is real based on its visual patterns.`;
    }
     analysis.model = { score: modelScore, conclusion: modelConclusion, name: "ONNX Model Analysis" };

    // --- 3. Final Score Calculation ---
    // Heavily weigh the ONNX model's output, but let metadata have some influence.
    const finalScore = modelScore * 0.85 + metadataScore * 0.15;
        
    const clampedScore = Math.min(Math.max(finalScore, 0), 100);
    const isAi = clampedScore > 50;
    
    return {
        score: Math.round(clampedScore),
        label: isAi ? 'Likely AI-generated' : 'Likely Real',
        analysis: analysis
    };
}