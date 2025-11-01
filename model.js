import { preprocessImage } from './utils.js';

let modelReady = false;

/**
 * Simulates loading the AI model.
 * @returns {Promise<void>}
 */
export function initializeModel() {
    return new Promise(resolve => {
        // Simulate a delay for loading a model file
        setTimeout(() => {
            modelReady = true;
            console.log("Simulated model initialized.");
            resolve();
        }, 1500);
    });
}

/**
 * Analyzes an image using a deterministic pseudo-model.
 * The logic is arbitrary but consistent. It bases its "AI" score on
 * color variance and brightness. High variance and unusual brightness
 * patterns will result in a higher "AI-generated" score.
 * @param {HTMLImageElement} imageElement - The <img> element to analyze.
 * @returns {Promise<{score: number, label: string}>} The analysis result.
 */
export async function analyzeImage(imageElement) {
    if (!modelReady) {
        throw new Error("Model is not initialized.");
    }

    const imageData = preprocessImage(imageElement);
    const data = imageData.data;
    let r_sum = 0, g_sum = 0, b_sum = 0;
    let r_sq_sum = 0, g_sq_sum = 0, b_sq_sum = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];
        r_sum += r;
        g_sum += g;
        b_sum += b;
        r_sq_sum += r * r;
        g_sq_sum += g * g;
        b_sq_sum += b * b;
    }
    
    // Calculate mean
    const r_mean = r_sum / pixelCount;
    const g_mean = g_sum / pixelCount;
    const b_mean = b_sum / pixelCount;

    // Calculate standard deviation (a measure of variance)
    const r_std_dev = Math.sqrt(r_sq_sum / pixelCount - r_mean * r_mean);
    const g_std_dev = Math.sqrt(g_sq_sum / pixelCount - g_mean * g_mean);
    const b_std_dev = Math.sqrt(b_sq_sum / pixelCount - b_mean * b_mean);

    // Combine metrics into a score (0-100)
    // This is the core of the pseudo-model. It's a deterministic formula.
    const avg_std_dev = (r_std_dev + g_std_dev + b_std_dev) / 3;
    const avg_brightness = (r_mean + g_mean + b_mean) / 3;

    // Normalize and combine. Let's say high variance and mid-range brightness seem "AI"
    let score = (avg_std_dev / 100) * 80 + (1 - Math.abs(avg_brightness - 128) / 128) * 20;
    score = Math.min(Math.max(score * 1.5, 5), 98); // Scale and clamp the score

    // Simulate some randomness based on the exact pixel values to make it less predictable
    const pseudo_random_factor = ((r_sum + g_sum) % 10) - 5; // -5 to +5
    score = Math.min(Math.max(score + pseudo_random_factor, 0), 100);

    const isAi = score > 50;
    
    return new Promise(resolve => {
        // Simulate inference time
        setTimeout(() => {
            resolve({
                score: Math.round(score),
                label: isAi ? 'Likely AI-generated' : 'Likely Real'
            });
        }, 800);
    });
}