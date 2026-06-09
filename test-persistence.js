const axios = require('axios');
const API_BASE_URL = 'http://localhost:5000';

async function createPersistentTest() {
    console.log('🚀 Creating a persistent test record (NO DELETION)...');

    try {
        // 1. Fetch valid data
        const boardsRes = await axios.get(`${API_BASE_URL}/courses/boards`);
        const categoriesRes = await axios.get(`${API_BASE_URL}/courses/categories`);
        const validBoard = boardsRes.data.boards[0]?.name || 'CBSE';
        const validCategory = categoriesRes.data.categories.find(c => c.name.includes('Class'))?.name || 'Class 10';

        // 2. Create Syllabus
        console.log('Creating syllabus...');
        const syllabusResponse = await axios.post(`${API_BASE_URL}/subject-syllabus/upload`, {
            subjectName: 'Persistent Test ' + Date.now(),
            category: validCategory,
            board: validBoard,
            existingPath: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            existingName: 'dummy.pdf'
        });

        const syllabusId = syllabusResponse.data.id;
        console.log(`✅ Syllabus created. ID: ${syllabusId}`);
        console.log('Waiting for embedding generation (approx 40s)...');
        console.log('I will NOT delete this record so you can see it in Neon.');

        await new Promise(resolve => setTimeout(resolve, 40000));

        // 3. Final Check
        const checkRes = await axios.get(`${API_BASE_URL}/subject-syllabus`);
        const latest = checkRes.data.find(s => s.id === syllabusId);

        if (latest) {
            console.log('\n--- SUCCESS ---');
            console.log(`ID: ${latest.id}`);
            console.log(`Embedded Column: ${latest.embedded}`);
            console.log(`OriginalFile Column: ${latest.originalFile}`);
            console.log('Please check your Neon DB console now!');
        } else {
            console.error('❌ Failed to find record after generation.');
        }

    } catch (error) {
        console.error('❌ Error:', error.response ? error.response.data : error.message);
    }
}

createPersistentTest();
