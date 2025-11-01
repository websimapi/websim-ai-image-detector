export function createAnalysisLoader() {
    return `
        <div class="flex flex-col items-center justify-center p-6 space-y-3 bg-gray-700/50 rounded-lg">
            <div class="loader"></div>
            <p class="text-gray-300">Analyzing image...</p>
        </div>
    `;
}

export function createResultDisplay({ score, label, analysis }) {
    const isAi = label === 'Likely AI-generated';
    const confidenceColor = isAi ? 'bg-red-500' : 'bg-green-500';
    const confidenceText = isAi ? 'AI Confidence' : 'Real Confidence';
    const interpretation = isAi
        ? 'Our analysis suggests this image has characteristics commonly found in AI-generated content.'
        : 'Our analysis suggests this image appears to be a real photograph with natural characteristics.';

    let analysisHtml = '<div class="space-y-3 pt-4 border-t border-gray-600/50">';
    
    if (analysis) {
        for (const key in analysis) {
            const item = analysis[key];
            const itemConfidenceColor = item.score > 50 ? 'bg-red-500/50' : 'bg-green-500/50';
            analysisHtml += `
                <div class="p-3 bg-gray-900/50 rounded-md">
                    <div class="flex justify-between items-center mb-1">
                        <h4 class="font-semibold text-gray-200">${item.name}</h4>
                        <span class="text-xs font-mono px-2 py-0.5 rounded-full ${item.score > 50 ? 'bg-red-500/50' : 'bg-green-500/50'} text-white">${item.score}% AI</span>
                    </div>
                    <p class="text-sm text-gray-400">${item.conclusion}</p>
                </div>
            `;
        }
    }
    analysisHtml += '</div>';

    return `
        <div class="p-6 bg-gray-700/50 rounded-lg space-y-4">
            <h2 class="text-2xl font-bold text-center ${isAi ? 'text-red-400' : 'text-green-400'}">${label}</h2>
            <div class="w-full bg-gray-600 rounded-full h-4">
                <div class="${confidenceColor} h-4 rounded-full" style="width: ${score}%"></div>
            </div>
            <div class="text-center text-gray-300">
                <span class="font-bold">${score}%</span> ${confidenceText}
            </div>
            <p class="text-sm text-gray-400 text-center pb-4">${interpretation}</p>
            
            ${analysis ? analysisHtml : ''}
        </div>
    `;
}

export function createMetadataDisplay(metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
        return '<p class="text-gray-400">No EXIF metadata found in this image.</p>';
    }
    
    // Highlight potential AI-related software tags
    const softwareRegex = /midjourney|dall-e|stable diffusion|photoshop|lightroom/i;
    
    let html = '<ul>';
    for (const tag in metadata) {
        if (Object.prototype.hasOwnProperty.call(metadata, tag)) {
            let value = metadata[tag];
            let highlightClass = '';
            if (tag.toLowerCase() === 'software' && softwareRegex.test(value)) {
                highlightClass = 'text-red-400 font-bold';
            }
            html += `<li class="py-1 border-b border-gray-700"><strong class="text-cyan-400">${tag}:</strong> <span class="${highlightClass}">${value}</span></li>`;
        }
    }
    html += '</ul>';
    return html;
}

