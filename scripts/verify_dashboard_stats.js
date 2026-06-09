const prisma = require('../src/config/prisma');

async function verifyStats() {
    try {
        console.log("Fetching UserAcademicProfiles...");
        const profiles = await prisma.userAcademicProfile.findMany({
            select: {
                category: true
            }
        });

        console.log(`Found ${profiles.length} profiles.`);

        const stats = {
            "Class 1–5": 0,
            "Class 6–8": 0,
            "Class 9–10": 0,
            "Class 11–12": 0,
            "Competitive Exams": 0
        };

        const details = {
            "Class 1–5": [],
            "Class 6–8": [],
            "Class 9–10": [],
            "Class 11–12": [],
            "Competitive Exams": [],
            "Uncategorized": []
        };

        profiles.forEach(p => {
            const category = p.category;
            if (category) {
                if (['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].includes(category)) {
                    stats["Class 1–5"]++;
                    details["Class 1–5"].push(category);
                } else if (['Class 6', 'Class 7', 'Class 8'].includes(category)) {
                    stats["Class 6–8"]++;
                    details["Class 6–8"].push(category);
                } else if (['Class 9', 'Class 10'].includes(category)) {
                    stats["Class 9–10"]++;
                    details["Class 9–10"].push(category);
                } else if (['Class 11', 'Class 12'].includes(category)) {
                    stats["Class 11–12"]++;
                    details["Class 11–12"].push(category);
                } else if (category === 'Aspirant') {
                    stats["Competitive Exams"]++;
                    details["Competitive Exams"].push(category);
                } else {
                    details["Uncategorized"].push(category);
                }
            } else {
                details["Uncategorized"].push("NULL");
            }
        });

        console.log("--- Calculated Stats ---");
        console.log(JSON.stringify(stats, null, 2));

        console.log("\n--- Category Breakdowns (First 5 per group) ---");
        for (const [key, val] of Object.entries(details)) {
            console.log(`${key}: ${val.slice(0, 5).join(', ')}${val.length > 5 ? '...' : ''} (Total: ${val.length})`);
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verifyStats();
