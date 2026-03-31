import prisma from '../prismaClient.js';

const VALID_REGIONS = ['Asia', 'Gulf/Middle East', 'North America', 'South America', 'Europe', 'Africa', 'Oceania'];

// ─── LIST all events (past + upcoming, paginated) ────────────────────────────
export const listEvents = async (req, res) => {
    const { page = 1, limit = 20, region, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (region) where.region = region;
    if (status === 'upcoming') where.date = { gte: new Date() };
    else if (status === 'past') where.date = { lt: new Date() };

    try {
        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                orderBy: { date: 'desc' },
                skip,
                take: parseInt(limit),
            }),
            prisma.event.count({ where }),
        ]);
        res.json({ events, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
    } catch (err) {
        console.error('[EventCms] listEvents:', err);
        res.status(500).json({ message: 'Failed to fetch events.' });
    }
};

// ─── GET single event ────────────────────────────────────────────────────────
export const getEvent = async (req, res) => {
    try {
        const event = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!event) return res.status(404).json({ message: 'Event not found.' });
        res.json(event);
    } catch (err) {
        console.error('[EventCms] getEvent:', err);
        res.status(500).json({ message: 'Failed to fetch event.' });
    }
};

// ─── CREATE event ────────────────────────────────────────────────────────────
export const createEvent = async (req, res) => {
    const {
        eventName, eventLink, venue, onlineOrOffline, freeOrPaid,
        date, time, eventType, region, image, lat, lng,
        country, description, organizedBy, images = [],
    } = req.body;

    if (!eventName || !date || !region)
        return res.status(400).json({ message: 'eventName, date, and region are required.' });
    if (!VALID_REGIONS.includes(region))
        return res.status(400).json({ message: `Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}` });

    try {
        const event = await prisma.event.create({
            data: {
                eventName, eventLink: eventLink || '', venue: venue || '',
                onlineOrOffline: onlineOrOffline || 'Offline',
                freeOrPaid: freeOrPaid || 'Free',
                date: new Date(date),
                time: time || '',
                eventType: eventType || '',
                region, image: image || '',
                lat: parseFloat(lat) || 0,
                lng: parseFloat(lng) || 0,
                country: country || '',
                description, organizedBy,
                images: images || [],
            },
        });
        res.status(201).json(event);
    } catch (err) {
        console.error('[EventCms] createEvent:', err);
        res.status(500).json({ message: 'Failed to create event.' });
    }
};

// ─── UPDATE event ────────────────────────────────────────────────────────────
export const updateEvent = async (req, res) => {
    const { id } = req.params;
    const {
        eventName, eventLink, venue, onlineOrOffline, freeOrPaid,
        date, time, eventType, region, image, lat, lng,
        country, description, organizedBy, images,
    } = req.body;

    if (region && !VALID_REGIONS.includes(region))
        return res.status(400).json({ message: `Invalid region. Must be one of: ${VALID_REGIONS.join(', ')}` });

    try {
        const existing = await prisma.event.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ message: 'Event not found.' });

        const event = await prisma.event.update({
            where: { id },
            data: {
                ...(eventName       !== undefined && { eventName }),
                ...(eventLink       !== undefined && { eventLink }),
                ...(venue           !== undefined && { venue }),
                ...(onlineOrOffline !== undefined && { onlineOrOffline }),
                ...(freeOrPaid      !== undefined && { freeOrPaid }),
                ...(date            !== undefined && { date: new Date(date) }),
                ...(time            !== undefined && { time }),
                ...(eventType       !== undefined && { eventType }),
                ...(region          !== undefined && { region }),
                ...(image           !== undefined && { image }),
                ...(lat             !== undefined && { lat: parseFloat(lat) }),
                ...(lng             !== undefined && { lng: parseFloat(lng) }),
                ...(country         !== undefined && { country }),
                ...(description     !== undefined && { description }),
                ...(organizedBy     !== undefined && { organizedBy }),
                ...(images          !== undefined && { images }),
            },
        });
        res.json(event);
    } catch (err) {
        console.error('[EventCms] updateEvent:', err);
        res.status(500).json({ message: 'Failed to update event.' });
    }
};

// ─── DELETE event ────────────────────────────────────────────────────────────
export const deleteEvent = async (req, res) => {
    try {
        const existing = await prisma.event.findUnique({ where: { id: req.params.id } });
        if (!existing) return res.status(404).json({ message: 'Event not found.' });
        await prisma.event.delete({ where: { id: req.params.id } });
        res.json({ message: 'Event deleted.' });
    } catch (err) {
        console.error('[EventCms] deleteEvent:', err);
        res.status(500).json({ message: 'Failed to delete event.' });
    }
};
