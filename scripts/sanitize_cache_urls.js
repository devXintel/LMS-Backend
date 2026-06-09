require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const caches = await prisma.lessonCache.findMany();
  console.log(`Found ${caches.length} cache entries. Sanitizing...`);
  
  let updatedCount = 0;
  for (const cache of caches) {
    let needsUpdate = false;
    let updatedVisualUrls = cache.visualUrls;
    let updatedLessonText = cache.lessonText;

    if (cache.visualUrls) {
      const urlsString = JSON.stringify(cache.visualUrls);
      if (urlsString.includes('model=flux')) {
        needsUpdate = true;
        const cleanedString = urlsString
          .replace(/&model=flux/gi, '')
          .replace(/\?model=flux&/gi, '?')
          .replace(/\?model=flux/gi, '');
        updatedVisualUrls = JSON.parse(cleanedString);
      }
    }
    
    if (cache.lessonText && cache.lessonText.includes('model=flux')) {
      needsUpdate = true;
      updatedLessonText = cache.lessonText
        .replace(/&model=flux/gi, '')
        .replace(/\?model=flux&/gi, '?')
        .replace(/\?model=flux/gi, '');
    }

    if (needsUpdate) {
      await prisma.lessonCache.update({
        where: { id: cache.id },
        data: {
          visualUrls: updatedVisualUrls,
          lessonText: updatedLessonText
        }
      });
      updatedCount++;
    }
  }

  console.log(`Finished sanitization. Updated ${updatedCount} cache entries.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
