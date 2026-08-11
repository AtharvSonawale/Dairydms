const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'uploads', 'logos');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const unique = `${req.user.dairy_id}_${Date.now()}${ext}`;
        cb(null, unique);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB, matches Flutter-side check
    fileFilter: (req, file, cb) => {
        if (!/^image\/(png|jpe?g)$/.test(file.mimetype)) {
            return cb(new Error('Only PNG/JPG images are allowed'));
        }
        cb(null, true);
    },
});

module.exports = upload;