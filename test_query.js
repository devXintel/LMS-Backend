const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const util = require('util');
const { execFile } = require('child_process');
const path = require('path');
const execFilePromise = util.promisify(execFile);

async function main() {
    const s = await p.examSyllabus.findFirst({ where: { embedded: { not: null } } });
    if (!s) {
        console.log('No embedded URL found');
        return;
    }
    console.log('Testing with URL:', s.embedded);
    const scriptPath = path.join(__dirname, 'query_embeddings.py');
    try {
        const { stdout, stderr } = await execFilePromise('py', ['-3', scriptPath, '--s3_url', s.embedded, '--query', 'what is biology?'], {
            env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
        });
        console.log('STDOUT:\n', stdout);
        if (stderr) console.log('STDERR:\n', stderr);
    } catch (e) {
        console.error('Error:', e);
    }
    await p.$disconnect();
}
main();
