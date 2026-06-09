// use native fetch in node v22

async function run() {
  console.log("Calling /exam-syllabus/chapters/NEET...");
  const res = await fetch('http://localhost:5000/exam-syllabus/chapters/NEET');
  const data = await res.json();
  console.log("Response Status:", res.status);
  console.log("Response Data:", JSON.stringify(data, null, 2).substring(0, 1000));
}

run().catch(console.error);
