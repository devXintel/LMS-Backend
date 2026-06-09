require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });
const { getTeachingResponseStream } = require('../../lms-ai/services/teach');

async function testStream() {
    console.log('--- Starting getTeachingResponseStream Diagnostic Test ---');
    const req = {
        subject: 'Physics',
        chapter: 'Units of Measurements',
        subtopic: 'Introduction to Units',
        userMessage: 'start',
        isLecture: true,
        language: 'tamil'
    };

    try {
        const stream = getTeachingResponseStream(req);
        let accumulated = '';
        for await (const chunk of stream) {
            accumulated += chunk;
        }
        console.log('\n--- Final Output ---');
        console.log(accumulated.slice(0, 500));
    } catch (err) {
        console.error('\n--- Streaming Exception Thrown ---');
        console.error(err);
    }
}

testStream();
