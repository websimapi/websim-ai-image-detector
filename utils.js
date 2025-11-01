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
 * Prepares image data for analysis by drawing it to a canvas.
 * @param {HTMLImageElement} imageElement - The <img> element to process.
 * @returns {ImageData} The pixel data from the canvas.
 */
export function preprocessImage(imageElement) {
    const canvas = document.createElement('canvas');
    // For performance, we can analyze a smaller version.
    const size = 128; 
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imageElement, 0, 0, size, size);
    return ctx.getImageData(0, 0, size, size);
}