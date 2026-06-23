// controllers/auth.controller.js
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sendMail = require('../utils/mailer');

const signToken = (payload) =>
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// ============================================
// ADMIN AUTHENTICATION
// ============================================

// POST /api/auth/admin/login
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: 'Email and password required' });

        const [rows] = await pool.query(
            `SELECT a.*, c.dairy_id, d.dairy_name, c.centre_name
             FROM admins a
             JOIN centres c ON c.centre_id = a.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE a.email = ?`,
            [email]
        );
        const admin = rows[0];

        if (!admin)
            return res.status(401).json({ message: 'Invalid credentials' });

        const match = await bcrypt.compare(password, admin.password_hash);
        if (!match)
            return res.status(401).json({ message: 'Invalid credentials' });

        const token = signToken({
            id: admin.admin_id,
            role: 'admin',
            name: admin.name,
            centre_id: admin.centre_id,
            dairy_id: admin.dairy_id,
        });
        res.json({
            token,
            role: 'admin',
            name: admin.name,
            centre_id: admin.centre_id,
            dairy_id: admin.dairy_id,
            dairy_name: admin.dairy_name,
            centre_name: admin.centre_name,
        });

    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// POST /api/auth/admin/signup
// Creates admin for existing OR new dairy and centre
exports.adminSignup = async (req, res) => {
    const {
        name,
        email,
        password,
        mobile,
        dairy_id,
        centre_id,
        // New dairy creation fields
        createNewDairy,
        dairy_name,
        dairy_code,
        dairy_address,
        dairy_contact,
        centre_name,
        centre_code,
        centre_address,
        centre_contact
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
        return res.status(400).json({
            message: 'Name, email and password are required'
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message: 'Password must be at least 6 characters'
        });
    }

    if (mobile && !/^\+?[0-9]{10,15}$/.test(mobile)) {
        return res.status(400).json({
            message: 'Invalid mobile number format'
        });
    }

    const conn = await pool.getConnection();
    try {
        // Check if email already registered
        const [existing] = await conn.query(
            'SELECT admin_id FROM admins WHERE email = ?',
            [email]
        );
        if (existing.length > 0) {
            conn.release();
            return res.status(409).json({
                message: 'Email already registered'
            });
        }

        let finalDairyId = dairy_id;
        let finalCentreId = centre_id;
        let dairyName = '';
        let centreName = '';

        // ============================================
        // CASE 1: Create New Dairy and Centre
        // ============================================
        if (createNewDairy) {
            // Validate new dairy fields
            if (!dairy_name || !dairy_code || !centre_name || !centre_code) {
                conn.release();
                return res.status(400).json({
                    message: 'Dairy name, dairy code, centre name, and centre code are required for new dairy creation'
                });
            }

            // Check if dairy code already exists
            const [existingDairy] = await conn.query(
                'SELECT dairy_id FROM dairies WHERE dairy_code = ?',
                [dairy_code]
            );
            if (existingDairy.length > 0) {
                conn.release();
                return res.status(409).json({
                    message: 'Dairy code already exists'
                });
            }

            // Check if centre code already exists
            const [existingCentre] = await conn.query(
                'SELECT centre_id FROM centres WHERE centre_code = ?',
                [centre_code]
            );
            if (existingCentre.length > 0) {
                conn.release();
                return res.status(409).json({
                    message: 'Centre code already exists'
                });
            }

            await conn.beginTransaction();

            // Create new dairy
            if (dairy_contact && !/^\+?[0-9]{10,15}$/.test(dairy_contact)) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    message: 'Invalid dairy contact number format'
                });
            }

            // Create new dairy
            const [dairyResult] = await conn.query(
                `INSERT INTO dairies 
(dairy_name, dairy_code, address, contact_number, is_active) 
VALUES (?, ?, ?, ?, 1)`,
                [dairy_name, dairy_code, dairy_address || null, dairy_contact || null]
            );
            finalDairyId = dairyResult.insertId;
            dairyName = dairy_name;

            // Create new centre
            if (centre_contact && !/^\+?[0-9]{10,15}$/.test(centre_contact)) {
                await conn.rollback();
                conn.release();
                return res.status(400).json({
                    message: 'Invalid centre contact number format'
                });
            }

            // Create new centre
            const [centreResult] = await conn.query(
                `INSERT INTO centres 
(dairy_id, centre_name, centre_code, address, contact_number, is_active) 
VALUES (?, ?, ?, ?, ?, 1)`,
                [finalDairyId, centre_name, centre_code, centre_address || null, centre_contact || null]
            );
            finalCentreId = centreResult.insertId;
            centreName = centre_name;

            await conn.commit();
        }
        // ============================================
        // CASE 2: Use Existing Dairy and Centre
        // ============================================
        else {
            if (!dairy_id || !centre_id) {
                conn.release();
                return res.status(400).json({
                    message: 'Dairy and centre selection required'
                });
            }

            // Verify centre exists and belongs to the dairy
            const [centre] = await conn.query(
                `SELECT c.*, d.dairy_name 
                 FROM centres c 
                 JOIN dairies d ON d.dairy_id = c.dairy_id 
                 WHERE c.centre_id = ? AND c.dairy_id = ? AND c.is_active = 1`,
                [centre_id, dairy_id]
            );

            if (centre.length === 0) {
                conn.release();
                return res.status(400).json({
                    message: 'Invalid dairy or centre selected'
                });
            }

            dairyName = centre[0].dairy_name;
            centreName = centre[0].centre_name;
        }

        // ============================================
        // Create Admin
        // ============================================
        await conn.beginTransaction();
        const hash = await bcrypt.hash(password, 10);
        const [adminResult] = await conn.query(
            `INSERT INTO admins 
            (centre_id, name, email, password_hash, mobile, is_active) 
            VALUES (?, ?, ?, ?, ?, 1)`,
            [finalCentreId, name, email, hash, mobile || null]
        );
        const adminId = adminResult.insertId;
        await conn.commit();

        // Generate JWT token
        const token = signToken({
            id: adminId,
            role: 'admin',
            name,
            centre_id: finalCentreId,
            dairy_id: finalDairyId,
        });

        // Send success response
        res.status(201).json({
            token,
            role: 'admin',
            name,
            centre_id: finalCentreId,
            dairy_id: finalDairyId,
            dairy_name: dairyName,
            centre_name: centreName,
            message: 'Admin created successfully'
        });

    } catch (err) {
        try { await conn.rollback(); } catch (_) { /* ignore rollback errors */ }
        console.error('Admin signup error:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    } finally {
        conn.release();
    }
};

