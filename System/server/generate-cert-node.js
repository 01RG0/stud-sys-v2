// Generate self-signed SSL certificate using Node.js crypto module
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('   SSL Certificate Generator (Node.js)');
console.log('========================================');
console.log('');

// Create certs directory if it doesn't exist
const certDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
    console.log('📁 Created certs directory');
}

const keyPath = path.join(certDir, 'server.key');
const certPath = path.join(certDir, 'server.crt');

// Check if certificates already exist
if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ SSL certificates already exist');
    console.log('   📁 certs/server.key');
    console.log('   📁 certs/server.crt');
    console.log('');
    console.log('🔒 HTTPS is already enabled');
    process.exit(0);
}

console.log('🔐 Generating self-signed SSL certificate...');
console.log('');

try {
    // Generate a private key
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    // Create a self-signed certificate
    const cert = crypto.createCertificate({
        serialNumber: '01',
        subject: {
            C: 'US',
            ST: 'State',
            L: 'City',
            O: 'StudentLabSystem',
            CN: 'localhost'
        },
        issuer: {
            C: 'US',
            ST: 'State',
            L: 'City',
            O: 'StudentLabSystem',
            CN: 'localhost'
        },
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        publicKey: publicKey,
        extensions: [
            {
                name: 'basicConstraints',
                cA: false
            },
            {
                name: 'keyUsage',
                keyCertSign: false,
                digitalSignature: true,
                nonRepudiation: false,
                keyEncipherment: true,
                dataEncipherment: false
            },
            {
                name: 'subjectAltName',
                altNames: [
                    {
                        type: 2, // DNS
                        value: 'localhost'
                    },
                    {
                        type: 7, // IP
                        ip: '127.0.0.1'
                    }
                ]
            }
        ]
    });

    // Write the private key
    fs.writeFileSync(keyPath, privateKey);
    console.log('✅ Private key generated: certs/server.key');

    // Write the certificate
    fs.writeFileSync(certPath, cert.toString());
    console.log('✅ Certificate generated: certs/server.crt');

    console.log('');
    console.log('🎉 SSL certificate generated successfully!');
    console.log('');
    console.log('Files created:');
    console.log('  📁 certs/server.key  (Private Key)');
    console.log('  📁 certs/server.crt  (Certificate)');
    console.log('');
    console.log('🔒 HTTPS will now be enabled when you restart the server');
    console.log('');
    console.log('⚠️  Note: This is a self-signed certificate');
    console.log('   - Browsers will show a security warning');
    console.log('   - Click "Advanced" and "Proceed to localhost" to continue');
    console.log('   - This is normal for development/testing');
    console.log('');

} catch (error) {
    console.error('❌ Failed to generate certificate:', error.message);
    console.log('');
    console.log('💡 Alternative: Use OpenSSL if available:');
    console.log('   Run: generate-ssl-cert.bat');
    console.log('');
    process.exit(1);
}
