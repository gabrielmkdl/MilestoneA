// Import required libraries
const speakeasy = require('speakeasy'); // Handles 2FA token generation/verification
const qrcode = require('qrcode'); // Generates QR codes

class TwoFactorAuth {
    // Generate new secret key and QR code
    async generateSecret(username) {
        // Create new secret using speakeasy
        const secret = speakeasy.generateSecret({
            name: `MyApp:${username}`, // App name in authenticator
            length: 20 // Length of secret
        });

        // Convert secret's otpauth URL to QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        // Return all formats of the secret
        return {
            ascii: secret.ascii,   // ASCII format
            hex: secret.hex,       // Hexadecimal format
            base32: secret.base32, // Base32 format (most common)
            qrCode: qrCodeUrl,     // QR code as data URL
            otpauthUrl: secret.otpauth_url // URL for authenticator apps
        };
    }

    // Verify a token against a secret
    verifyToken(token, secret) {
        return speakeasy.totp.verify({
            secret: secret,     // Stored secret
            encoding: 'base32', // Secret encoding
            token: token,       // User-provided token
            window: 1          // Allow 30 seconds before/after
        });
    }

    // Generate a token (for testing)
    generateToken(secret) {
        return speakeasy.totp({
            secret: secret,
            encoding: 'base32'
        });
    }
}

// Export the class for use in other files
module.exports = TwoFactorAuth;