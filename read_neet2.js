const axios = require('axios');
const PDFParser = require('pdf2json');
const fs = require('fs');

const URL = 'https://ai-lms-storage.s3.us-east-1.amazonaws.com/syllabus/exams/1/1772096212731-neet2.pdf';

async function run() {
    console.log('Downloading...');
    const resp = await axios.get(URL, { responseType: 'arraybuffer', timeout: 30000 });
    const buf = Buffer.from(resp.data);
    console.log('Size:', buf.length, 'bytes');

    const parser = new PDFParser(null, 1);
    parser.on('pdfParser_dataError', e => console.error('PDF parse error:', e));
    parser.on('pdfParser_dataReady', () => {
        const text = parser.getRawTextContent();
        fs.writeFileSync('neet2_raw.txt', text);
        console.log('Text length:', text.length);
        // Show first 3000 chars
        console.log('\n--- FIRST 3000 CHARS ---\n', text.substring(0, 3000));
    });
    parser.parseBuffer(buf);
}
run().catch(console.error);
