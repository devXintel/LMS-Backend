require('ts-node/register');
require('dotenv').config({ path: require('path').join(__dirname, '../lms-ai/.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getKeypointsOnly } = require('./src/controllers/teach.controller');

async function test() {
    // Clear keyPoints first to ensure we test generation
    console.log('Clearing keyPoints for contentNodeId=3, language=ta to test generation...');
    await prisma.lessonCache.updateMany({
        where: { contentNodeId: 3, language: 'ta' },
        data: { keyPoints: null }
    });

    const req = {
        body: {
            subtopicId: 3,
            language: 'ta',
            lessonText: null
        }
    };

    const res = {
        statusCode: 200,
        status: function(code) {
            this.statusCode = code;
            console.log('Response Status:', code);
            return this;
        },
        json: function(data) {
            console.log('Response JSON:', JSON.stringify(data, null, 2));
            return this;
        }
    };

    console.log('\nRunning getKeypointsOnly controller...');
    await getKeypointsOnly(req, res);

    // Query DB to verify it was saved
    console.log('\nVerifying DB cache entry...');
    const cached = await prisma.lessonCache.findUnique({
        where: { contentNodeId_language: { contentNodeId: 3, language: 'ta' } }
    });
    console.log('Saved keyPoints in DB:', cached.keyPoints);

    await prisma.$disconnect();
}

test().catch(console.error);
