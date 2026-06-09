const tts = require('../src/services/tts.service');

async function run() {
  console.log("Attempting to initialize TTS service...");
  await tts.init();
  console.log("TTS Service initialized successfully!");
  
  console.log("Attempting a dry run generate...");
  const url = await tts.generate("Hello physics student. Let's study units.", "af_heart", "dry_run_test");
  console.log("TTS generation successful! URL:", url);
}

run().catch(console.error);
