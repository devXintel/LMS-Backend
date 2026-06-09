const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('--- Indic Cache Cleanup ---');
  
  // 1. Delete DB cache entries for regional languages
  try {
    const result = await prisma.lessonCache.deleteMany({
      where: {
        language: { in: ['ta', 'te', 'ml', 'kn', 'hi', 'tamil', 'telugu', 'malayalam', 'hindi', 'kannada'] }
      }
    });
    console.log(`✅ Deleted ${result.count} DB cache entries.`);
  } catch (err) {
    console.error('❌ Failed to clear DB cache:', err.message);
  }

  // 2. Delete generated audio files
  const audioDir = path.join(__dirname, 'public/audio/indic');
  if (fs.existsSync(audioDir)) {
    try {
      const files = fs.readdirSync(audioDir);
      let count = 0;
      for (const file of files) {
        if (file.endsWith('.mp3')) {
          fs.unlinkSync(path.join(audioDir, file));
          count++;
        }
      }
      console.log(`✅ Deleted ${count} audio files from ${audioDir}.`);
    } catch (err) {
      console.error('❌ Failed to clear audio files:', err.message);
    }
  } else {
    console.log('ℹ️ Audio directory not found at:', audioDir);
  }

  console.log('--- Cleanup Complete ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
