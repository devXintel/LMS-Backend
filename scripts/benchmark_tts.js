const ttsService = require('../src/services/tts.service');

async function run() {
  console.log("Pre-warming TTS...");
  await ttsService.init();
  console.log("TTS engine ready. Benchmarking generation...");
  
  const start = Date.now();
  const url = await ttsService.generate(
    "This is a test sentence to evaluate the acoustic velocity of standard machine configurations.",
    "bf_isabella",
    "benchmark_test"
  );
  const duration = Date.now() - start;
  
  console.log(`\nGeneration complete!`);
  console.log(`URL: ${url}`);
  console.log(`Time taken: ${(duration/1000).toFixed(2)}s`);
}

run().catch(console.error);
