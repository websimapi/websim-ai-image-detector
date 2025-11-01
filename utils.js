/**
 * Extracts EXIF metadata from an image file.
 * @param {File} file - The image file object.
 * @returns {Promise<object>} A promise that resolves with the metadata object.
 */
export function extractMetadata(file) {
    return new Promise((resolve) => {
        EXIF.getData(file, function() {
            const allTags = EXIF.getAllTags(this);
            // Filter for cleaner output, you can add more tags if needed
            const relevantTags = {
                Make: allTags.Make,
                Model: allTags.Model,
                Software: allTags.Software,
                DateTime: allTags.DateTime,
                Artist: allTags.Artist,
                ImageDescription: allTags.ImageDescription,
                Copyright: allTags.Copyright
            };
            // Remove undefined/null tags
            Object.keys(relevantTags).forEach(key => relevantTags[key] === undefined && delete relevantTags[key]);
            resolve(relevantTags);
        });
    });
}

/**
 * Prepares image data for the ONNX model.
 * Resizes to 224x224, normalizes, and converts to a CHW tensor format.
 * @param {HTMLImageElement} imageElement - The <img> element to process.
 * @returns {Float32Array} The preprocessed image data as a flat Float32Array.
 */
export function preprocessImage(imageElement) {
    const canvas = document.createElement('canvas');
    const size = 224;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageElement, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size);
    const { data } = imageData;

    // Create a new Float32Array for the tensor data
    const tensorData = new Float32Array(3 * size * size);
    
    // ImageNet mean and std deviation for normalization
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    // NCHW format
    for (let i = 0; i < size * size; i++) {
        // Red channel
        tensorData[i] = (data[i * 4] / 255 - mean[0]) / std[0];
        // Green channel
        tensorData[i + size * size] = (data[i * 4 + 1] / 255 - mean[1]) / std[1];
        // Blue channel
        tensorData[i + size * size * 2] = (data[i * 4 + 2] / 255 - mean[2]) / std[2];
    }
    
    return tensorData;
}