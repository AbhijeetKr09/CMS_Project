import prisma from '../prismaClient.js';

// ─── LIST all airlines ───────────────────────────────────────────────────────
export const listAirlines = async (req, res) => {
    try {
        const airlines = await prisma.airline.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { reviews: true } } },
        });
        res.json(airlines);
    } catch (err) {
        console.error('[AirlineCms] listAirlines:', err);
        res.status(500).json({ message: 'Failed to fetch airlines.' });
    }
};

// ─── CREATE airline ──────────────────────────────────────────────────────────
export const createAirline = async (req, res) => {
    const { name } = req.body;
    if (!name?.trim())
        return res.status(400).json({ message: 'name is required.' });

    try {
        const airline = await prisma.airline.create({ data: { name: name.trim() } });
        res.status(201).json(airline);
    } catch (err) {
        if (err.code === 'P2002')
            return res.status(409).json({ message: 'Airline with this name already exists.' });
        console.error('[AirlineCms] createAirline:', err);
        res.status(500).json({ message: 'Failed to create airline.' });
    }
};

// ─── UPDATE airline ──────────────────────────────────────────────────────────
export const updateAirline = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim())
        return res.status(400).json({ message: 'name is required.' });

    try {
        const airline = await prisma.airline.update({
            where: { id: parseInt(id) },
            data: { name: name.trim() },
        });
        res.json(airline);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ message: 'Airline not found.' });
        if (err.code === 'P2002') return res.status(409).json({ message: 'Airline name already exists.' });
        console.error('[AirlineCms] updateAirline:', err);
        res.status(500).json({ message: 'Failed to update airline.' });
    }
};

// ─── DELETE airline ──────────────────────────────────────────────────────────
export const deleteAirline = async (req, res) => {
    try {
        await prisma.airline.delete({ where: { id: parseInt(req.params.id) } });
        res.json({ message: 'Airline deleted.' });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ message: 'Airline not found.' });
        console.error('[AirlineCms] deleteAirline:', err);
        res.status(500).json({ message: 'Failed to delete airline.' });
    }
};

// ─── LIST flight reviews (read-only, paginated) ──────────────────────────────
export const listReviews = async (req, res) => {
    const { airlineId, page = 1, limit = 30, rating } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (airlineId) where.airlineId = parseInt(airlineId);
    if (rating)    where.rating    = parseInt(rating);

    try {
        const [reviews, total] = await Promise.all([
            prisma.flightReview.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit),
                include: { airline: { select: { id: true, name: true } } },
            }),
            prisma.flightReview.count({ where }),
        ]);
        res.json({ reviews, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('[AirlineCms] listReviews:', err);
        res.status(500).json({ message: 'Failed to fetch reviews.' });
    }
};
