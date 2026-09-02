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
const productSalesRoutes = require('./routes/productsales.routes');
const sellerRoutes = require('./routes/seller.routes');
const farmerRoutes = require('./routes/farmer.routes');
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
const cattleFeedPurcahseRoutes = require('./routes/cattlefeedpurchase.routes')
const cattleFeedSaleRoutes = require('./routes/cattlefeedsale.routes');
const expenses = require('./routes/expenses.routes');
const productPurchasePaymentRoutes = require('./routes/productPurchasePayment.routes');
const cattleFeedPaymentRoutes = require('./routes/cattleFeedPayment.routes');
const ledgerRoutes = require('./routes/ledger.routes');
const centresRoutes = require('./routes/centres.routes');
const commission = require('./routes/commission.routes');
const tourRoutes = require('./routes/tour.routes');
const favouritesRoutes = require('./routes/favourites.routes');
const fulfillmentRoutes = require('./routes/fulfillment.routes');
const scheduleAutoCarryForward = require('./jobs/autoCarryForward.job');

const app = express();

app.use(
    cors({
        origin: true,
        credentials: true,
    })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/operators', operatorRoutes);
app.use('/api/rates', rateRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/farmer', farmerRoutes);
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
app.use('/api/cattle-feeds', cattleFeedPurcahseRoutes);
app.use('/api/cattle-feed-sales', cattleFeedSaleRoutes);
app.use('/api/expenses', expenses);
app.use('/api/product-purchase-payments', productPurchasePaymentRoutes);
app.use('/api/cattle-feed-payments', cattleFeedPaymentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/centres', centresRoutes);
app.use('/api/commission', commission);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/fulfillments', fulfillmentRoutes);


setInterval(async () => {
    try {
        await pool.query('DELETE FROM password_reset_otps WHERE expires_at < NOW() OR used = 1');
    } catch (err) {
        console.error('OTP cleanup error:', err.message);
    }
}, 60 * 60 * 1000);

scheduleAutoCarryForward();

// ======================
// Serve React Frontend
// ======================
const frontendPath = path.join(__dirname, "../frontend/dist");

app.use(express.static(frontendPath));

// React Router fallback (must be after API routes)
app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});


const server = http.createServer(app);


const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN || '*' },
});

weightMachine.init(io);
fatMachine.init(io);

server.listen(process.env.PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${process.env.PORT}`);
});