import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const JWT_SECRET = process.env.CMS_JWT_SECRET || 'cms-secret-change-in-prod';
const JWT_EXPIRES = '7d';

export const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
        return res.status(400).json({ message: 'Email and password are required.' });

    try {
        const user = await prisma.cmsUser.findUnique({ where: { email } });
        if (!user)
            return res.status(401).json({ message: 'Invalid credentials.' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            return res.status(401).json({ message: 'Invalid credentials.' });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role }
        });
    } catch (err) {
        console.error('[CMS Auth] login error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
