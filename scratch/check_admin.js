const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Fetching registered Admin users...");
        const admins = await prisma.user.findMany({
            where: {
                role: 'admin'
            },
            select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
                createdAt: true
            }
        });

        console.log("\n--- REGISTERED ADMINS ---");
        if (admins.length === 0) {
            console.log("No admin users found in the database.");
        } else {
            admins.forEach(admin => {
                console.log(`ID: ${admin.id} | Name: ${admin.name} | Email: ${admin.email} | Active: ${admin.isActive} | Created: ${admin.createdAt}`);
            });
        }
        console.log("-------------------------\n");
    } catch (err) {
        console.error("Error fetching admins:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
