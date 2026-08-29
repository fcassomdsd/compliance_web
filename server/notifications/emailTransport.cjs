const nodemailer = require('nodemailer');

function createEmailTransport({
  host = process.env.SMTP_HOST,
  port = Number(process.env.SMTP_PORT || 587),
  secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  user = process.env.SMTP_USER,
  pass = process.env.SMTP_PASS,
  from = process.env.SMTP_FROM || 'noreply@compliance.local',
} = {}) {
  if (!host) {
    throw new Error('SMTP_HOST is not configured');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
  });

  return {
    from,
    async send({ to, subject, text }) {
      await transporter.sendMail({ from, to, subject, text });
    },
  };
}

module.exports = {
  createEmailTransport,
};
