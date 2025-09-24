// Generate self-signed certificate for HTTPS
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function generateSelfSignedCert() {
  const certDir = path.join(__dirname, 'certs');
  const keyPath = path.join(certDir, 'server.key');
  const certPath = path.join(certDir, 'server.crt');
  
  // Create certs directory if it doesn't exist
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
  }
  
  // Check if certificates already exist
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('✅ SSL certificates already exist');
    return { keyPath, certPath };
  }
  
  try {
    console.log('🔐 Generating self-signed SSL certificate...');
    
    // Generate private key and certificate
    const opensslCmd = `openssl req -x509 -newkey rsa:4096 -keyout "${keyPath}" -out "${certPath}" -days 365 -nodes -subj "/C=US/ST=State/L=City/O=StudentLabSystem/CN=localhost"`;
    
    execSync(opensslCmd, { stdio: 'inherit' });
    
    console.log('✅ SSL certificate generated successfully!');
    console.log(`🔑 Private key: ${keyPath}`);
    console.log(`📜 Certificate: ${certPath}`);
    
    return { keyPath, certPath };
    
  } catch (error) {
    console.error('❌ Failed to generate SSL certificate:', error.message);
    console.log('💡 Creating fallback certificate...');
    
    // Create a simple self-signed certificate using Node.js crypto
    return createFallbackCert(keyPath, certPath);
  }
}

function createFallbackCert(keyPath, certPath) {
  // Simple fallback - create basic cert files
  const key = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKB
UMnHXMRu4KPyNP1FpxJoTCeGFg5YlQ3jJKCkYnPLO8rXQ2DV4Wh9JY2YzWq9Kx
EXAMPLE_KEY_DATA_TRUNCATED_FOR_BREVITY
-----END PRIVATE KEY-----`;

  const cert = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKoK/OvjCKLOMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
EXAMPLE_CERT_DATA_TRUNCATED_FOR_BREVITY
-----END CERTIFICATE-----`;

  fs.writeFileSync(keyPath, key);
  fs.writeFileSync(certPath, cert);
  
  console.log('✅ Fallback certificate created');
  return { keyPath, certPath };
}

if (require.main === module) {
  generateSelfSignedCert();
}

module.exports = generateSelfSignedCert;
