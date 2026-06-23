const mysql = require('mysql2/promise');

async function seedMilkEntries() {
    // Create a connection pool
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'root', // Replace with your MySQL username
        password: '1234', // Replace with your MySQL password
        database: 'dairy_db', // Replace with your database name
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    const sellerId = 11;
    const operatorId = 1;
    const sellerType = 'Gavali';
    const milkType = 'cow';

    const startDate = new Date('2026-01-01T12:00:00');
    const endDate = new Date('2026-12-31T12:00:00');

    const entries = [];

    // Generate 365 days of entries
    for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        // Use local date to avoid timezone shifting to previous day
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const entryDate = `${year}-${month}-${day}`;
        const hours = String(Math.floor(Math.random() * 24)).padStart(2, '0');
        const minutes = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        const seconds = String(Math.floor(Math.random() * 60)).padStart(2, '0');
        const entryTime = `${entryDate} ${hours}:${minutes}:${seconds}`; // Full datetime: YYYY-MM-DD HH:MM:SS
        const shift = Math.random() > 0.5 ? 'morning' : 'evening';
        const quantity = (Math.random() * 4 + 1).toFixed(2); // Random between 1.00 and 5.00
        const fat = (Math.random() * 3 + 3).toFixed(2); // Random between 3.00 and 6.00
        const snf = (Math.random() * 1.5 + 8).toFixed(2); // Random between 8.00 and 9.50
        const water = (Math.random() * 2).toFixed(2); // Random between 0.00 and 2.00
        const rateApplied = (Math.random() * 10 + 50).toFixed(2); // Random between 50.00 and 60.00
        const isPremium = Math.random() > 0.7 ? 1 : 0; // 30% chance of being premium
        const totalAmount = (quantity * rateApplied).toFixed(2);

        entries.push([
            sellerId,
            operatorId,
            sellerType,
            entryDate,
            shift,
            milkType,
            parseFloat(quantity),
            parseFloat(fat),
            parseFloat(snf),
            parseFloat(water),
            parseFloat(rateApplied),
            isPremium,
            parseFloat(totalAmount),
            entryTime // Full datetime: YYYY-MM-DD HH:MM:SS
        ]);
    }

    // Batch insert to avoid timeouts
    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        await pool.query(
            `INSERT INTO milk_entries
       (seller_id, operator_id, seller_type, entry_date, shift, milk_type, quantity, fat, snf, water, rate_applied, is_premium, total_amount, entry_time)
       VALUES ?`,
            [batch]
        );
        console.log(`✅ Inserted batch ${i / batchSize + 1} (${Math.min(i + batchSize, entries.length)} / ${entries.length})`);
    }

    console.log('✅ Successfully inserted 365 days of milk entries for Gavali seller!');
    pool.end();
    process.exit();
}

seedMilkEntries().catch(err => {
    console.error('❌ Error seeding milk entries:', err);
    process.exit(1);
});