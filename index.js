// Import required modules
const express = require('express'); // Web application framework
const http = require('http'); // HTTP server module
const socketIO = require('socket.io'); // Real-time communication library
const TwoFactorAuth = require('./TwoFactorAuth'); // Our 2FA helper class
const path = require('path'); // Handles file paths

// Create Express app and HTTP server
const app = express(); // Initialize Express application
const server = http.createServer(app); // Create HTTP server using Express app
const io = socketIO(server); // Initialize Socket.IO with our server
const tfa = new TwoFactorAuth(); // Create instance of our 2FA helper

// Storage (using Maps instead of a database for simplicity)
const users = new Map(); // Stores user data: username -> {secret, verified}
const sessions = new Map(); // Stores active sessions: sessionId -> username

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// When a client connects via Socket.IO
io.on('connection', (socket) => {
    console.log('Client connected');

    // Handle registration request
    socket.on('register', async (username) => {
        try {
            // Generate new 2FA secret for user
            const secret = await tfa.generateSecret(username);
            // Store user data
            users.set(username, { 
                secret: secret.base32, // Store secret in base32 format
                verified: false // User hasn't verified 2FA yet
            });
            
            // Send success response with QR code
            socket.emit('registration-success', {
                username,
                qrCode: secret.qrCode
            });
        } catch (error) {
            console.error('Registration error:', error);
            socket.emit('error', 'Registration failed');
        }
    });

    // Handle initial login attempt
    socket.on('login-init', (username) => {
        const user = users.get(username);
        if (!user) {
            socket.emit('error', 'User not found. Please register first.');
            return;
        }
        
        // If 2FA not set up yet, generate new QR code
        if (!user.verified) {
            tfa.generateSecret(username).then(secret => {
                users.set(username, { 
                    secret: secret.base32,
                    verified: false 
                });
                socket.emit('needs-2fa-setup', {
                    username,
                    qrCode: secret.qrCode
                });
            });
        } else {
            // If 2FA is set up, request verification
            socket.emit('needs-2fa-verification', { username });
        }
    });

    // Handle 2FA code verification
    socket.on('verify-2fa', ({ username, token, isSetup }) => {
        const user = users.get(username);
        if (!user) {
            socket.emit('error', 'User not found');
            return;
        }

        try {
            // Verify the token against stored secret
            const isValid = tfa.verifyToken(token, user.secret);
            
            if (isValid) {
                // Generate session ID
                const sessionId = Math.random().toString(36).substring(2);
                sessions.set(sessionId, username);
                
                // If this is initial setup, mark user as verified
                if (isSetup) {
                    user.verified = true;
                    users.set(username, user);
                }
                
                socket.emit('auth-success', { sessionId });
                console.log(`User ${username} successfully authenticated`);
            } else {
                socket.emit('auth-failure', 'Invalid verification code');
                console.log(`Failed 2FA attempt for user ${username}`);
            }
        } catch (error) {
            console.error('Verification error:', error);
            socket.emit('error', 'Verification failed');
        }
    });

    // Handle client disconnection
    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Start server on specified port
const PORT = process.env.PORT || 9000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});