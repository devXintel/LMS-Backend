require('ts-node/register');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../lms-ai/.env') });

console.log('API Key present:', !!process.env.OPENROUTER_API_KEY);

try {
    const teachService = require('../lms-ai/services/teach');
    console.log('Service exported functions:', Object.keys(teachService));

    if (teachService.getTeachingResponseStream) {
        console.log('getTeachingResponseStream is available');
    } else {
        console.error('getTeachingResponseStream is MISSING from exports!');
    }
} catch (err) {
    console.error('Failed to require teach service:', err);
}
