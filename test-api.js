async function testEndpoint() {
  try {
    const res = await fetch('http://localhost:57502/tests/generate-from-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: "Physics",
        chapter: "Motion",
        subtopic: "Velocity",
        language: "english"
      })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}
testEndpoint();
