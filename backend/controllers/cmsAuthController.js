import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

const JWT_SECRET = process.env.CMS_JWT_SECRET || 'cms-secret-change-in-prod';
const JWT_EXPIRES = '7d';
const VALID_ROLES = ['JOURNALIST', 'EDITOR', 'ADMIN'];

// ─── LOGIN ───────────────────────────────────────────────────────────────────
export const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ message: 'Email and password are required.' });

    try {
        const user = await prisma.cmsUser.findUnique({ where: { email } });
        if (!user) return res.status(401).json({ message: 'Invalid credentials.' });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

        const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
        console.error('[CMS Auth] login error:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ─── GET ME ──────────────────────────────────────────────────────────────────
export const getMe = async (req, res) => {
    try {
        const user = await prisma.cmsUser.findUnique({
            where: { id: req.cmsUser.id },
            select: { id: true, name: true, email: true, bio: true, role: true, createdAt: true }
        });
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json(user);
    } catch (err) {
        console.error('[CMS Auth] getMe error:', err);
        res.status(500).json({ message: 'Failed to fetch user.' });
    }
};

// ─── UPDATE ME ───────────────────────────────────────────────────────────────
export const updateMe = async (req, res) => {
    const { name, email, bio, oldPassword, newPassword } = req.body;
    try {
        const user = await prisma.cmsUser.findUnique({ where: { id: req.cmsUser.id } });
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const updateData = {};
        if (name?.trim()) updateData.name = name.trim();
        if (email?.trim()) updateData.email = email.trim().toLowerCase();
        if (bio !== undefined) updateData.bio = bio?.trim() || null;

        // Check and update password if provided
        if (newPassword) {
            if (!oldPassword) {
                return res.status(400).json({ message: 'Old password is required to set a new password.' });
            }
            const valid = await bcrypt.compare(oldPassword, user.passwordHash);
            if (!valid) return res.status(401).json({ message: 'Invalid old password.' });
            if (newPassword.length < 8) return res.status(400).json({ message: 'New password must be at least 8 characters.' });
            
            updateData.passwordHash = await bcrypt.hash(newPassword, 12);
        }

        const updatedUser = await prisma.cmsUser.update({
            where: { id: req.cmsUser.id },
            data: updateData,
            select: { id: true, name: true, email: true, bio: true, role: true }
        });
        res.json({ message: 'Profile updated successfully.', user: updatedUser });
    } catch (err) {
        console.error('[CMS Auth] updateMe error:', err);
        if (err.code === 'P2002' && err.meta?.target.includes('email')) {
            return res.status(409).json({ message: 'Email already exists.' });
        }
        res.status(500).json({ message: 'Failed to update profile.' });
    }
};


// ─── LIST all CMS users ──────────────────────────────────────────────────────
export const listUsers = async (req, res) => {
    try {
        const users = await prisma.cmsUser.findMany({
            select: { id: true, name: true, email: true, bio: true, role: true, createdAt: true, updatedAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (err) {
        console.error('[CMS Users] listUsers:', err);
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
};

// ─── CREATE new CMS user ─────────────────────────────────────────────────────
export const createUser = async (req, res) => {
    const { name, email, password, role = 'JOURNALIST' } = req.body;

    if (!name?.trim() || !email?.trim() || !password)
        return res.status(400).json({ message: 'name, email, and password are required.' });
    if (!VALID_ROLES.includes(role))
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });

    try {
        const existing = await prisma.cmsUser.findUnique({ where: { email } });
        if (existing) return res.status(409).json({ message: 'A user with this email already exists.' });

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await prisma.cmsUser.create({
            data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash, role },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
        });
        res.status(201).json(user);
    } catch (err) {
        console.error('[CMS Users] createUser:', err);
        res.status(500).json({ message: 'Failed to create user.' });
    }
};

// ─── UPDATE user role ────────────────────────────────────────────────────────
export const updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !VALID_ROLES.includes(role))
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });

    // Only ADMIN can promote/demote to ADMIN
    if (role === 'ADMIN' && req.cmsUser.role !== 'ADMIN')
        return res.status(403).json({ message: 'Only ADMIN can assign the ADMIN role.' });

    try {
        const target = await prisma.cmsUser.findUnique({ where: { id } });
        if (!target) return res.status(404).json({ message: 'User not found.' });
        // Prevent EDITOR from changing an ADMIN's role
        if (target.role === 'ADMIN' && req.cmsUser.role !== 'ADMIN')
            return res.status(403).json({ message: 'Cannot modify an ADMIN account.' });

        const user = await prisma.cmsUser.update({
            where: { id },
            data: { role },
            select: { id: true, name: true, email: true, role: true },
        });
        res.json(user);
    } catch (err) {
        console.error('[CMS Users] updateUserRole:', err);
        res.status(500).json({ message: 'Failed to update role.' });
    }
};

// ─── RESET user password ─────────────────────────────────────────────────────
export const resetUserPassword = async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8)
        return res.status(400).json({ message: 'newPassword must be at least 8 characters.' });

    try {
        const target = await prisma.cmsUser.findUnique({ where: { id } });
        if (!target) return res.status(404).json({ message: 'User not found.' });
        if (target.role === 'ADMIN' && req.cmsUser.role !== 'ADMIN')
            return res.status(403).json({ message: 'Cannot modify an ADMIN account.' });

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await prisma.cmsUser.update({ where: { id }, data: { passwordHash } });
        res.json({ message: 'Password reset successfully.' });
    } catch (err) {
        console.error('[CMS Users] resetUserPassword:', err);
        res.status(500).json({ message: 'Failed to reset password.' });
    }
};

// ─── DELETE CMS user ─────────────────────────────────────────────────────────
export const deleteUser = async (req, res) => {
    const { id } = req.params;
    // Cannot delete yourself
    if (id === req.cmsUser.id)
        return res.status(400).json({ message: 'You cannot delete your own account.' });

    try {
        const target = await prisma.cmsUser.findUnique({ where: { id } });
        if (!target) return res.status(404).json({ message: 'User not found.' });
        if (target.role === 'ADMIN' && req.cmsUser.role !== 'ADMIN')
            return res.status(403).json({ message: 'Cannot delete an ADMIN account.' });

        await prisma.cmsUser.delete({ where: { id } });
        res.json({ message: 'User deleted.' });
    } catch (err) {
        console.error('[CMS Users] deleteUser:', err);
        res.status(500).json({ message: 'Failed to delete user.' });
    }
};
