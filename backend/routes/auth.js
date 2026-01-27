/* eslint-disable no-undef */
const express = require('express');
const router = express.Router();
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const supabase = require("../supabaseDb");
require("dotenv").config();


// Google OAuth Client ID must be set in the .env file
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

if (!GOOGLE_CLIENT_ID) {
    console.error('FATAL ERROR: GOOGLE_CLIENT_ID is not defined in the environment or .env file.');
    process.exit(1);
}

// Google OAuth Login Endpoint
router.post("/google", async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }

        // Verify the Google token
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const googleId = payload.sub;
        const name = payload.name;

        console.log('=== GOOGLE LOGIN ===');
        console.log('Email:', email);
        console.log('Google ID:', googleId);

        // Check if user exists in database
        const { data: existingUser, error: selectError } = await supabase
            .from('operators')
            .select('*')
            .eq('email', email)
            .single();

        let userId;

        if (selectError && selectError.code === 'PGRST116') {
            // User not found - create new user
            const { data: newUser, error: insertError } = await supabase
                .from('operators')
                .insert({
                    email: email,
                    password: 'google_oauth',
                    google_id: googleId,
                    name: name
                })
                .select()
                .single();

            if (insertError) {
                console.error('Error creating user:', insertError);
                throw insertError;
            }

            userId = newUser.operator_id;
            console.log('✓ New user created via Google');
        } else if (selectError) {
            throw selectError;
        } else {
            userId = existingUser.operator_id;

            // Update Google ID if not set
            if (!existingUser.google_id) {
                await supabase
                    .from('operators')
                    .update({ google_id: googleId })
                    .eq('email', email);
            }
            console.log('✓ Existing user logged in via Google');
        }

        // Create JWT token
        const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
        const jwtToken = jwt.sign(
            { id: userId, role: 'technician', email: email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.json({
            token: jwtToken,
            role: 'technician',
            user: { id: userId, email: email, name: name }
        });

    } catch (error) {
        console.error('Google auth error:', error?.message || error);
        return res.status(401).json({
            error: 'Invalid token or authentication failed',
            details: error?.message || null
        });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('=== LOGIN ATTEMPT ===');
        console.log('Email:', email);

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Check admins
        const { data: adminData } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (adminData) {
            const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
            const token = jwt.sign(
                { id: adminData.id, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            console.log('✓ Admin login success');
            return res.json({
                token,
                role: 'admin',
                user: { id: adminData.id, email: adminData.email }
            });
        }

        // Check supervisors
        const { data: supervisorData } = await supabase
            .from('supervisors')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (supervisorData) {
            const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
            const token = jwt.sign(
                { id: supervisorData.id, role: 'supervisor' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            console.log('✓ Supervisor login success');
            return res.json({
                token,
                role: 'supervisor',
                user: { id: supervisorData.id, email: supervisorData.email }
            });
        }

        // Check operators (technicians)
        const { data: operatorData } = await supabase
            .from('operators')
            .select('*')
            .eq('email', email)
            .eq('password', password)
            .single();

        if (operatorData) {
            const JWT_SECRET = process.env.JWT_SECRET || 'your_secret_key';
            const token = jwt.sign(
                { id: operatorData.operator_id, role: 'technician' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            console.log('✓ Technician login success');
            return res.json({
                token,
                role: 'technician',
                user: { id: operatorData.operator_id, email: operatorData.email }
            });
        }

        console.log('✗ No match found for credentials');
        return res.status(401).json({ error: 'Invalid credentials' });

    } catch (error) {
        console.error('Login error:', error?.message);
        return res.status(500).json({ error: 'Server error', details: error?.message });
    }
});

router.post("/signup", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).send('Missing fields');

        const { error } = await supabase
            .from('operators')
            .insert({ email, password });

        if (error) throw error;

        res.send({ message: 'User created successfully' });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).send('Error creating user');
    }
});

module.exports = router;
