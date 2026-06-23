const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

module.exports = async function sendMail({ to, subject, html }) {
    await transporter.sendMail({
        from: `"Dairy Management" <${process.env.EMAIL_USER}>`,
        to, subject, html,
    });
};