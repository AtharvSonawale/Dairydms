// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './pages/common/AppLayout';
import { AppConfigProvider } from './context/AppConfigContext';
import OperatorSettings from './pages/operator/Settings';
import FarmerSettings from './pages/farmer/Settings';

// ── Auth ───────────────────────────────────────────────────
import AdminLogin from './pages/auth/AdminLogin';
import OperatorLogin from './pages/auth/OperatorLogin';
import FarmerMilkEntries from "./pages/farmer/FarmerMilkEntries";

// ── Admin pages ────────────────────────────────────────────
import AdminDashboard from './pages/admin/Dashboard';
import CreateOperator from './pages/admin/CreateOperator';

import OperatorDashboard from './pages/operator/Dashboard';

import RateChart from './pages/common/RateChart';
import SellerRegister from './pages/SellerRegister';
import SellerProfile from './pages/SellerProfile';

import MilkEntries from './pages/MilkEntries';
import WalkinSales from './pages/WalkinSales';
import ProductPurchase from './pages/common/ProductPurchase';
import ProductSales from './pages/common/ProductSales';
import Products from './pages/common/Products';
import CashAdvance from './pages/common/CashAdvance';
import TankDispatch from './pages/common/TankDispatch';
import OwnerUsage from './pages/common/Ownerusage';
import SellerPayments from './pages/Sellerpayments';
import PremiumRates from './pages/admin/Premiumrates';
import UtpadakBonusRegister from './pages/UtpadakBonusRegister';
import GavaliBonusRegister from './pages/GavaliBonusRegister';
import SumReport from './pages/SumReport';
import OperatorList from './pages/admin/OperatorList';
import Settings from './pages/admin/Settings';
import { PermissionProvider } from './context/PermissionContext';
import CashDeposit from './pages/CashDeposit';
import ClearData from './pages/admin/ClearData';
import ForgotPassword from './pages/auth/ForgotPassword';
import WalkinPayments from './pages/WalkinPayments';
import NamedBuyers from './pages/NamedBuyers';
import AdminList from './pages/admin/AdminList';
import AdminProfile from './pages/admin/AdminProfile';
import PortSettings from './pages/admin/PortSettings';
import SellerLogin from './pages/SellerLogin';
import FarmerDashboard from './pages/FarmerDashboard';
import FarmerMilkBills from "./pages/farmer/FarmerMilkBills";
import FarmerFinance from "./pages/farmer/FarmerFinance";
import CattleFeedPurchase from './pages/common/CattleFeedPurchase';
import CattleFeedSales from './pages/common/Cattlefeedsale';
import CattleFeedCatalogue from './pages/common/CattleFeedCatalogue';
import FarmerCattleFeed from './pages/farmer/FarmerCattleFeed';
import FarmerProductPurchases from './pages/farmer/FarmerProductSales';
import WalkinPaymentsReport from './pages/Walkinsellerreports'
import WalkinSellerReports from './pages/Walkinsellerreports';
import WalkinNamedBuyersReports from './pages/Walkinnamedbuyersreports';
import WalkinAnonymousReport from './pages/WalkinAnonymousReports';
import WalkinAnonymousReports from './pages/WalkinAnonymousReports';
import UtpadakBonusReport from './pages/UtpadakBonusReport';
import GavaliBonusReport from './pages/GavaliBonusReport';
import Expenses from './pages/Expenses';
import ExpensesReport from './pages/ExpensesReport';
import PurchasedProductsBillPayment from './pages/common/PurchasedProductsBillPayment';
import CattleFeedPayments from './pages/CattleFeedPayments';
import FarmerLedger from './pages/Farmerledger';
import FarmerLedgerDetail from './pages/FarmerLedgerDetail';
import Centres from './pages/admin/Centres';
import CommissionSettings from './pages/admin/CommissionSettings';
import UtpadakMilkEntry from './pages/UtpadakMilkEntry';
import GavaliMilkEntry from './pages/GavaliMilkEntry';
import MyProfile from './pages/admin/MyProfile';
import AllMilkEntries from './pages/AllMilkEntries';
import ProductSalesReport from './pages/ProductSalesReport';
import CattleFeedSalesReport from './pages/CattleFeedSalesReport';
import OperatorMyProfile from './pages/operator/MyProfile';

