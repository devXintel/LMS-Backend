const fs = require('fs');
const path = require('path');

function getWavDuration(filePath) {
    const buffer = fs.readFileSync(filePath);
    const fmtIndex = buffer.indexOf('fmt ');
    if (fmtIndex === -1) throw new Error('Not a valid WAV file');
    const byteRate = buffer.readUInt32LE(fmtIndex + 8 + 8); // Skip Subchunk1ID and Subchunk1Size
    
    const dataIndex = buffer.indexOf('data');
    if (dataIndex === -1) throw new Error('No data chunk found in WAV');
    const dataSize = buffer.readUInt32LE(dataIndex + 4);
    
    return dataSize / byteRate;
}

const testFile = path.join(__dirname, '../public/audio/benchmark_test_en_bf_isabella.wav');
if (fs.existsSync(testFile)) {
    try {
        const dur = getWavDuration(testFile);
        console.log(`Successfully calculated WAV duration: ${dur.toFixed(3)}s`);
    } catch (err) {
        console.error('Error calculating WAV duration:', err);
    }
} else {
    console.log(`Test file not found at: ${testFile}`);
}
