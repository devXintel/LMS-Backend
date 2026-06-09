const prisma = require('../config/prisma');

const getAllPlans = async (req, res) => {
    try {
        const plans = await prisma.subscriptionPlan.findMany({
            orderBy: {
                price: 'asc' // Order by price for better display
            }
        });
        res.json(plans);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching plans' });
    }
};

const createPlan = async (req, res) => {
    const { name, price, cycle, description, features } = req.body;



    try {
        const newPlan = await prisma.subscriptionPlan.create({
            data: {
                name,
                price,
                cycle,
                description,
                features
            }
        });

        res.status(201).json(newPlan);
    } catch (error) {
        console.error("[DEBUG] Error creating plan:", error); // DEBUG LOG
        res.status(500).json({ error: 'Error creating plan', details: error.message });
    }
};

const updatePlan = async (req, res) => {
    const { id } = req.params;
    const { name, price, cycle, description, features } = req.body;
    try {
        const updatedPlan = await prisma.subscriptionPlan.update({
            where: { id: parseInt(id) },
            data: {
                name,
                price,
                cycle,
                description,
                features
            }
        });
        res.json(updatedPlan);
    } catch (error) {
        res.status(500).json({ error: 'Error updating plan' });
    }
};

const deletePlan = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.subscriptionPlan.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Plan deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error deleting plan' });
    }
};

module.exports = {
    getAllPlans,
    createPlan,
    updatePlan,
    deletePlan
};
