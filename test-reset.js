const fetch = require('node-fetch');

async function testReset() {
    const userId = 1; // Assuming user ID 1 exists and has a profile

    console.log(`Testing reset for user ${userId}...`);

    try {
        const response = await fetch('http://localhost:5000/academic-profile/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Success:', data.message);
            console.log('Updated Profile:', data.profile);

            // Verify fields are null
            const { category, board, state, medium, exam, stream, schoolName } = data.profile;
            if (category === null && board === null && state === null && medium === null && exam === null && stream === null && schoolName === null) {
                console.log('Verification: All fields successfully reset to null.');
            } else {
                console.error('Verification FAILED: Some fields are not null.');
            }
        } else {
            console.error('Error:', data.message);
        }
    } catch (error) {
        console.error('Fetch error:', error.message);
    }
}

testReset();
