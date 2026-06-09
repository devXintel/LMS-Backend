const fetch = require('node-fetch');

async function testActiveVoiceRoute() {
    try {
        const response = await fetch('http://localhost:5000/api/voice/active');
        if (response.ok) {
            const data = await response.json();
            console.log("SUCCESS: Active voice data:", JSON.stringify(data, null, 2));
        } else {
            console.error("FAILED: Response status:", response.status);
            const text = await response.text();
            console.error("Error body:", text);
        }
    } catch (err) {
        console.error("ERROR: Could not connect to backend:", err.message);
    }
}

testActiveVoiceRoute();
