import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.CMS_JWT_SECRET || 'cms-secret-change-in-prod';

/**
 * Verifies the CMS JWT and attaches req.cmsUser = { id, role }
 */
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer '))
        return res.status(401).json({ message: 'No token provided.' });

    const token = authHeader.split(' ')[1];
    try {
        req.cmsUser = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};

/**
 * Role-guard middleware — use after authenticate.
 * Usage: requireRole('EDITOR', 'ADMIN')
 */
export const requireRole = (...roles) => (req, res, next) => {
    if (!req.cmsUser || !roles.includes(req.cmsUser.role))
        return res.status(403).json({ message: 'Access denied.' });
    next();
};
