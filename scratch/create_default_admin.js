const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    const adminEmail = 'admin@lms.com';
    const rawPassword = 'admin123';

    try {
        console.log(`Checking if admin user '${adminEmail}' already exists...`);
        const existing = await prisma.user.findUnique({
            where: { email: adminEmail }
        });

        if (existing) {
            console.log(`User '${adminEmail}' already exists with role: ${existing.role}`);
            if (existing.role !== 'admin') {
                console.log("Updating role to 'admin'...");
                await prisma.user.update({
                    where: { email: adminEmail },
                    data: { role: 'admin', isVerified: true, isActive: true }
                });
                console.log("Role successfully updated to 'admin'!");
            }
            return;
        }

        console.log("Hashing password...");
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        console.log("Creating new admin user in the database...");
        const newAdmin = await prisma.user.create({
            data: {
                name: 'LMS Admin',
                email: adminEmail,
                password: hashedPassword,
                phone: BigInt('9876543210'),
                role: 'admin',
                isVerified: true,
                isActive: true
            }
        });

        console.log("\n--- DEFAULT ADMIN CREATED SUCCESSFULLY ---");
        console.log(`Name:     ${newAdmin.name}`);
        console.log(`Email:    ${newAdmin.email}`);
        console.log(`Password: ${rawPassword}`);
        console.log(`Role:     ${newAdmin.role}`);
        console.log("------------------------------------------\n");

    } catch (err) {
        console.error("Error creating default admin:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
