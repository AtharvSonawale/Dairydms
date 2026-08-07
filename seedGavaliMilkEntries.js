const mysql = require("mysql2/promise");

async function seedMilkEntries() {
    const pool = mysql.createPool({
        host: "localhost",
        user: "root",
        password: "1234",
        database: "dairy_db1",
        waitForConnections: true,
        connectionLimit: 10,
    });

    // Existing IDs
    const sellerId = 11;
    const operatorId = 7;
    const centreId = 5;
    const createdByAdminId = null;

    const sellerType = "Gavali";
    const milkType = "cow";

    // Load all valid cow milk rates
    const [rateRows] = await pool.query(`
        SELECT fat, snf, rate
        FROM cow_milk_rates
        WHERE centre_id = ?
        ORDER BY fat, snf
    `, [centreId]);

    if (rateRows.length === 0) {
        throw new Error("No cow milk rates found.");
    }

    const startDate = new Date("2025-01-01");
    const endDate = new Date("2025-12-31");

    const entries = [];

    for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
    ) {
        const entryDate = date.toISOString().split("T")[0];

        // Pick one existing rate row randomly
        const rateRow =
            rateRows[Math.floor(Math.random() * rateRows.length)];

        const fat = Number(rateRow.fat);
        const snf = Number(rateRow.snf);
        const rateApplied = Number(rateRow.rate);

        // Random quantity only
        const quantity = Number((Math.random() * 20 + 100).toFixed(2));
        // Water
        const water = Number((Math.random() * 2).toFixed(2));

        const isPremium = Math.random() < 0.3 ? 1 : 0;

        const totalAmount = Number(
            (quantity * rateApplied).toFixed(2)
        );

        // Morning or Evening
        const shift = Math.random() < 0.5
            ? "morning"
            : "evening";

        // Time according to shift
        let hour;

        if (shift === "morning") {
            hour = Math.floor(Math.random() * 5) + 5; // 5-9 AM
        } else {
            hour = Math.floor(Math.random() * 5) + 16; // 4-8 PM
        }

        const minute = Math.floor(Math.random() * 60);
        const second = Math.floor(Math.random() * 60);

        const entryTime = `${entryDate} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;

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
            entryTime,
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
            `Inserted ${Math.min(i + batchSize, entries.length)}/${entries.length}`
        );
    }

    console.log(`Successfully inserted ${entries.length} entries.`);

    await pool.end();
}

seedMilkEntries().catch(console.error);