const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.lessonCache.findMany({
  select: { id: true, language: true, status: true, generatedAt: true, contentNodeId: true, lessonText: true }
}).then(rows => {
  if (rows.length === 0) {
    console.log('lesson_cache is EMPTY — lessons will be generated fresh on next load.');
    return;
  }
  console.log(`\nlesson_cache — ${rows.length} row(s):\n`);
  rows.forEach(r => {
    const lines = r.lessonText.split('\n').filter(l => l.trim());
    let jsonlCount = 0;
    for (const l of lines) {
      try { if (JSON.parse(l).text) jsonlCount++; } catch {}
    }
    const format = jsonlCount >= 3 ? 'JSONL ✔' : 'OLD FORMAT ✖';
    console.log(`  id=${r.id}  nodeId=${r.contentNodeId}  lang=${r.language}  segments=${jsonlCount}  format=${format}  status=${r.status}`);
  });
}).catch(e => {
  console.error('DB error:', e.message);
}).finally(() => p.$disconnect());
