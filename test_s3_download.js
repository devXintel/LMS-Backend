const { S3Client, GetObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');

const s3 = new S3Client({ region: 'us-east-1' });
const BUCKET = 'ai-lms-storage';
const KEY = 'syllabus/exams/1/1772096212731-neet2.pdf';

async function run() {
    // First list the bucket to see what exists
    console.log('Listing bucket...');
    const list = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'syllabus/exams/1/' }));
    console.log('Files in syllabus/exams/1/:');
    (list.Contents || []).forEach(f => console.log(' ', f.Key, f.Size, 'bytes'));

    // Try to download the file
    console.log('\nTrying to download:', KEY);
    try {
        const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
        const chunks = [];
        for await (const chunk of resp.Body) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const buf = Buffer.concat(chunks);
        fs.writeFileSync('neet2_downloaded.pdf', buf);
        console.log('Downloaded:', buf.length, 'bytes → neet2_downloaded.pdf');
    } catch (e) {
        console.error('Download error:', e.message);
        console.error('Code:', e.Code || e.name);
    }
}

run().catch(console.error);
