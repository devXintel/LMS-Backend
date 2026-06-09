const axios = require('axios');
const PDFParser = require('pdf2json');
const fs = require('fs');
const path = require('path');

const PDF_URL = 'https://ai-lms-storage.s3.us-east-1.amazonaws.com/syllabus/exams/1/Neet.pdf';

async function run() {
    console.log('Downloading PDF from:', PDF_URL);
    const response = await axios.get(PDF_URL, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data);
    
    // Save locally for inspection
    const tmpPath = path.join(__dirname, 'neet_syllabus.pdf');
    fs.writeFileSync(tmpPath, buffer);
    console.log('Saved PDF locally:', tmpPath, '| Size:', buffer.length, 'bytes');

    // Extract text with pdf2json
    const pdfParser = new PDFParser(null, 1); // rawContent mode

    pdfParser.on('pdfParser_dataReady', (pdfData) => {
        const rawText = pdfParser.getRawTextContent();
        const outputPath = path.join(__dirname, 'neet_raw_text.txt');
        fs.writeFileSync(outputPath, rawText);
        console.log('Raw text extracted! Length:', rawText.length, 'chars');
        console.log('Saved to:', outputPath);
        console.log('\n--- FULL TEXT ---\n');
        console.log(rawText);
    });

    pdfParser.on('pdfParser_dataError', (errData) => {
        console.error('PDF parse error:', errData.parserError);
    });

    pdfParser.parseBuffer(buffer);
}

run().catch(console.error);