// ── Farmer Profile ──────────────────────────────────────────
import FarmerProfile from './pages/farmer/FarmerProfile';

// ── Unified Login ──────────────────────────────────────────
import UnifiedLogin from './pages/auth/UnifiedLogin';

// ── Root redirect ──────────────────────────────────────────
// If a valid session exists, skip the login page and go straight
// to the right landing page for that role.
function RootRedirect() {
  const { user } = useAuth();

  if (user?.token) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'operator') return <Navigate to="/milkentries" replace />;
    if (user.role === 'seller') return <Navigate to="/farmer/dashboard" replace />;
  }

  return <UnifiedLogin />;
}

function AppRoutes() {
  return (
    <Routes>

      <Route path="/" element={<RootRedirect />} />
      <Route path="/operator/login" element={<OperatorLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/farmer/login" element={<SellerLogin />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >

        {/* ── Admin ── */}
        <Route path="/admin/dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/operators/new" element={<ProtectedRoute role="admin"><CreateOperator /></ProtectedRoute>} />
        <Route path="/admin/adminlist" element={<ProtectedRoute role="admin"><AdminList /></ProtectedRoute>} />
        <Route path="/admin/admins" element={<ProtectedRoute role="admin"><AdminList /></ProtectedRoute>} />
        <Route path="/admin/admins/:id" element={<ProtectedRoute role="admin"><AdminProfile /></ProtectedRoute>} />
        <Route path="/admin/ports" element={<ProtectedRoute role="aadmin"><PortSettings /></ProtectedRoute>} />
        <Route path="/all-milk-entries" element={<ProtectedRoute role="admin"><AllMilkEntries /></ProtectedRoute>} />

        {/* ── Operator ── */}
        <Route path="/operator/dashboard" element={<ProtectedRoute role="operator"><OperatorDashboard /></ProtectedRoute>} />

        <Route path="/sellerregister" element={<ProtectedRoute><SellerRegister /></ProtectedRoute>} />
        <Route path="seller/:seller_id" element={<ProtectedRoute role="admin"><SellerProfile /></ProtectedRoute>} />
        <Route path="/milkentries" element={<ProtectedRoute><MilkEntries /></ProtectedRoute>} />
        <Route path="/walkinsales" element={<ProtectedRoute><WalkinSales /></ProtectedRoute>} />
        <Route path="/operator/walkin" element={<ProtectedRoute><WalkinSales /></ProtectedRoute>} />
        <Route path="/productpurchase" element={<ProtectedRoute><ProductPurchase /></ProtectedRoute>} />
        <Route path="/productsales" element={<ProtectedRoute><ProductSales /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/cashadvance" element={<ProtectedRoute><CashAdvance /></ProtectedRoute>} />
        <Route path="/tankdispatch" element={<ProtectedRoute><TankDispatch /></ProtectedRoute>} />
        <Route path="/ownerusage" element={<ProtectedRoute><OwnerUsage /></ProtectedRoute>} />
        <Route path="/sellerpayments" element={<ProtectedRoute><SellerPayments /></ProtectedRoute>} />
        <Route path="/admin/premiumrates" element={<ProtectedRoute><PremiumRates /></ProtectedRoute>} />
        <Route path="/rates" element={<ProtectedRoute><RateChart /></ProtectedRoute>} />
        <Route path="/utpadakbonusregister" element={<ProtectedRoute><UtpadakBonusRegister /></ProtectedRoute>} />
        <Route path="/sumreport" element={<ProtectedRoute><SumReport /></ProtectedRoute>} />
        <Route path="/admin/operatorlist" element={<ProtectedRoute><OperatorList /></ProtectedRoute>} />
        <Route path="/admin/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/cashdeposit" element={<ProtectedRoute><CashDeposit /></ProtectedRoute>} />
        <Route path="/gavalibonusregister" element={<ProtectedRoute><GavaliBonusRegister /></ProtectedRoute>} />
        <Route path="/admin/clear-data" element={<ClearData />} />
        <Route path='/walkinpayments' element={<WalkinPayments />} />
        <Route path='/namedbuyers' element={<NamedBuyers />} />
        <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
        <Route path="/farmer/milk-entries" element={<FarmerMilkEntries />} />
        <Route path="/farmer/bills" element={<FarmerMilkBills />} />
        <Route path="/farmer/finance" element={<FarmerFinance />} />
        <Route path="/farmer/cattle-feed" element={<FarmerCattleFeed />} />
        <Route path="/cattlefeed-purchase" element={<CattleFeedPurchase />} />
        <Route path="/cattlefeed-sales" element={<CattleFeedSales />} />
        <Route path="/cattlefeed-catalogue" element={<CattleFeedCatalogue />} />
        <Route path="/farmer/product-purchases" element={<FarmerProductPurchases />} />
        <Route path="/walkinsellersreport" element={<ProtectedRoute><WalkinSellerReports /></ProtectedRoute>} />
        <Route path="/walkinnamedbuyersreports" element={<ProtectedRoute><WalkinNamedBuyersReports /></ProtectedRoute>} />
        <Route path="/walkinanonymousreports" element={<ProtectedRoute><WalkinAnonymousReports /></ProtectedRoute>} />
        <Route path="/utpadakbonusreport" element={<ProtectedRoute><UtpadakBonusReport /></ProtectedRoute>} />
        <Route path="/gavalibonusreport" element={<ProtectedRoute><GavaliBonusReport /></ProtectedRoute>} />
        <Route path="/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
        <Route path="/expensesreport" element={<ProtectedRoute><ExpensesReport /></ProtectedRoute>} />
        <Route path="/product-purchase-payments" element={<PurchasedProductsBillPayment />} />
        <Route path="/cattlefeed-purchase-payments" element={<CattleFeedPayments />} />
        <Route path="/farmer-ledger" element={<FarmerLedger />} />
        <Route path="/farmer-ledger/:seller_id" element={<FarmerLedgerDetail />} />
        <Route path="/admin/centres" element={<ProtectedRoute role="admin"><Centres /></ProtectedRoute>} />
        <Route path="/operator/settings" element={<OperatorSettings />} />
        <Route path="/farmer/settings" element={<FarmerSettings />} />
        <Route path="/commission-settings" element={<CommissionSettings />} />
        <Route path="/milkentries" element={<ProtectedRoute><MilkEntries /></ProtectedRoute>} />
        <Route path="/utpadak-milk-entry" element={<ProtectedRoute><UtpadakMilkEntry /></ProtectedRoute>} />
        <Route path="/gavali-milk-entry" element={<ProtectedRoute><GavaliMilkEntry /></ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute><MyProfile /></ProtectedRoute>} />
        <Route path="/product-sales/report" element={<ProtectedRoute><ProductSalesReport /></ProtectedRoute>} />
        <Route path="/cattle-feed-sales/report" element={<ProtectedRoute><CattleFeedSalesReport /></ProtectedRoute>} />
        <Route path="/premiumrates" element={<ProtectedRoute><PremiumRates /></ProtectedRoute>} />
        {/* ── Farmer Profile ── */}
        <Route path="/farmer/profile" element={<ProtectedRoute><FarmerProfile /></ProtectedRoute>} />
        <Route path="/farmer/profile/:farmer_id" element={<ProtectedRoute><FarmerProfile /></ProtectedRoute>} />
        <Route path="/operator/profile" element={<ProtectedRoute role="operator"><OperatorMyProfile /></ProtectedRoute>} />
        
        {/* ── Seller Profile (alias for admin) ── */}
        <Route path="/farmer/:farmer_id" element={<ProtectedRoute><FarmerProfile /></ProtectedRoute>} />

      </Route>

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AppConfigProvider>
        <PermissionProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PermissionProvider>
      </AppConfigProvider>
    </AuthProvider>
  );
}