// ============================================
// OPERATOR AUTHENTICATION
// ============================================

// POST /api/auth/operator/login
exports.operatorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            return res.status(400).json({ message: 'Email and password required' });

        const [rows] = await pool.query(
            `SELECT o.operator_id, o.name, o.email, o.password_hash, o.is_active,
                    o.centre_id, c.dairy_id, d.dairy_name, c.centre_name
             FROM operators o
             JOIN centres c ON c.centre_id = o.centre_id
             JOIN dairies d ON d.dairy_id = c.dairy_id
             WHERE o.email = ?`,
            [email]
        );
        const operator = rows[0];

        if (!operator)
            return res.status(401).json({ message: 'Invalid email or password' });

        if (!operator.is_active)
            return res.status(403).json({ message: 'Account deactivated. Contact admin.' });

        const match = await bcrypt.compare(password, operator.password_hash);
        if (!match)
            return res.status(401).json({ message: 'Invalid email or password' });

        const token = signToken({
            id: operator.operator_id,
            role: 'operator',
            name: operator.name,
            centre_id: operator.centre_id,
            dairy_id: operator.dairy_id,
        });
        res.json({
            token,
            role: 'operator',
            name: operator.name,
            centre_id: operator.centre_id,
            dairy_id: operator.dairy_id,
            dairy_name: operator.dairy_name,
            centre_name: operator.centre_name,
        });

    } catch (err) {
        console.error('Operator login error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// ============================================
// PUBLIC ENDPOINTS FOR DAIRIES & CENTRES
// ============================================

// GET /api/auth/dairies/active
exports.getActiveDairies = async (req, res) => {
    try {
        const [dairies] = await pool.query(
            `SELECT dairy_id, dairy_name, dairy_code, address, contact_number 
 FROM dairies 
 WHERE is_active = 1 
 ORDER BY dairy_name`,
        );
        res.json(dairies);
    } catch (err) {
        console.error('Error fetching dairies:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// GET /api/auth/centres/active
exports.getActiveCentresByDairy = async (req, res) => {
    try {
        const { dairyId } = req.query;
        if (!dairyId) {
            return res.status(400).json({
                message: 'Dairy ID is required'
            });
        }

        const [centres] = await pool.query(
            `SELECT centre_id, centre_name, centre_code, address, contact_number 
 FROM centres 
 WHERE dairy_id = ? AND is_active = 1 
 ORDER BY centre_name`,
            [dairyId]
        );
        res.json(centres);
    } catch (err) {
        console.error('Error fetching centres:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// ============================================
// PASSWORD RESET FLOW
// ============================================

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                message: 'Email is required'
            });
        }

        // Check both tables
        const [admins] = await pool.query(
            'SELECT admin_id, name FROM admins WHERE email = ?',
            [email]
        );
        const [operators] = await pool.query(
            'SELECT operator_id, name FROM operators WHERE email = ?',
            [email]
        );

        const found = admins.length > 0 || operators.length > 0;
        const userName = admins[0]?.name || operators[0]?.name || 'User';

        // Always respond OK to prevent email enumeration
        if (!found) {
            return res.json({
                message: 'If this email exists, an OTP has been sent.'
            });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        // Invalidate old OTPs
        await pool.query(
            'UPDATE password_reset_otps SET used = 1 WHERE email = ?',
            [email]
        );

        await pool.query(
            `INSERT INTO password_reset_otps (email, otp, expires_at) 
             VALUES (?, ?, ?)`,
            [email, otp, expiresAt]
        );

        // Send OTP via email
        await sendMail({
            to: email,
            subject: 'Your Password Reset OTP — Dairy Management',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f4f0;border-radius:12px">
                    <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e5e7eb">
                        <h2 style="color:#111;margin:0 0 4px">Password Reset OTP</h2>
                        <p style="color:#555;font-size:14px;margin:0 0 6px">Hi <strong>${userName}</strong>,</p>
                        <p style="color:#555;font-size:14px;margin:0 0 24px">Use the code below to reset your password. It expires in <strong>10 minutes</strong>.</p>
                        <div style="background:#f5f4f0;border-radius:8px;padding:20px;text-align:center;letter-spacing:0.4em;font-size:32px;font-weight:800;color:#111;border:1px solid #e5e7eb">
                            ${otp}
                        </div>
                        <p style="color:#999;font-size:12px;margin:20px 0 0;text-align:center">
                            If you didn't request this, ignore this email. Your password won't change.
                        </p>
                    </div>
                </div>
            `,
        });

        res.json({
            message: 'If this email exists, an OTP has been sent.'
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// POST /api/auth/verify-otp
exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({
                message: 'Email and OTP required'
            });
        }

        const [rows] = await pool.query(
            `SELECT * FROM password_reset_otps 
             WHERE email = ? AND otp = ? AND used = 0 AND expires_at > NOW() 
             ORDER BY id DESC LIMIT 1`,
            [email, otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: 'Invalid or expired OTP. Please try again.'
            });
        }

        // Verify account actually exists in either table
        const [admins] = await pool.query(
            'SELECT admin_id FROM admins WHERE email = ?',
            [email]
        );
        const [operators] = await pool.query(
            'SELECT operator_id FROM operators WHERE email = ?',
            [email]
        );

        if (admins.length === 0 && operators.length === 0) {
            return res.status(404).json({
                message: 'No account found with this email.'
            });
        }

        const role = admins.length > 0 ? 'admin' : 'operator';
        res.json({
            message: 'OTP verified',
            role
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res.status(400).json({
                message: 'Email, OTP and password are required'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: 'Password must be at least 6 characters'
            });
        }

        // Re-verify OTP at reset time too (prevents skipping verify step)
        const [rows] = await pool.query(
            `SELECT * FROM password_reset_otps 
             WHERE email = ? AND otp = ? AND used = 0 AND expires_at > NOW() 
             ORDER BY id DESC LIMIT 1`,
            [email, otp]
        );

        if (rows.length === 0) {
            return res.status(400).json({
                message: 'Invalid or expired OTP. Please restart the process.'
            });
        }

        const hash = await bcrypt.hash(password, 10);
        let updated = false;

        // Update admin if exists
        const [adminUpdate] = await pool.query(
            'UPDATE admins SET password_hash = ? WHERE email = ?',
            [hash, email]
        );
        if (adminUpdate.affectedRows > 0) updated = true;

        // Update operator if exists
        const [operatorUpdate] = await pool.query(
            'UPDATE operators SET password_hash = ? WHERE email = ?',
            [hash, email]
        );
        if (operatorUpdate.affectedRows > 0) updated = true;

        if (!updated) {
            return res.status(404).json({
                message: 'No account found with this email.'
            });
        }

        // Mark OTP as used so it can't be reused
        await pool.query(
            'UPDATE password_reset_otps SET used = 1 WHERE email = ?',
            [email]
        );

        // Send confirmation email
        await sendMail({
            to: email,
            subject: 'Password Changed Successfully — Dairy Management',
            html: `
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f5f4f0;border-radius:12px">
                    <div style="background:#fff;border-radius:10px;padding:28px;border:1px solid #e5e7eb">
                        <h2 style="color:#111;margin:0 0 8px">Password Changed</h2>
                        <p style="color:#555;font-size:14px;margin:0 0 16px">
                            Your Dairy Management account password was successfully reset.
                        </p>
                        <p style="color:#555;font-size:14px;margin:0 0 4px">
                            If you did not make this change, contact your administrator immediately.
                        </p>
                        <p style="color:#999;font-size:12px;margin:20px 0 0;text-align:center">
                            ${new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                    </div>
                </div>
            `,
        });

        res.json({
            message: 'Password reset successfully.'
        });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({
            message: 'Server error',
            error: err.message
        });
    }
};