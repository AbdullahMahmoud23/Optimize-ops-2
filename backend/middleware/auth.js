/* eslint-disable no-undef */
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware للتحقق من JWT
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        console.warn('⚠️  No token provided');
        return res.status(403).json({ error: 'No token provided' });
    }
    
    // Extract token (handle both "Bearer <token>" and direct token formats)
    const token = authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : authHeader;
    
    if (!token) {
        console.warn('⚠️  No token provided');
        return res.status(403).json({ error: 'No token provided' });
    }
    
    const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            console.warn('⚠️  Invalid token:', err.message);
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (!decoded.id) {
            console.warn('⚠️  Token missing id field');
            return res.status(401).json({ error: 'Token missing id field' });
        }
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    });
};

module.exports = verifyToken;