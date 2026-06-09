const PDFParser = require("pdf2json");
const fs = require('fs');

function extractTextFromPdf(pdfPath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(this, 1);
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", () => {
            resolve(pdfParser.getRawTextContent());
        });
        pdfParser.loadPDF(pdfPath);
    });
}

const pdfFile = 'C:\\Users\\SMILE\\OneDrive\\Desktop\\lms1\\backend\\public\\uploads\\1769178320600-103616716-Neet.pdf';

extractTextFromPdf(pdfFile).then(text => {
    const subjects = ['PHYSICS', 'CHEMISTRY', 'BIOLOGY'];
    const JSONResult = [];

    for (let i = 0; i < subjects.length; i++) {
        const currentSubject = subjects[i];
        const nextSubject = subjects[i + 1] || null;

        const startIndex = text.indexOf(currentSubject);
        const endIndex = nextSubject ? text.indexOf(nextSubject, startIndex) : text.length;

        if (startIndex !== -1) {
            const block = text.substring(startIndex, endIndex);
            const unitRegex = /UNIT\s*[\dIVX]+\s*[:\-]\s*([^\r\n]+)/gi;
            let match;
            const chapters = [];
            while ((match = unitRegex.exec(block)) !== null) {
                chapters.push(match[1].trim());
            }
            JSONResult.push({
                subject: currentSubject.charAt(0).toUpperCase() + currentSubject.slice(1).toLowerCase(),
                chapters: chapters
            });
        }
    }

    console.log(JSON.stringify(JSONResult, null, 2));

}).catch(console.error);
