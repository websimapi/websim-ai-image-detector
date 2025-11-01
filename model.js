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
 * Analyzes an image using a deterministic pseudo-model with multiple factors.
 * It checks metadata, color variance, detail levels (texture), and brightness.
 * @param {HTMLImageElement} imageElement - The <img> element to analyze.
 * @param {object} metadata - The extracted EXIF metadata.
 * @returns {Promise<{score: number, label: string, analysis: object}>} The detailed analysis result.
 */
export async function analyzeImage(imageElement, metadata = {}) {
    if (!modelReady) {
        throw new Error("Model is not initialized.");
    }

    const imageData = preprocessImage(imageElement);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const pixelCount = width * height;

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
    
    // --- 2. Pixel-level Analysis ---
    let r_sum = 0, g_sum = 0, b_sum = 0;
    let r_sq_sum = 0, g_sq_sum = 0, b_sq_sum = 0;
    let laplacian_sum = 0;

    // Iterate from 1 to width/height-1 to avoid boundary checks for neighbors
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = (y * width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            r_sum += r; g_sum += g; b_sum += b;
            r_sq_sum += r * r; g_sq_sum += g * g; b_sq_sum += b * b;
            
            const center_gray = (r + g + b) / 3;
            const top_gray = (data[((y - 1) * width + x) * 4] + data[((y - 1) * width + x) * 4 + 1] + data[((y - 1) * width + x) * 4 + 2]) / 3;
            const bottom_gray = (data[((y + 1) * width + x) * 4] + data[((y + 1) * width + x) * 4 + 1] + data[((y + 1) * width + x) * 4 + 2]) / 3;
            const left_gray = (data[(y * width + (x - 1)) * 4] + data[(y * width + (x - 1)) * 4 + 1] + data[(y * width + (x - 1)) * 4 + 2]) / 3;
            const right_gray = (data[(y * width + (x + 1)) * 4] + data[(y * width + (x + 1)) * 4 + 1] + data[(y * width + (x + 1)) * 4 + 2]) / 3;

            // 4-neighbor Laplacian to measure local variance (edges/texture)
            laplacian_sum += Math.abs(4 * center_gray - (top_gray + bottom_gray + left_gray + right_gray));
        }
    }
    
    const validPixelCount = (width - 2) * (height - 2); // Pixels we iterated over

    // -- Color Variance --
    const r_mean = r_sum / validPixelCount;
    const g_mean = g_sum / validPixelCount;
    const b_mean = b_sum / validPixelCount;
    const r_std_dev = Math.sqrt(r_sq_sum / validPixelCount - r_mean * r_mean);
    const g_std_dev = Math.sqrt(g_sq_sum / validPixelCount - g_mean * g_mean);
    const b_std_dev = Math.sqrt(b_sq_sum / validPixelCount - b_mean * b_mean);
    const avg_std_dev = (r_std_dev + g_std_dev + b_std_dev) / 3;
    
    let colorScore = Math.abs(avg_std_dev - 45) * 1.5; // Assume "normal" variance is around 45
    colorScore = Math.min(colorScore, 90);
    let colorConclusion = "Color distribution appears natural, consistent with typical photographs.";
    if (avg_std_dev > 65) {
        colorConclusion = "Image exhibits unusually high color variance, which can be a trait of vivid AI generations.";
    } else if (avg_std_dev < 25) {
         colorScore = Math.max(40, colorScore); // Low variance is also suspicious
         colorConclusion = "Image shows very uniform color, suggesting unnaturally smooth gradients or synthetic content.";
    }
    analysis.color = { score: Math.round(colorScore), conclusion: colorConclusion, name: "Color Variance" };

    // -- Detail & Texture (from Laplacian) --
    const avg_laplacian = laplacian_sum / validPixelCount;
    let detailScore = 0;
    let detailConclusion = "Texture and detail levels are consistent with a real photograph.";
    if (avg_laplacian < 3.0) { // Very smooth
        detailScore = 75;
        detailConclusion = "The image lacks fine-grained noise and texture, appearing unnaturally smooth like some AI outputs.";
    } else if (avg_laplacian > 20) { // Excessively noisy/detailed
        detailScore = 60;
        detailConclusion = "Contains excessive, chaotic detail patterns that don't match typical camera noise.";
    }
    analysis.detail = { score: detailScore, conclusion: detailConclusion, name: "Texture Analysis" };

    // -- Brightness Distribution --
    const avg_brightness = (r_mean + g_mean + b_mean) / 3;
    // Score based on deviation from a neutral mid-gray (128)
    let brightnessScore = (1 - Math.abs(avg_brightness - 128) / 128) * 30;
    let brightnessConclusion = "The overall brightness and contrast fall within a normal photographic range.";
    if (avg_brightness < 40 || avg_brightness > 215) {
        brightnessScore += 25; // Extremely dark or bright images are slightly more suspect
        brightnessConclusion = "Image has extreme brightness levels, which can sometimes occur in stylized AI art.";
    }
    analysis.brightness = { score: Math.round(brightnessScore), conclusion: brightnessConclusion, name: "Brightness" };
    
    // --- 3. Final Score Calculation ---
    // Weighted average of the different factors
    const finalScore = 
        metadataScore * 0.50 +
        colorScore * 0.20 +
        detailScore * 0.20 +
        brightnessScore * 0.10;
        
    const clampedScore = Math.min(Math.max(finalScore, 5), 98);
    const isAi = clampedScore > 50;
    
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                score: Math.round(clampedScore),
                label: isAi ? 'Likely AI-generated' : 'Likely Real',
                analysis: analysis
            });
        }, 800);
    });
}