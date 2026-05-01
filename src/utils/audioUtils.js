/**
 * Extracts waveform data from an audio Blob.
 * @param {Blob} blob - The audio blob.
 * @param {number} samples - Number of samples (bars) to generate.
 * @returns {Promise<number[]>} - Normalized array of numbers (0 to 1).
 */
export const extractWaveformData = async (blob, samples = 40) => {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const rawData = audioBuffer.getChannelData(0); // Get first channel
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        
        for (let i = 0; i < samples; i++) {
            let blockStart = blockSize * i;
            let sum = 0;
            for (let j = 0; j < blockSize; j++) {
                sum = sum + Math.abs(rawData[blockStart + j]);
            }
            filteredData.push(sum / blockSize);
        }
        
        // Normalize
        const maxAmplitude = Math.max(...filteredData);
        if (maxAmplitude === 0) {
            // Silent audio - return all zeros or a small baseline
            return Array.from({ length: samples }, () => 0.1);
        }
        
        const multiplier = 1 / maxAmplitude;
        return filteredData.map(n => Math.min(1, n * multiplier));
    } catch (error) {
        console.error("Error extracting waveform:", error);
        // Fallback to minimal data if extraction fails
        return Array.from({ length: samples }, () => 0.1 + Math.random() * 0.2);
    }
};
