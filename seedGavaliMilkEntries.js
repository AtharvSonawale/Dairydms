const mysql = require('mysql2/promise');

async function seedMilkEntries() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: '1234',
        database: 'dairy_db1',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    // Existing IDs in your database
    const sellerId = 11;
    const operatorId = 7;
    const centreId = 5;
    const createdByAdminId = null; // Or use a valid admin_id like 1

    const sellerType = 'Gavali';
    const milkType = 'cow';

    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-12-31');

    const entries = [];

    for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
    ) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const entryDate = `${year}-${month}-${day}`;

        // Random time
        const hour = String(Math.floor(Math.random() * 24)).padStart(2, '0');
        const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        const second = String(Math.floor(Math.random() * 60)).padStart(2, '0');

        const entryTime = `${entryDate} ${hour}:${minute}:${second}`;

        const shift = Math.random() > 0.5 ? 'morning' : 'evening';

        const quantity = Number((Math.random() * 4 + 1).toFixed(2));      // 1-5 L
        const fat = Number((Math.random() * 3 + 3).toFixed(2));           // 3-6
        const snf = Number((Math.random() * 1.5 + 8).toFixed(2));         // 8-9.5
        const water = Number((Math.random() * 2).toFixed(2));             // 0-2%
        const rateApplied = Number((Math.random() * 10 + 50).toFixed(2)); // 50-60
        const isPremium = Math.random() < 0.3 ? 1 : 0;

        const totalAmount = Number((quantity * rateApplied).toFixed(2));

        entries.push([
            sellerId,
            operatorId,
            centreId,
            createdByAdminId,
            sellerType,
            entryDate,
            shift,
            milkType,
            quantity,
            fat,
            snf,
            water,
            rateApplied,
            isPremium,
            totalAmount,
            entryTime
        ]);
    }

    const batchSize = 100;

    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        await pool.query(
            `INSERT INTO milk_entries (
                seller_id,
                operator_id,
                centre_id,
                created_by_admin_id,
                seller_type,
                entry_date,
                shift,
                milk_type,
                quantity,
                fat,
                snf,
                water,
                rate_applied,
                is_premium,
                total_amount,
                entry_time
            ) VALUES ?`,
            [batch]
        );

        console.log(
            `✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${Math.min(
                i + batchSize,
                entries.length
            )}/${entries.length})`
        );
    }

    console.log(`✅ Successfully inserted ${entries.length} milk entries.`);

    await pool.end();
}

seedMilkEntries().catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
});