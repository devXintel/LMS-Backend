require('dotenv').config({ path: require('path').join(__dirname, '../lms-ai/.env') });

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function testGroq() {
    console.log("Key:", GROQ_API_KEY ? "Loaded" : "Missing");
    try {
        const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{role: 'user', content: 'Say hello'}],
                max_tokens: 50,
                temperature: 0.5,
                stream: true
            }),
        });
        console.log("Status:", response.status, response.statusText);
        if (!response.ok) {
            console.log(await response.text());
        }
    } catch (e) {
        console.error(e);
    }
}
testGroq();
