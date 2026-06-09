const prisma = require('../config/prisma');

const getAllPayments = async (req, res) => {
    try {
        const payments = await prisma.paymentDetail.findMany({
            include: {
                user: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                date: 'desc'
            }
        });

        // Map data to ensure userName is prioritized from the relation if available
        const formattedPayments = payments.map(payment => ({
            ...payment,
            userName: payment.user?.name || payment.userName
        }));

        res.json(formattedPayments);
    } catch (error) {
        console.error("Error fetching payments:", error);
        res.status(500).json({ error: 'Error fetching payments' });
    }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const { month, year } = req.query;
        const currentYear = parseInt(year) || new Date().getFullYear();

        // 1. Fetch all successful payments for the specified year
        const payments = await prisma.paymentDetail.findMany({
            where: {
                status: 'Success',
                date: {
                    gte: new Date(`${currentYear}-01-01`),
                    lte: new Date(`${currentYear}-12-31T23:59:59`)
                }
            },
            orderBy: {
                date: 'desc'
            }
        });

        // 2. Calculate KPI Metrics
        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalTransactions = payments.length;
        const avgOrderValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

        // 2a. Calculate Dynamic Conversion Rate
        const totalUsers = await prisma.user.count();
        const uniquePayingUsers = new Set(payments.map(p => p.userId).filter(Boolean)).size;
        const conversionRate = totalUsers > 0 ? ((uniquePayingUsers / totalUsers) * 100).toFixed(1) + "%" : "0%";

        // 3. Prepare Graph Data (Monthly)
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthRevenue = payments
                .filter(p => new Date(p.date).getMonth() === i)
                .reduce((sum, p) => sum + p.amount, 0);
            return { label: months[i], value: monthRevenue };
        });

        // 4. Prepare Graph Data (Weekly if month selected)
        let weeklyData = [];
        if (month && month !== "All") {
            const monthIdx = [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"
            ].indexOf(month);

            if (monthIdx !== -1) {
                // Simplified: Group by 4 weeks
                weeklyData = Array.from({ length: 4 }, (_, i) => {
                    const weekRevenue = payments
                        .filter(p => {
                            const d = new Date(p.date);
                            return d.getMonth() === monthIdx && Math.floor(d.getDate() / 7) === i;
                        })
                        .reduce((sum, p) => sum + p.amount, 0);
                    return { label: `Week ${i + 1}`, value: weekRevenue };
                });
            }
        }

        // 5. Recent Sales (Last 5 successful)
        const recentSales = payments.slice(0, 5).map(p => ({
            id: p.id,
            user: p.userName,
            amount: p.amount,
            date: new Date(p.date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            })
        }));

        res.json({
            metrics: {
                totalRevenue,
                avgOrderValue,
                totalTransactions,
                conversionRate
            },
            monthlyData,
            weeklyData,
            recentSales
        });
    } catch (error) {
        console.error("Error fetching revenue analytics:", error);
        res.status(500).json({ error: 'Error fetching revenue analytics' });
    }
};

const seedPayments = async (req, res) => {
    try {
        // Delete all existing payments to ensure fresh seed with plan names
        await prisma.paymentDetail.deleteMany({});

        // Use user ID 28 (reshma) for seeding
        const initialPayments = [
            {
                transactionId: "TXN001",
                userId: 28,
                userName: "reshma",
                planName: "Monthly Standard",
                amount: 999,
                date: new Date("2025-01-05"),
                method: "UPI",
                status: "Success",
            },
            {
                transactionId: "TXN002",
                userId: 28,
                userName: "reshma",
                planName: "Yearly Premium",
                amount: 4999,
                date: new Date("2025-01-03"),
                method: "Card",
                status: "Failed",
            },
            {
                transactionId: "TXN003",
                userName: "Rahul Verma",
                planName: "Monthly Premium",
                amount: 1999,
                date: new Date("2025-02-02"),
                method: "Net Banking",
                status: "Success",
            },
            {
                transactionId: "TXN004",
                userName: "ram",
                planName: "Monthly Standard",
                amount: 999,
                date: new Date("2025-01-02"),
                method: "Net Banking",
                status: "Success",
            },
        ];

        await prisma.paymentDetail.createMany({
            data: initialPayments
        });

        res.json({ message: 'Payments seeded successfully' });
    } catch (error) {
        console.error("Error seeding payments:", error);
        res.status(500).json({ error: 'Error seeding payments' });
    }
};

module.exports = {
    getAllPayments,
    getRevenueAnalytics,
    seedPayments
};
