import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './pages/common/AppLayout';
import { AppConfigProvider } from './context/AppConfigContext';

// ── Auth ───────────────────────────────────────────────────
import AdminLogin from './pages/auth/AdminLogin';
import AdminSignup from './pages/auth/AdminSignup';
import OperatorLogin from './pages/auth/OperatorLogin';

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


// AFTER
function AppRoutes() {
  return (
    <Routes>

      <Route path="/" element={<AdminLogin />} />
      <Route path="/signup" element={<AdminSignup />} />
      <Route path="/operator/login" element={<OperatorLogin />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

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
        <Route path="/admin/portsettings" element={<ProtectedRoute role="aadmin"><PortSettings /></ProtectedRoute>} />

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