const axios = require('axios');
require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function testGroq() {
    console.log('\n--- Testing Groq API Key ---');
    console.log('Key:', GROQ_API_KEY ? `${GROQ_API_KEY.slice(0, 8)}...` : 'undefined');
    if (!GROQ_API_KEY) {
        console.log('No Groq API Key found.');
        return;
    }
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: 'Say test' }],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });
        console.log('Groq Success! Response:', JSON.stringify(response.data));
    } catch (err) {
        console.error('Groq Failed!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data));
        } else {
            console.error('Error Message:', err.message);
        }
    }
}

async function testOpenRouter() {
    console.log('\n--- Testing OpenRouter API Key ---');
    console.log('Key:', OPENROUTER_API_KEY ? `${OPENROUTER_API_KEY.slice(0, 8)}...` : 'undefined');
    if (!OPENROUTER_API_KEY) {
        console.log('No OpenRouter API Key found.');
        return;
    }
    try {
        const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: 'deepseek/deepseek-r1:free',
            messages: [{ role: 'user', content: 'Say test' }],
            max_tokens: 10
        }, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://lms.local',
                'X-Title': 'LMS AI Tutor'
            }
        });
        console.log('OpenRouter Success! Response:', JSON.stringify(response.data));
    } catch (err) {
        console.error('OpenRouter Failed!');
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data));
        } else {
            console.error('Error Message:', err.message);
        }
    }
}

async function run() {
    await testGroq();
    await testOpenRouter();
}

run();
