const axios = require('axios');
const API_BASE_URL = 'http://localhost:5000';

async function verifyLinks() {
    console.log('🚀 Starting verification of S3 public URLs storage...');

    try {
        // 1. Fetch valid data
        const boardsRes = await axios.get(`${API_BASE_URL}/courses/boards`);
        const categoriesRes = await axios.get(`${API_BASE_URL}/courses/categories`);
        const validBoard = boardsRes.data.boards[0]?.name || 'CBSE';
        const validCategory = categoriesRes.data.categories.find(c => c.name.includes('Class'))?.name || 'Class 10';

        // 2. Create Syllabus
        console.log('Step 1: Creating syllabus...');
        const syllabusResponse = await axios.post(`${API_BASE_URL}/subject-syllabus/upload`, {
            subjectName: 'URL Test ' + Date.now(),
            category: validCategory,
            board: validBoard,
            existingPath: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            existingName: 'dummy.pdf'
        });

        const syllabusId = syllabusResponse.data.id;
        console.log(`✅ Syllabus created. ID: ${syllabusId}`);
        console.log('Waiting for embedding generation (approx 40s)...');
        await new Promise(resolve => setTimeout(resolve, 40000));

        // 3. Verify DB Columns
        console.log('\nStep 2: Checking DB columns for URLs...');
        const checkRes = await axios.get(`${API_BASE_URL}/subject-syllabus`);
        const latest = checkRes.data.find(s => s.id === syllabusId);

        if (latest) {
            console.log(`Embedded Column: ${latest.embedded}`);
            console.log(`OriginalFile Column: ${latest.originalFile}`);

            if (latest.embedded?.startsWith('http') && latest.originalFile?.startsWith('http')) {
                console.log('✅ Success: Columns contain full S3 URLs.');
            } else {
                console.error('❌ Failure: Columns DO NOT contain full URLs.');
            }
        } else {
            console.error('❌ Syllabus not found.');
        }

        // 4. Trigger Deletion
        console.log('\nStep 3: Triggering deletion (cleanup check)...');
        await axios.delete(`${API_BASE_URL}/subject-syllabus/${syllabusId}`);
        console.log('✅ Syllabus deleted.');
        console.log('Final check: Check backend logs for "Successfully deleted S3 folder".');

    } catch (error) {
        console.error('❌ Verification failed:', error.response ? error.response.data : error.message);
    }
}

verifyLinks();
