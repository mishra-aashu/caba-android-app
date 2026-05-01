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
        const audioBuffer = await audioContext.decodeAudioBuffer(arrayBuffer);
        
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
        const multiplier = Math.pow(Math.max(...filteredData), -1);
        return filteredData.map(n => n * multiplier);
    } catch (error) {
        console.error("Error extracting waveform:", error);
        // Fallback to random data if extraction fails
        return Array.from({ length: samples }, () => Math.random());
    }
};
