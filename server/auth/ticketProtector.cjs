const crypto = require('crypto');

function buildKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function createTicketProtector({ secret }) {
  const key = buildKey(secret);

  function encrypt(plainText) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  function decrypt(payload) {
    const [ivB64, tagB64, dataB64] = String(payload || '').split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  return {
    encrypt,
    decrypt,
  };
}

module.exports = {
  createTicketProtector,
};
