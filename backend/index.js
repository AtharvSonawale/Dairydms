const http = require('http');
const { Server } = require('socket.io');

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const pool = require('./config/db');
const path = require('path');


const authRoutes = require('./routes/auth.routes');
const operatorRoutes = require('./routes/operators.routes');
const rateRoutes = require('./routes/rate.routes');
const walkinRoutes = require('./routes/walkinsales.routes');
const productRoutes = require('./routes/productpurchase.routes');
const productSalesRoutes = require('./routes/productSales.routes');
const sellerRoutes = require('./routes/seller.routes');
const cashAdvanceRoutes = require('./routes/cashadvance.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const tankDispatchRoutes = require('./routes/tankDispatch.routes');
const stockRoutes = require('./routes/stock.routes');
const ownerUsageRoutes = require('./routes/ownerUsage.routes');
const sellerReportRoutes = require("./routes/sellerreport.routes");
const dailyCollectionRoutes = require("./routes/dailycollection.routes");
const paymentRoutes = require("./routes/payment.routes");
const bonusRoutes = require('./routes/bonus.routes');
const settingsRoutes = require('./routes/settings.routes');
const depositRoutes = require("./routes/deposit.routes");
const gavaliBonusRoutes = require("./routes/gavaliBonus.routes");
const walkinPaymentRoutes = require("./routes/walkinpayment.routes");
const adminManagementRoutes = require('./routes/adminmanagement.routes');
const portsRouter = require('./routes/ports.routes');
const weightMachine = require('./services/weightMachine.service');
const fatMachine = require('./services/fatMachine.service');

const tourRoutes = require('./routes/tour.routes');

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/milk-entries', require('./routes/milkEntry.routes'));
app.use('/api/walkin-sales', walkinRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-sales', productSalesRoutes);
app.use('/api/cash-advance', cashAdvanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/tank-dispatch', tankDispatchRoutes);
app.use('/api/owner-usage', ownerUsageRoutes);
app.use("/api/seller-report", sellerReportRoutes);
app.use("/api/daily-collection", dailyCollectionRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/deposits", depositRoutes);
app.use("/api/bonus", bonusRoutes);
app.use('/api/settings', settingsRoutes);
app.use("/api/gavali-bonus", gavaliBonusRoutes);
app.use("/api/walkin-payments", walkinPaymentRoutes);
app.use('/api/admin-management', adminManagementRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/admin', tourRoutes);
app.use('/api/settings/ports', portsRouter);

setInterval(async () => {
    try {
        await pool.query('DELETE FROM password_reset_otps WHERE expires_at < NOW() OR used = 1');
    } catch (err) {
        console.error('OTP cleanup error:', err.message);
    }
}, 60 * 60 * 1000);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*' },
});

weightMachine.init(io);
fatMachine.init(io);

server.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});