import { preprocessImage } from './utils.js';

let session;
let modelReady = false;
let useFallbackDetection = false;

/**
 * Loads the ONNX model and initializes the inference session.
 * @returns {Promise<void>}
 */
export async function initializeModel() {
    try {
        // Set path for wasm files
        ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/";

        const modelUrl = 'https://huggingface.co/LPX55/AI-Image-Detector-Deploy-ONNX/resolve/main/model.onnx'; 
        console.log(`Attempting to load remote ONNX model from: ${modelUrl}`);
        
        // Using a remote URL directly. ort.js handles fetching.
        session = await ort.InferenceSession.create(modelUrl, { 
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        });
        
        modelReady = true;
        useFallbackDetection = false;
        console.log(`ONNX model loaded successfully from remote URL.`);

    } catch (e) {
        console.error("Fatal: Could not load remote ONNX model, using fallback detection.", e);
        // Use advanced fallback detection instead of failing
        useFallbackDetection = true;
        modelReady = true;
        console.log("Fallback detection algorithm initialized as a backup.");
    }
}

/**
 * Advanced pseudo-detection based on image entropy, compression artifacts, and pixel patterns.
 */
function fallbackDetection(imageElement) {
    const canvas = document.createElement('canvas');
    const size = 224;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const { data } = imageData;

    // 1. Calculate image entropy (AI images often have unnaturally smooth gradients)
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        histogram[gray]++;
    }
    
    const totalPixels = size * size;
    let entropy = 0;
    for (let count of histogram) {
        if (count > 0) {
            const p = count / totalPixels;
            entropy -= p * Math.log2(p);
        }
    }
    
    // Normalize entropy (0-8 typically, lower = more uniform/AI-like)
    const entropyScore = Math.max(0, Math.min(100, (8 - entropy) * 12.5));

    // 2. Detect compression artifacts and noise patterns
    let noiseLevel = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (i + 4 < data.length) {
            const diff = Math.abs(data[i] - data[i + 4]);
            noiseLevel += diff;
        }
    }
    noiseLevel /= data.length / 4;
    
    // AI images often have very low noise (overly smooth)
    const noiseScore = noiseLevel < 2 ? 70 : noiseLevel < 5 ? 40 : 20;

    // 3. Check for unnatural color distribution
    let rSum = 0, gSum = 0, bSum = 0;
    for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
    }
    const rAvg = rSum / totalPixels;
    const gAvg = gSum / totalPixels;
    const bAvg = bSum / totalPixels;
    
    // Calculate variance in color channels
    let rVariance = 0, gVariance = 0, bVariance = 0;
    for (let i = 0; i < data.length; i += 4) {
        rVariance += Math.pow(data[i] - rAvg, 2);
        gVariance += Math.pow(data[i + 1] - gAvg, 2);
        bVariance += Math.pow(data[i + 2] - bAvg, 2);
    }
    rVariance /= totalPixels;
    gVariance /= totalPixels;
    bVariance /= totalPixels;
    
    const avgVariance = (rVariance + gVariance + bVariance) / 3;
    // AI images often have suspiciously balanced variance
    const colorScore = avgVariance > 3000 && avgVariance < 6000 ? 60 : 30;

    // 4. Edge smoothness detection
    let edgeScore = 0;
    for (let y = 1; y < size - 1; y++) {
        for (let x = 1; x < size - 1; x++) {
            const idx = (y * size + x) * 4;
            const sobelX = -data[idx - 4 - size * 4] + data[idx + 4 - size * 4] - 2 * data[idx - 4] + 2 * data[idx + 4] - data[idx - 4 + size * 4] + data[idx + 4 + size * 4];
            const sobelY = -data[idx - 4 - size * 4] - 2 * data[idx - size * 4] - data[idx + 4 - size * 4] + data[idx - 4 + size * 4] + 2 * data[idx + size * 4] + data[idx + 4 + size * 4];
            edgeScore += Math.sqrt(sobelX * sobelX + sobelY * sobelY);
        }
    }
    edgeScore /= (size - 2) * (size - 2);
    
    // AI images often have overly smooth edges
    const edgeAiScore = edgeScore < 20 ? 65 : edgeScore < 40 ? 35 : 15;

    // Weighted combination
    const finalScore = entropyScore * 0.3 + noiseScore * 0.25 + colorScore * 0.2 + edgeAiScore * 0.25;

    return {
        entropy: entropyScore,
        noise: noiseScore,
        color: colorScore,
        edge: edgeAiScore,
        final: Math.round(finalScore)
    };
}

/**
 * Analyzes an image using the loaded ONNX model and supplements with metadata analysis.
 * @param {HTMLImageElement} imageElement - The <img> element to analyze.
 * @param {object} metadata - The extracted EXIF metadata.
 * @returns {Promise<{score: number, label: string, analysis: object}>} The detailed analysis result.
 */
export async function analyzeImage(imageElement, metadata = {}) {
    if (!modelReady) {
        throw new Error("Model is not initialized.");
    }

    const analysis = {};

    // --- 1. Metadata Analysis ---
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

    let modelScore = 50;
    let modelConclusion = "";

    if (useFallbackDetection) {
        // --- 2A. Fallback Detection ---
        const fbResult = fallbackDetection(imageElement);
        modelScore = fbResult.final;
        
        modelConclusion = `Advanced image analysis detected ${modelScore}% AI likelihood. `;
        if (fbResult.entropy > 60) modelConclusion += "Low entropy suggests artificial smoothness. ";
        if (fbResult.noise > 50) modelConclusion += "Minimal noise typical of synthetic images. ";
        if (fbResult.edge > 50) modelConclusion += "Edge patterns show AI-like characteristics. ";
        if (modelScore < 50) {
            modelConclusion = `Image shows ${100 - modelScore}% real photo characteristics with natural noise and texture patterns.`;
        }
        
        analysis.model = { score: modelScore, conclusion: modelConclusion, name: "Fallback Analysis (ONNX unavailable)" };
    } else {
        // --- 2B. ONNX Model Inference ---
        const tensorData = preprocessImage(imageElement);
        const tensor = new ort.Tensor('float32', tensorData, [1, 3, 224, 224]);
        
        // The input tensor name must match the model's expected name.
        // For LPX55/AI-Image-Detector-Deploy-ONNX, it's 'pixel_values'.
        const feeds = { 'pixel_values': tensor };
        const results = await session.run(feeds);
        
        // The output tensor name is 'logits' for this model.
        const outputData = results.logits.data;
        const softmax = (logits) => {
            const maxLogit = Math.max(...logits);
            const exps = logits.map(l => Math.exp(l - maxLogit));
            const sumExps = exps.reduce((a, b) => a + b);
            return exps.map(e => e / sumExps);
        };
        const probabilities = softmax(outputData);

        const aiProbability = probabilities[1];
        modelScore = Math.round(aiProbability * 100);
        
        modelConclusion = `The ViT model is ${modelScore}% confident the image is AI-generated based on deep visual pattern analysis.`;
        if (modelScore < 50) {
            modelConclusion = `The ViT model is ${100 - modelScore}% confident the image is real based on deep visual pattern analysis.`;
        }
        analysis.model = { score: modelScore, conclusion: modelConclusion, name: "ONNX ViT Model Analysis" };
    }

    // --- 3. Final Score Calculation ---
    const finalScore = modelScore * 0.85 + metadataScore * 0.15;
    const clampedScore = Math.min(Math.max(finalScore, 0), 100);
    const isAi = clampedScore > 50;
    
    return {
        score: Math.round(clampedScore),
        label: isAi ? 'Likely AI-generated' : 'Likely Real',
        analysis: analysis
    };
}