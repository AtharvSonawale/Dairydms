const XLSX = require('xlsx');
const mysql = require('mysql2/promise');

// Configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
const dbConfig = {
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'dairy_db1'
};

async function generateValidImportFile() {
    // First, fetch existing seller codes and mobiles from database
    let existingCodes = [];
    let existingMobiles = [];

    try {
        const connection = await mysql.createConnection(dbConfig);

        // Get existing seller codes and mobiles for the centre
        // Replace '1' with your actual centre_id
        const [rows] = await connection.execute(
            `SELECT seller_code, mobile FROM sellers WHERE centre_id = 1`
        );

        existingCodes = rows.map(r => String(r.seller_code).trim());
        existingMobiles = rows.map(r => String(r.mobile).trim());

        await connection.end();
        console.log(`📊 Found ${existingCodes.length} existing sellers`);
    } catch (err) {
        console.warn('⚠️ Could not connect to database. Using fallback values.');
        existingCodes = [];
        existingMobiles = [];
    }

    // Column headers matching your columnMap
    const headers = [
        'Seller Code', 'Name', 'Mobile', 'Aadhaar', 'PAN Number',
        'Seller ID Code', 'Seller Type', 'Milk Type', 'Jamin',
        'Bank Account', 'Bank Name', 'Account Holder Name',
        'Branch Name', 'IFSC Code', 'Address', 'Pincode',
        'Advance Enabled', 'Advance Deduction',
        'Product Sale Enabled', 'Deposit Enabled',
        'Deposit Per Litre', 'Cattle Feed Enabled', 'Password'
    ];

    // Generate farmers with unique codes and mobiles
    const farmers = [];

    // Find starting code (avoid conflicts)
    let startCode = 1;
    if (existingCodes.length > 0) {
        const numericCodes = existingCodes
            .filter(c => /^\d+$/.test(c))
            .map(c => parseInt(c, 10))
            .filter(n => !isNaN(n));
        if (numericCodes.length > 0) {
            startCode = Math.max(...numericCodes) + 1;
        } else {
            startCode = 1;
        }
    }

    // Helper to generate unique seller code
    const generateUniqueCode = (index) => {
        let code = String(startCode + index).padStart(3, '0');
        // Ensure it doesn't conflict with existing codes
        while (existingCodes.includes(code) || farmers.some(f => f[0] === code)) {
            startCode++;
            code = String(startCode).padStart(3, '0');
        }
        existingCodes.push(code); // Reserve this code
        return code;
    };

    // Helper to generate unique mobile (10-12 digits)
    const generateUniqueMobile = (index) => {
        const prefixes = ['9876543210', '8765432109', '7654321098', '6543210987',
            '5432109876', '4321098765', '3210987654', '2109876543',
            '9988776655', '8877665544', '7766554433', '6655443322'];

        let mobile = prefixes[index % prefixes.length];
        // Add variation to avoid conflicts
        if (index >= prefixes.length) {
            const suffix = String(index).padStart(2, '0');
            mobile = mobile.slice(0, 8) + suffix;
        }

        // Ensure it doesn't conflict with existing mobiles
        let counter = 0;
        let testMobile = mobile;
        while (existingMobiles.includes(testMobile) || farmers.some(f => f[2] === testMobile)) {
            counter++;
            const suffix = String(counter).padStart(2, '0');
            testMobile = mobile.slice(0, 8) + suffix;
            if (testMobile.length > 12) {
                testMobile = testMobile.slice(0, 12);
            }
        }
        existingMobiles.push(testMobile);
        return testMobile;
    };

    // Generate Aadhaar (12 digits)
    const generateAadhaar = (index) => {
        return String(123456789012 + index).padStart(12, '0').slice(0, 12);
    };

    // Generate PAN (10 chars: 5 letters, 4 digits, 1 letter)
    const generatePAN = (index) => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < 5; i++) {
            result += letters[(index + i * 3) % 26];
        }
        for (let i = 0; i < 4; i++) {
            result += String((index + i * 2) % 10);
        }
        result += letters[(index + 7) % 26];
        return result;
    };

    // Generate Seller ID Code (up to 18 digits)
    const generateSellerIdCode = (index) => {
        const base = '100000000000000000';
        return String(Number(base) + index).slice(0, 18);
    };

    // Generate bank account (10-20 digits)
    const generateBankAccount = (index) => {
        return String(1000000000 + index * 7 + 3).padStart(10, '0');
    };

    // Generate IFSC (11 chars)
    const generateIFSC = (index) => {
        const banks = ['SBIN', 'HDFC', 'ICIC', 'AXIS', 'KARB', 'MAHB', 'UTIB', 'IDBI'];
        const code = String(100000 + index * 3 + 7).padStart(7, '0');
        return banks[index % banks.length] + code;
    };

    // Data arrays
    const sellerTypes = ['Utpadak', 'Gavali'];
    const milkTypes = ['cow', 'buffalo', 'both'];
    const bankNames = ['State Bank of India', 'HDFC Bank', 'ICICI Bank',
        'Bank of Maharashtra', 'Axis Bank', 'Karnataka Bank'];
    const branches = ['Tasgaon', 'Manerajuri', 'Sangli', 'Madhavnagar',
        'Bhilwadi Station', 'Vita', 'Pune', 'Satara'];
    const baseAddress = "At.Tasgaon Tal.Tasgaon Dist.Sangli";
    const pincode = "416312";

    // Names from your reference data
    const names = [
        'Vijay Jamadade', 'Shrikant Dinkar Shinde', 'Mayur Sudhir Kumbhar',
        'Kisan Bapu Lohar', 'Ganesh Chougule', 'Shivraj Mhetre',
        'Dhanaji Shinde', 'Sambhagi Jadhav', 'Prakash Saluke',
        'Vijay Saluke', 'Bhagavan Salunkhe', 'Vitasla Chavan',
        'Gajanan Jadhav', 'Ashok Jadhav', 'Balaso Jamdade',
        'Shashikant Shinde', 'Dhodiram Chougale', 'Narayan Chougule',
        'Rahul Chougule', 'Aniket Irale', 'Bhaskar Rajmane',
        'Bhimrav Mane', 'Akshay Mane', 'Manoj Joshi',
        'Vikas Pawar', 'Farukh Nadaf', 'Ashpak Mujawa',
        'Sunil Jambade', 'Kumar Wandade', 'Amol Rajamane',
        'Ravsahab Kale', 'Sandeep Jamdade', 'Anurag Jamdade',
        'Prakash Jamdade', 'Sanjay Jamdade', 'Padmraj Pathare',
        'Tushar Mane', 'Manisha Jamdade', 'Bhagwan Jamjade',
        'Subhas Jadhav', 'Vishnu Jadhav', 'Anada Jamjade',
        'Swati Chowgule', 'Sourabh Desai', 'Mahadev Rajmane',
        'Harishchandra Rajamne', 'Sheda Mulla', 'Omkar Gurva',
        'Vijay Lohar', 'Akash Jamdade', 'Dilip Pawar',
        'Niten Jamdade', 'Deepak Rasale', 'Sandip Ladage'
    ];

    // Generate farmers
    for (let i = 0; i < 50; i++) {
        const nameIndex = i % names.length;
        const code = generateUniqueCode(i);
        const mobile = generateUniqueMobile(i);

        const farmer = [
            code,                                                      // Seller Code (UNIQUE)
            names[nameIndex],                                          // Name
            mobile,                                                    // Mobile (UNIQUE)
            generateAadhaar(i),                                        // Aadhaar
            generatePAN(i),                                            // PAN Number
            generateSellerIdCode(i),                                   // Seller ID Code
            sellerTypes[i % 2],                                        // Seller Type
            milkTypes[i % 3],                                          // Milk Type
            `${names[nameIndex].split(' ')[0]} Farm`,                 // Jamin
            generateBankAccount(i),                                    // Bank Account
            bankNames[i % bankNames.length],                          // Bank Name
            names[nameIndex],                                          // Account Holder Name
            branches[i % branches.length],                            // Branch Name
            generateIFSC(i),                                           // IFSC Code
            baseAddress,                                               // Address
            pincode,                                                   // Pincode
            i % 2 === 0 ? 1 : 0,                                      // Advance Enabled
            i % 2 === 0 ? (500 + (i % 5) * 100) : null,              // Advance Deduction
            i % 3 === 0 ? 1 : 0,                                      // Product Sale Enabled
            i % 4 === 0 ? 1 : 0,                                      // Deposit Enabled
            i % 4 === 0 ? (2.5 + (i % 3) * 0.5) : null,              // Deposit Per Litre
            i % 5 === 0 ? 1 : 0,                                      // Cattle Feed Enabled
            i === 0 ? 'farmer@123' : (i % 3 === 0 ? `farmer${i}@123` : '') // Password
        ];

        farmers.push(farmer);
    }

    // Create worksheet
    const wsData = [headers, ...farmers];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws['!cols'] = [
        { wch: 14 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 15 },
        { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 35 },
        { wch: 20 }, { wch: 28 }, { wch: 30 },
        { wch: 20 }, { wch: 15 }, { wch: 45 }, { wch: 10 },
        { wch: 18 }, { wch: 20 },
        { wch: 22 }, { wch: 18 },
        { wch: 20 }, { wch: 22 }, { wch: 20 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Farmers');
    XLSX.writeFile(wb, 'farmer_import_no_conflicts.xlsx');

    console.log('\n✅ Import file created: farmer_import_no_conflicts.xlsx');
    console.log(`📊 Total records: ${farmers.length}`);
    console.log(`🔑 Unique seller codes: ${new Set(farmers.map(f => f[0])).size}`);
    console.log(`📱 Unique mobile numbers: ${new Set(farmers.map(f => f[2])).size}`);
    console.log(`📋 Starting seller code: ${farmers[0][0]}`);

    // Verify no conflicts
    const codes = farmers.map(f => f[0]);
    const mobiles = farmers.map(f => f[2]);
    const codeDuplicates = codes.filter((c, i) => codes.indexOf(c) !== i);
    const mobileDuplicates = mobiles.filter((m, i) => mobiles.indexOf(m) !== i);

    if (codeDuplicates.length > 0) {
        console.warn('⚠️ Duplicate codes found:', codeDuplicates);
    } else {
        console.log('✅ No duplicate seller codes');
    }

    if (mobileDuplicates.length > 0) {
        console.warn('⚠️ Duplicate mobiles found:', mobileDuplicates);
    } else {
        console.log('✅ No duplicate mobile numbers');
    }

    // Show sample
    console.log('\n📋 Sample records (first 3):');
    farmers.slice(0, 3).forEach((f, idx) => {
        console.log(`  ${idx + 1}. Code: ${f[0]}, Name: ${f[1]}, Mobile: ${f[2]}, Type: ${f[6]}, Milk: ${f[7]}`);
    });
}

// Run the generator
generateValidImportFile().catch(console.error);