require('dotenv').config();
const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function testGroq() {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "Say hello" }]
      })
    });
    const text = await response.text();
    console.log(response.status, text);
  } catch (e) {
    console.error(e);
  }
}
testGroq();
