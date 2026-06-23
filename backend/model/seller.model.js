// models/sellerModel.js
const db = require('../config/db');

const Seller = {

    getAll: (operatorId, callback) => {
        const sql = `
            SELECT * FROM sellers
            WHERE operator_id = ?
            ORDER BY created_at DESC
        `;
        db.query(sql, [operatorId], callback);
    },

    getById: (id, operatorId, callback) => {
        const sql = `
            SELECT * FROM sellers
            WHERE seller_id = ? AND operator_id = ?
        `;
        db.query(sql, [id, operatorId], callback);
    },

    create: (data, callback) => {
        const sql = `
            INSERT INTO sellers
                (operator_id, seller_code, name, mobile, aadhaar,
                 seller_type, milk_type, jamin, bank_account, bank_name, ifsc_code, address, advance_enabled, advance_deduction)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        //       ^  ^  ^  ^  ^   ^            ^  ^  ^   ^        ^         ^
        //       12 columns → 12 placeholders (was 11 before — root cause of the error)
        const values = [
            data.operator_id,
            data.seller_code,
            data.name,
            data.mobile,
            data.aadhaar || null,
            data.seller_type || 'Utpadak',   // was missing entirely — caused "Unknown column 'milk_type'"
            data.milk_type || 'mixed',
            data.jamin || null,
            data.bank_account || null,
            data.bank_name || null,
            data.ifsc_code || null,
            data.address || null,
            data.advance_enabled ?? 1,
            data.advance_deduction || null,
        ];
        db.query(sql, values, callback);
    },

    update: (id, operatorId, data, callback) => {
        const sql = `
            UPDATE sellers SET
                seller_code  = ?,
                name         = ?,
                mobile       = ?,
                aadhaar      = ?,
                seller_type  = ?,
                milk_type    = ?,
                jamin        = ?,
                bank_account = ?,
                bank_name    = ?,
                ifsc_code    = ?,
                address      = ?,
                advance_enabled = ?,
                advance_deduction = ?
            WHERE seller_id = ? AND operator_id = ?
        `;
        const values = [
            data.seller_code,
            data.name,
            data.mobile,
            data.aadhaar || null,
            data.seller_type || 'Utpadak',
            data.milk_type || 'mixed',
            data.jamin || null,
            data.bank_account || null,
            data.bank_name || null,
            data.ifsc_code || null,
            data.address || null,
            data.advance_enabled ?? 1,
            data.advance_deduction || null,
            id,
            operatorId,
        ];
        db.query(sql, values, callback);
    },

    delete: (id, operatorId, callback) => {
        const sql = `
            DELETE FROM sellers
            WHERE seller_id = ? AND operator_id = ?
        `;
        db.query(sql, [id, operatorId], callback);
    },

    isCodeTaken: (code, operatorId, excludeId = null, callback) => {
        let sql = `
            SELECT seller_id FROM sellers
            WHERE seller_code = ? AND operator_id = ?
        `;
        const values = [code, operatorId];
        if (excludeId) {
            sql += ` AND seller_id != ?`;
            values.push(excludeId);
        }
        db.query(sql, values, callback);
    },

};

module.exports = Seller;