const axios = require('axios');

async function test() {
    try {
        console.log('Sending request to /teach...');
        const res = await axios.post('http://localhost:5000/teach', {
            subject: 'PHYSICS',
            chapter: 'UNITS AND MEASUREMENT',
            subtopic: 'Units of measurements',
            userMessage: 'start',
            history: [],
            language: 'english'
        }, { responseType: 'stream' });

        console.log('Connection opened, reading stream:');
        res.data.on('data', (chunk) => {
            process.stdout.write(chunk.toString());
        });
        res.data.on('end', () => {
            console.log('\nStream finished.');
        });
    } catch (err) {
        console.error('Request failed:', err.response ? err.response.data : err.message);
    }
}

test();
