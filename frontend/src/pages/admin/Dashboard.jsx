import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import api from "../../api/axios";
import {
    Milk, ShoppingCart, ShoppingBag, Wallet, TrendingUp,
    TrendingDown, Users, Package, RefreshCw, Sun, Moon,
    AlertTriangle, Banknote, Layers, Truck,
    FlaskConical, ArrowUpRight, ArrowDownRight, Home,
    Settings, Calendar, Wheat, Gift, Percent,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const fmtTime = (d) =>
    d
        ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "—";

// ── Date Range Helper ────────────────────────────────────────
const getDateRange = (dateStr, period) => {
    const date = new Date(dateStr);
    let from, to;

    switch (period) {
        case 'day':
            from = to = dateStr;
            break;
        case 'week':
            const dayOfWeek = date.getDay();
            const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(date);
            monday.setDate(diff);
            from = monday.toISOString().split('T')[0];
            const sunday = new Date(monday);
            sunday.setDate(diff + 6);
            to = sunday.toISOString().split('T')[0];
            break;
        case 'month':
            from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
            to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            break;
        case 'year':
            from = `${date.getFullYear()}-01-01`;
            to = `${date.getFullYear()}-12-31`;
            break;
        default:
            from = to = dateStr;
    }
    return { from, to };
};

const formatPeriodLabel = (period, from, to) => {
    if (period === 'day') return new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (period === 'week') {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        return `${fromDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${toDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    if (period === 'month') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (period === 'year') return new Date(from).getFullYear();
    return '';
};

// ── sub-components ────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, className = "" }) {
    const colors = {
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        red: "from-red-50 to-red-100/50 border-red-200/60 text-red-600",
        slate: "from-slate-50 to-slate-100/50 border-slate-200/60 text-slate-700",
        indigo: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700",
        teal: "from-teal-50 to-teal-100/50 border-teal-200/60 text-teal-700",
    };
    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colors[color]} shadow-sm hover:shadow-md transition-shadow duration-200 p-4 flex flex-col gap-1.5 ${className}`}>
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-70">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
            {sub && <p className="text-xs text-gray-500 leading-tight">{sub}</p>}
            <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/20 blur-2xl" />
        </div>
    );
}

function SectionHeader({ icon, title, sub, action }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
                    {sub && <p className="text-xs text-gray-500 leading-tight">{sub}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function ShiftBadge({ shift, t }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold uppercase
            ${shift === "morning"
                ? "bg-amber-400/20 text-amber-700 border border-amber-300/50 backdrop-blur-sm"
                : "bg-indigo-400/20 text-indigo-700 border border-indigo-300/50 backdrop-blur-sm"}`}>
            {shift === "morning" ? <Sun size={12} /> : <Moon size={12} />}
            {shift === "morning" ? t('bill.morning') : t('bill.evening')}
        </span>
    );
}

function MilkTypeBadge({ type }) {
    return (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm
            ${type === "cow"
                ? "bg-amber-400/20 text-amber-700 border border-amber-300/50"
                : "bg-blue-400/20 text-blue-700 border border-blue-300/50"}`}>
            {type}
        </span>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
            <div className="p-4 rounded-full bg-gray-100/50">{icon}</div>
            <p className="text-sm font-medium">{text}</p>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );
}

function CompactCard({ children, className = "" }) {
    return (
        <div className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 hover:shadow-xl transition-shadow duration-300 p-5 ${className}`}>
            {children}
        </div>
    );
}

// ── Main Admin Dashboard ──────────────────────────────────────
export default function AdminDashboard() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return { text: t('dashboard.greetMorning'), icon: <Sun size={18} className="text-amber-500" /> };
        if (h < 17) return { text: t('dashboard.greetAfternoon'), icon: <Sun size={18} className="text-orange-400" /> };
        return { text: t('dashboard.greetEvening'), icon: <Moon size={18} className="text-indigo-400" /> };
    };

    const greeting = getGreeting();

    const [selectedDate, setSelectedDate] = useState(today());
    const [period, setPeriod] = useState('day');
    const [refreshing, setRefreshing] = useState(false);
    const [flash, setFlash] = useState(null);
    const [openingMilk, setOpeningMilk] = useState({ cow: 0, buffalo: 0 });
    const [cowWalkin, setCowWalkin] = useState(true);

    const { from: rangeFrom, to: rangeTo } = getDateRange(selectedDate, period);

    const [milkEntries, setMilkEntries] = useState([]);
    const [walkinSales, setWalkinSales] = useState([]);
    const [productSales, setProductSales] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [products, setProducts] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const [ownerUsage, setOwnerUsage] = useState([]);
    const [operators, setOperators] = useState([]);
    const [cattleFeeds, setCattleFeeds] = useState([]);
    const [cattleFeedSales, setCattleFeedSales] = useState([]);
    const [cattleFeedPurchases, setCattleFeedPurchases] = useState([]);
    const [bonusEvents, setBonusEvents] = useState([]);
    const [bonusPayments, setBonusPayments] = useState([]);
    const [gavaliBonusPayments, setGavaliBonusPayments] = useState([]);
    const [commissionSettings, setCommissionSettings] = useState([]);

    const [profits, setProfits] = useState({
        total_profit: 0,
        product_sales_profit: 0,
        walkin_profit: 0,
        dispatch_profit: 0,
        owner_usage_cost: 0,
        cattle_feed_sales_profit: 0,
        cattle_feed_purchase_spend: 0,
        utpadak_bonus_paid: 0,
        gavali_bonus_paid: 0,
        bonus_paid: 0,
        total_commission: 0,
    });

    const [load, setLoad] = useState({
        milk: true, walkin: true, psales: true, ppurch: true,
        advance: true, products: true, dispatch: true,
        ownerUsage: true, operators: true,
        cfeeds: true, cfsales: true, cfpurch: true,
        bonus: true, commission: true,
    });

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchAll = useCallback(async (fromDate, toDate) => {
        setRefreshing(true);
        try {
            const { data } = await api.get(`/dashboard?from=${fromDate}&to=${toDate}`);

            setMilkEntries(data.milk_entries || []);
            setWalkinSales(data.walkin_sales || []);
            setProductSales(data.product_sales || []);
            setPurchases(data.purchases || []);
            setAdvances(data.advances || []);
            setProducts(data.products || []);
            setDispatches(data.dispatches || []);
            setOwnerUsage(data.owner_usage || []);
            setOperators(data.operators || []);
            setCattleFeeds(data.cattle_feeds || []);
            setCattleFeedSales(data.cattle_feed_sales || []);
            setCattleFeedPurchases(data.cattle_feed_purchases || []);
            setBonusEvents(data.bonus_events || []);
            setBonusPayments(data.bonus_payments || []);
            setGavaliBonusPayments(data.gavali_bonus_payments || []);
            setCommissionSettings(data.commission_settings || []);

            if (data.profits) {
                setProfits(data.profits);
            }

            try {
                const { data: stockData } = await api.get(`/stock/available?date=${fromDate}`);
                setOpeningMilk({
                    cow: parseFloat(stockData.opening?.cow || 0),
                    buffalo: parseFloat(stockData.opening?.buffalo || 0),
                });
            } catch {
                setOpeningMilk({ cow: 0, buffalo: 0 });
            }
        } catch {
            showFlash("error", "Failed to load dashboard data");
        } finally {
            setRefreshing(false);
            setLoad({
                milk: false, walkin: false, psales: false, ppurch: false,
                advance: false, products: false, dispatch: false,
                ownerUsage: false, operators: false,
                cfeeds: false, cfsales: false, cfpurch: false,
                bonus: false, commission: false,
            });
        }
    }, []);

    useEffect(() => {
        fetchAll(rangeFrom, rangeTo);
    }, [selectedDate, period, fetchAll, rangeFrom, rangeTo]);

    const totalMilkQty = milkEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalMilkAmt = milkEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const avgFat = milkEntries.length ? milkEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / milkEntries.length : 0;
    const avgSnf = milkEntries.length ? milkEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / milkEntries.length : 0;
    const morningEntries = milkEntries.filter((e) => e.shift === "morning");
    const eveningEntries = milkEntries.filter((e) => e.shift === "evening");
    const cowEntries = milkEntries.filter((e) => e.milk_type === "cow");
    const bufEntries = milkEntries.filter((e) => e.milk_type === "buffalo");

    const avgFatCow = cowEntries.length ? cowEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / cowEntries.length : 0;
    const avgSnfCow = cowEntries.length ? cowEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / cowEntries.length : 0;
    const avgFatBuf = bufEntries.length ? bufEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / bufEntries.length : 0;
    const avgSnfBuf = bufEntries.length ? bufEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / bufEntries.length : 0;

    const walkinRevenue = walkinSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const prodSaleRev = productSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const purchaseSpend = purchases.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
    const dairySaleRev = dispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);

    const cowWalkinSales = walkinSales.filter(s => s.milk_type === "cow");
    const bufWalkinSales = walkinSales.filter(s => s.milk_type === "buffalo");
    const cowWalkinRev = cowWalkinSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const bufWalkinRev = bufWalkinSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const cowWalkinQty = cowWalkinSales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0);
    const bufWalkinQty = bufWalkinSales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0);

    const advGiven = advances.filter((a) => a.type === "given").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const advReceived = advances.filter((a) => a.type === "received").reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const lowStockItems = products.filter((p) => parseFloat(p.current_stock || 0) < 5);
    const outOfStock = products.filter((p) => parseFloat(p.current_stock || 0) <= 0);

    const totalDispatched = dispatches.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
    const totalFactoryRev = dispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);
    const avgFactoryRate = dispatches.length ? dispatches.reduce((a, d) => a + parseFloat(d.factory_rate || 0), 0) / dispatches.length : 0;

    const totalUsageQty = ownerUsage.reduce((a, u) => a + parseFloat(u.quantity || 0), 0);
    const morningUsage = ownerUsage.filter((u) => u.shift === "morning");
    const eveningUsage = ownerUsage.filter((u) => u.shift === "evening");
    const morningUsageQ = morningUsage.reduce((a, u) => a + parseFloat(u.quantity || 0), 0);
    const eveningUsageQ = eveningUsage.reduce((a, u) => a + parseFloat(u.quantity || 0), 0);

    const cattleFeedSaleRev = cattleFeedSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const cattleFeedPurchaseSpend = cattleFeedPurchases.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
    const outOfStockFeeds = cattleFeeds.filter((f) => parseFloat(f.current_stock || 0) <= 0);

    const allBonusPayments = [
        ...bonusPayments.map(b => ({ ...b, bonus_scheme: 'Utpadak' })),
        ...gavaliBonusPayments.map(b => ({ ...b, bonus_scheme: 'Gavali' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const totalBonusPaid = allBonusPayments.filter(b => b.is_paid).reduce((a, b) => a + parseFloat(b.total_bonus || 0), 0);
    const activeBonusEvents = bonusEvents;

    const recentMilk = [...milkEntries].slice(0, 5);
    const recentWalkin = [...walkinSales].slice(0, 5);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            {greeting.icon}
                            <span>{greeting.text},</span>
                            <span className="font-semibold text-gray-800">{user?.name || t('status.admin')}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent" data-tour="dashboard-title">{t('dashboard.title')}</h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
                        <div className="flex rounded-xl border border-gray-200/60 overflow-x-auto text-sm font-semibold bg-white/50 backdrop-blur-sm shadow-sm w-full sm:w-auto">
                            {['day', 'week', 'month', 'year'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`px-4 py-2 whitespace-nowrap transition-all duration-200 ${period === p ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "text-gray-600 hover:bg-gray-100/50"}`}
                                >
                                    {t(`dashboard.${p}`)}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-shrink-0">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-4 py-2 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition shadow-sm w-full sm:w-40"
                            />
                        </div>

                        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 text-sm font-medium shadow-sm min-w-0 w-full sm:w-auto">
                            <Calendar size={16} className="flex-shrink-0 text-gray-400" />
                            <span className="truncate">{formatPeriodLabel(period, rangeFrom, rangeTo)}</span>
                        </div>
                    </div>
                </div>

                {/* Period Info Banner */}
                <div className="flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 backdrop-blur-sm border border-blue-200/40 text-sm text-gray-600 shadow-sm">
                    <Calendar size={16} className="mr-2.5 text-blue-500" />
                    {t('dashboard.showingData')} <strong className="text-gray-800 mx-1.5">{new Date(rangeFrom).toLocaleDateString('en-IN')}</strong> {t('dashboard.to')} <strong className="text-gray-800 mx-1.5">{new Date(rangeTo).toLocaleDateString('en-IN')}</strong>
                </div>

                {/* Shift Priority Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-lg shadow-amber-200/30 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/10 blur-3xl" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-400/30">
                                    <Sun size={22} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">{t('dashboard.morningShift')}</p>
                                    <p className="text-2xl font-bold text-amber-800 leading-tight">
                                        {morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                        <span className="text-sm font-medium text-amber-500 ml-1">L</span>
                                    </p>
                                    <p className="text-xs text-amber-500 mt-0.5">{morningEntries.length} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-amber-400 uppercase tracking-wider">{t('bill.amount')}</p>
                                <p className="text-lg font-bold text-amber-700">
                                    ₹{fmt(morningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-indigo-100/50 shadow-lg shadow-indigo-200/30 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/10 blur-3xl" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <Moon size={22} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">{t('dashboard.eveningShift')}</p>
                                    <p className="text-2xl font-bold text-indigo-800 leading-tight">
                                        {eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                        <span className="text-sm font-medium text-indigo-400 ml-1">L</span>
                                    </p>
                                    <p className="text-xs text-indigo-400 mt-0.5">{eveningEntries.length} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-indigo-400 uppercase tracking-wider">{t('bill.amount')}</p>
                                <p className="text-lg font-bold text-indigo-700">
                                    ₹{fmt(eveningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Period Summary Pills */}
                <div className="flex flex-wrap gap-2">
                    {[
                        { label: t('dashboard.milkEntries'), value: milkEntries.length, color: "bg-amber-100/60 text-amber-700 border-amber-200/60" },
                        { label: t('dashboard.sellersActive'), value: [...new Set(milkEntries.map(e => e.seller_id))].length, color: "bg-blue-100/60 text-blue-700 border-blue-200/60" },
                        { label: t('dashboard.walkinCount'), value: walkinSales.length, color: "bg-emerald-100/60 text-emerald-700 border-emerald-200/60" },
                        { label: t('dashboard.productSalesCount'), value: productSales.length, color: "bg-violet-100/60 text-violet-700 border-violet-200/60" },
                        { label: t('dashboard.dispatchCount'), value: dispatches.length, color: "bg-slate-100/60 text-slate-700 border-slate-200/60" },
                        { label: t('dashboard.advanceCount'), value: advances.length, color: "bg-rose-100/60 text-rose-700 border-rose-200/60" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border backdrop-blur-sm text-sm font-semibold ${color}`}>
                            <span className="opacity-60">{label}</span>
                            <span className="font-bold">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Flash message */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm ${flash.type === "success" ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700" : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        <AlertTriangle size={18} />
                        {flash.msg}
                    </div>
                )}

                {/* Stock alerts */}
                {(outOfStock.length > 0 || lowStockItems.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                        {outOfStock.map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50/80 backdrop-blur-sm border border-red-200/60 text-red-700 text-sm font-semibold shadow-sm">
                                <AlertTriangle size={16} /> {p.product_name} — {t('dashboard.outOfStockLabel')}
                            </div>
                        ))}
                        {lowStockItems.filter((p) => parseFloat(p.current_stock) > 0).map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 text-amber-700 text-sm font-semibold shadow-sm">
                                <AlertTriangle size={16} /> {p.product_name} — {t('dashboard.lowStockLabel')} ({parseFloat(p.current_stock).toFixed(1)} {p.unit})
                            </div>
                        ))}
                    </div>
                )}

                {/* Revenue Overview */}
                <div data-tour="revenue-overview">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.revenueOverview')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label={t('dashboard.totalProfit')} value={"₹" + fmt(profits.total_profit)} icon={<Banknote size={18} />} color="emerald" />
                        <StatCard label={t('dashboard.dairySale')} value={"₹" + fmt(dairySaleRev)} sub={`${dispatches.length} ${t('dashboard.dispatches')}`} icon={<Truck size={18} />} color="amber" />
                        <StatCard label={t('dashboard.walkinSales')} value={"₹" + fmt(walkinRevenue)} sub={`${walkinSales.length} ${t('dashboard.transactions')}`} icon={<ShoppingCart size={18} />} color="blue" />
                        <StatCard label={t('dashboard.productSales')} value={"₹" + fmt(prodSaleRev)} sub={`${productSales.length} ${t('dashboard.itemsSold')}`} icon={<ShoppingBag size={18} />} color="violet" />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <StatCard label={t('dashboard.purchaseSpend')} value={"₹" + fmt(purchaseSpend)} sub={`${purchases.length} ${t('dashboard.purchases')}`} icon={<TrendingDown size={18} />} color="red" />
                        <StatCard label={t('dashboard.cattleFeedSales') || 'Cattle Feed Sales'} value={"₹" + fmt(cattleFeedSaleRev)} sub={`${cattleFeedSales.length} ${t('dashboard.transactions')}`} icon={<Wheat size={18} />} color="amber" />
                        <StatCard label={t('dashboard.cattleFeedPurchases') || 'Cattle Feed Purchases'} value={"₹" + fmt(cattleFeedPurchaseSpend)} sub={`${cattleFeedPurchases.length} ${t('dashboard.purchases')}`} icon={<Wheat size={18} />} color="violet" />
                        <StatCard label={t('dashboard.totalBonusPaid') || 'Total Bonus Paid'} value={"₹" + fmt(totalBonusPaid)} sub={`${allBonusPayments.filter(b => b.is_paid).length} ${t('dashboard.transactions')}`} icon={<Gift size={18} />} color="slate" />
                    </div>
                </div>

                {/* Milk Collection */}
                <div data-tour="milk-collection">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.milkCollection')}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-lg shadow-amber-200/30 p-4 col-span-2 md:col-span-1">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/10 blur-3xl" />
                            <div className="flex items-center justify-between relative z-10">
                                <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{t('dashboard.totalCollection')}</p>
                                <Milk size={18} className="opacity-70 text-amber-600" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{totalMilkQty.toFixed(1)} L</p>
                            <div className="text-xs text-gray-600 mt-0.5">
                                <p>{t('dashboard.opening')}: {openingMilk.cow.toFixed(1)}L cow + {openingMilk.buffalo.toFixed(1)}L buffalo</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{milkEntries.length} {t('dashboard.entries')}</p>
                        </div>

                        <StatCard label={t('dashboard.milkPayable')} value={"₹" + fmt(totalMilkAmt)} sub={t('dashboard.dueAllSellers')} icon={<Banknote size={18} />} color="emerald" />

                        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-indigo-100/50 shadow-lg shadow-indigo-200/30 p-4 col-span-2 md:col-span-1">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/10 blur-3xl" />
                            <div className="flex items-center justify-between relative z-10">
                                <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{t('dashboard.avgFatSnf')}</p>
                                <FlaskConical size={18} className="opacity-70 text-indigo-600" />
                            </div>
                            <p className="text-xl font-bold text-gray-900 mt-1">{avgFat.toFixed(2)} / {avgSnf.toFixed(2)}</p>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                                <p className="text-xs text-amber-600 font-mono">Cow: {avgFatCow.toFixed(2)} FAT · {avgSnfCow.toFixed(2)} SNF</p>
                                <p className="text-xs text-blue-600 font-mono">Buffalo: {avgFatBuf.toFixed(2)} FAT · {avgSnfBuf.toFixed(2)} SNF</p>
                            </div>
                        </div>

                        <StatCard label={t('dashboard.activeSellers')} value={[...new Set(milkEntries.map((e) => e.seller_id))].length} sub={`${morningEntries.length}M · ${eveningEntries.length}E`} icon={<Users size={18} />} color="slate" />
                    </div>

                    {/* Breakdown row */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        {[
                            { label: t('bill.morning'), qty: morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: morningEntries.length, icon: <Sun size={16} />, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                            { label: t('bill.evening'), qty: eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: eveningEntries.length, icon: <Moon size={16} />, color: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700" },
                            { label: t('dashboard.cow'), qty: cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: cowEntries.length, icon: null, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                            { label: t('dashboard.buffalo'), qty: bufEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: bufEntries.length, icon: null, color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700" },
                        ].map(({ label, qty, count, icon, color }) => (
                            <div key={label} className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
                                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
                                {icon && <div className="shrink-0 relative z-10">{icon}</div>}
                                <div className="relative z-10">
                                    <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                    <p className="text-lg font-bold text-gray-900">{qty.toFixed(1)} L</p>
                                    <p className="text-xs text-gray-500">{count} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Walk-in Sales Breakdown */}
                {(cowWalkinQty > 0 || bufWalkinQty > 0) && (
                    <div className="relative overflow-hidden rounded-2xl border border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-lg shadow-blue-200/30 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-400/10 blur-3xl" />
                        <div className="flex items-center justify-between mb-3 relative z-10">
                            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 opacity-70">{t('dashboard.walkinBreakdown')}</p>
                            <ShoppingCart size={20} className="text-blue-500 opacity-70" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 relative z-10">
                            <div
                                className={`px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200 ${cowWalkin ? "bg-gradient-to-br from-amber-400 to-amber-500 border-amber-400 shadow-lg shadow-amber-400/30 text-white" : "bg-white/60 backdrop-blur-sm border-amber-200/60 text-amber-800 hover:shadow-md"}`}
                                onClick={() => setCowWalkin(true)}
                            >
                                <p className="text-sm font-semibold">{t('dashboard.cowWalkin')}</p>
                                <p className="text-2xl font-bold">{cowWalkinQty.toFixed(1)} L</p>
                                <p className="text-sm font-semibold opacity-80">₹{fmt(cowWalkinRev)}</p>
                                <p className="text-xs opacity-70">{cowWalkinSales.length} {t('dashboard.sales')}</p>
                            </div>
                            <div
                                className={`px-4 py-3 rounded-xl border cursor-pointer transition-all duration-200 ${!cowWalkin ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-500 shadow-lg shadow-blue-500/30 text-white" : "bg-white/60 backdrop-blur-sm border-blue-200/60 text-blue-800 hover:shadow-md"}`}
                                onClick={() => setCowWalkin(false)}
                            >
                                <p className="text-sm font-semibold">{t('dashboard.bufWalkin')}</p>
                                <p className="text-2xl font-bold">{bufWalkinQty.toFixed(1)} L</p>
                                <p className="text-sm font-semibold opacity-80">₹{fmt(bufWalkinRev)}</p>
                                <p className="text-xs opacity-70">{bufWalkinSales.length} {t('dashboard.sales')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Two-column layout for middle sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Tank Dispatch */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.tankDispatch')}</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <StatCard label={t('dashboard.dispatchesToday')} value={dispatches.length} sub={t('dashboard.trips')} icon={<Truck size={16} />} color="blue" />
                            <StatCard label={t('dashboard.totalDispatched')} value={totalDispatched.toFixed(1) + " L"} sub={t('dashboard.milkSentFactory')} icon={<Milk size={16} />} color="amber" />
                            <StatCard label={t('dashboard.factoryRevenue')} value={"₹" + fmt(totalFactoryRev)} sub={t('dashboard.fromFactory')} icon={<Banknote size={16} />} color="emerald" />
                            <StatCard label={t('dashboard.avgFactoryRate')} value={"₹" + avgFactoryRate.toFixed(2) + "/L"} sub={dispatches.length ? `${dispatches.length} ${t('dashboard.dispatches')}` : t('dashboard.noDispatch')} icon={<TrendingUp size={16} />} color="violet" />
                        </div>

                        <CompactCard>
                            <SectionHeader icon={<Truck size={16} className="text-white" />} title={t('dashboard.dispatchRecords')} sub={`${dispatches.length} ${t('dashboard.today')} · ₹${fmt(totalFactoryRev)}`} />
                            {load.dispatch ? <Spinner /> : dispatches.length === 0 ? (
                                <EmptyState icon={<Truck size={36} />} text={t('dashboard.noDispatches')} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {dispatches.slice(0, 5).map((d) => (
                                        <div key={d.dispatch_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                                                    <Truck size={16} className="text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 truncate">{d.factory_name || "—"}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        {d.vehicle_no && (
                                                            <span className="text-xs text-blue-600 font-mono bg-blue-100/60 px-2 py-0.5 rounded-full backdrop-blur-sm border border-blue-200/40">
                                                                {d.vehicle_no}
                                                            </span>
                                                        )}
                                                        {d.avg_fat && (
                                                            <span className="text-xs text-amber-600 font-mono bg-amber-100/60 px-2 py-0.5 rounded-full backdrop-blur-sm border border-amber-200/40">
                                                                FAT {parseFloat(d.avg_fat).toFixed(2)}%
                                                            </span>
                                                        )}
                                                        {d.avg_snf && (
                                                            <span className="text-xs text-violet-600 font-mono bg-violet-100/60 px-2 py-0.5 rounded-full backdrop-blur-sm border border-violet-200/40">
                                                                SNF {parseFloat(d.avg_snf).toFixed(2)}%
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="text-sm font-bold text-gray-800">{parseFloat(d.total_liters).toFixed(1)} L</p>
                                                <p className="text-xs text-gray-500">₹{fmt(d.factory_rate)}/L</p>
                                                <p className="text-xs font-semibold text-emerald-600">₹{fmt(d.total_amount)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CompactCard>
                    </div>

                    {/* Owner Usage */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.ownerUsage')}</p>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                            <StatCard label={t('dashboard.totalUsed')} value={totalUsageQty.toFixed(1) + " L"} sub={t('dashboard.personalConsumption')} icon={<Home size={16} />} color="teal" />
                            <StatCard label={t('dashboard.morningUsage')} value={morningUsageQ.toFixed(1) + " L"} sub={`${morningUsage.length} ${t('dashboard.entries')}`} icon={<Sun size={16} />} color="amber" />
                            <StatCard label={t('dashboard.eveningUsage')} value={eveningUsageQ.toFixed(1) + " L"} sub={`${eveningUsage.length} ${t('dashboard.entries')}`} icon={<Moon size={16} />} color="indigo" />
                        </div>

                        <CompactCard>
                            <SectionHeader icon={<Home size={16} className="text-white" />} title={t('dashboard.usageRecords')} sub={`${ownerUsage.length} ${t('dashboard.entries')} ${t('dashboard.today')} · ${totalUsageQty.toFixed(1)} L`} />
                            {load.ownerUsage ? <Spinner /> : ownerUsage.length === 0 ? (
                                <EmptyState icon={<Home size={36} />} text={t('dashboard.noUsage')} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {ownerUsage.slice(0, 5).map((u) => (
                                        <div key={u.usage_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${u.shift === "morning" ? "bg-amber-100/60" : "bg-indigo-100/60"}`}>
                                                    {u.shift === "morning" ? <Sun size={16} className="text-amber-600" /> : <Moon size={16} className="text-indigo-600" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <ShiftBadge shift={u.shift} t={t} />
                                                        <MilkTypeBadge type={u.milk_type} />
                                                    </div>
                                                    <p className="text-xs text-gray-500 mt-0.5 truncate">{u.purpose || t('dashboard.personalUse')}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="text-sm font-bold text-gray-800">{parseFloat(u.quantity).toFixed(1)} L</p>
                                                <p className="text-xs text-gray-400">{fmtTime(u.created_at)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CompactCard>
                    </div>
                </div>

                {/* Cash Advance */}
                <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.cashAdvance')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard label={t('dashboard.givenToday')} value={"₹" + fmt(advGiven)} sub={`${advances.filter((a) => a.type === "given").length} ${t('dashboard.transactions')}`} icon={<TrendingUp size={18} />} color="emerald" />
                        <StatCard label={t('dashboard.receivedToday')} value={"₹" + fmt(advReceived)} sub={`${advances.filter((a) => a.type === "received").length} ${t('dashboard.transactions')}`} icon={<TrendingDown size={18} />} color="red" />
                        <StatCard label={t('dashboard.netAdvance')} value={"₹" + fmt(Math.abs(advGiven - advReceived))} sub={advGiven >= advReceived ? t('dashboard.netGiven') : t('dashboard.netRecovered')} icon={<Wallet size={18} />} color={advGiven >= advReceived ? "amber" : "emerald"} />
                    </div>
                </div>

                {/* Seller-wise Summary */}
                {period !== 'day' && milkEntries.length > 0 && (() => {
                    const bySeller = milkEntries.reduce((acc, e) => {
                        const id = e.seller_id;
                        if (!acc[id]) acc[id] = {
                            name: e.seller_name || e.seller_code || `#${id}`,
                            code: e.seller_code,
                            qty: 0, amt: 0, entries: 0,
                            cowQty: 0, bufQty: 0,
                        };
                        acc[id].qty += parseFloat(e.quantity || 0);
                        acc[id].amt += parseFloat(e.total_amount || 0);
                        acc[id].entries += 1;
                        if (e.milk_type === 'cow') acc[id].cowQty += parseFloat(e.quantity || 0);
                        else acc[id].bufQty += parseFloat(e.quantity || 0);
                        return acc;
                    }, {});
                    const sellers = Object.values(bySeller).sort((a, b) => b.qty - a.qty);
                    return (
                        <CompactCard>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                                        <Users size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{t('dashboard.sellerSummary')}</p>
                                        <p className="text-xs text-gray-500">{sellers.length} {t('dashboard.sellers')} · {formatPeriodLabel(period, rangeFrom, rangeTo)}</p>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-400 font-mono">{milkEntries.length} {t('dashboard.entries')}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-max">
                                    <thead>
                                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200/60 rounded-xl">
                                            {[t('dashboard.th_no'), t('dashboard.th_seller'), t('dashboard.th_code'), t('dashboard.th_entries'), t('dashboard.th_cow'), t('dashboard.th_buffalo'), t('dashboard.th_totalQty'), t('dashboard.th_amount')].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sellers.slice(0, 10).map((s, i) => (
                                            <tr key={i} className={`border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white/30' : 'bg-gray-50/20'}`}>
                                                <td className="px-4 py-2.5 text-gray-400 font-mono">{i + 1}</td>
                                                <td className="px-4 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{s.name}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-500">{s.code || '—'}</td>
                                                <td className="px-4 py-2.5 text-blue-600 font-semibold">{s.entries}</td>
                                                <td className="px-4 py-2.5 text-amber-600 font-mono">{s.cowQty > 0 ? s.cowQty.toFixed(1) : '—'}</td>
                                                <td className="px-4 py-2.5 text-blue-500 font-mono">{s.bufQty > 0 ? s.bufQty.toFixed(1) : '—'}</td>
                                                <td className="px-4 py-2.5 font-bold text-gray-800">{s.qty.toFixed(1)} L</td>
                                                <td className="px-4 py-2.5 font-bold text-emerald-600">₹{fmt(s.amt)}</td>
                                            </tr>
                                        ))}
                                        {sellers.length > 10 && (
                                            <tr className="border-b border-gray-100/60 text-gray-400">
                                                <td colSpan={8} className="px-4 py-2.5 text-sm">+ {sellers.length - 10} more sellers</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CompactCard>
                    );
                })()}

                {/* Two-column layout for products and feeds */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Product Stock */}
                    <CompactCard>
                        <SectionHeader icon={<Package size={16} className="text-white" />} title={t('dashboard.productStock')} sub={`${products.length} ${t('dashboard.products')} · ${outOfStock.length} ${t('dashboard.outOfStock')}`} />
                        {load.products ? <Spinner /> : products.length === 0 ? (
                            <EmptyState icon={<Package size={36} />} text={t('dashboard.noProducts')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {products.slice(0, 6).map((p) => {
                                    const stock = parseFloat(p.current_stock || 0);
                                    const statusColor = stock <= 0 ? "bg-red-100/60 text-red-700 border-red-200/60" : stock < 5 ? "bg-amber-100/60 text-amber-700 border-amber-200/60" : "bg-emerald-100/60 text-emerald-700 border-emerald-200/60";
                                    return (
                                        <div key={p.product_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200/50 flex items-center justify-center shadow-sm">
                                                    <Package size={16} className="text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{p.product_name}</p>
                                                    <p className="text-xs text-gray-500">{p.unit}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-xl border text-sm font-bold backdrop-blur-sm ${statusColor}`}>
                                                {stock <= 0 ? t('dashboard.outOfStock') : stock.toFixed(1) + " " + p.unit}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CompactCard>

                    {/* Cattle Feed Stock */}
                    <CompactCard>
                        <SectionHeader icon={<Wheat size={16} className="text-white" />} title={t('dashboard.cattleFeedStock') || 'Cattle Feed Stock'} sub={`${cattleFeeds.length} ${t('dashboard.products')} · ${outOfStockFeeds.length} ${t('dashboard.outOfStock')}`} />
                        {load.cfeeds ? <Spinner /> : cattleFeeds.length === 0 ? (
                            <EmptyState icon={<Wheat size={36} />} text={t('dashboard.noProducts')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {cattleFeeds.slice(0, 6).map((f) => {
                                    const stock = parseFloat(f.current_stock || 0);
                                    const statusColor = stock <= 0 ? "bg-red-100/60 text-red-700 border-red-200/60" : stock < 5 ? "bg-amber-100/60 text-amber-700 border-amber-200/60" : "bg-emerald-100/60 text-emerald-700 border-emerald-200/60";
                                    return (
                                        <div key={f.feed_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200/50 flex items-center justify-center shadow-sm">
                                                    <Wheat size={16} className="text-amber-700" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-gray-800">{f.feed_name}</p>
                                                    <p className="text-xs text-gray-500">{f.unit}</p>
                                                </div>
                                            </div>
                                            <span className={`px-3 py-1.5 rounded-xl border text-sm font-bold backdrop-blur-sm ${statusColor}`}>
                                                {stock <= 0 ? t('dashboard.outOfStock') : stock.toFixed(1) + " " + f.unit}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CompactCard>
                </div>

                {/* Recent Milk Entries and Walk-in Sales - two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Recent Milk Entries */}
                    <CompactCard>
                        <SectionHeader icon={<Milk size={16} className="text-white" />} title={t('dashboard.recentMilk')} sub={`${milkEntries.length} ${t('dashboard.total')} ${t('dashboard.today')}`} action={<span className="text-xs text-gray-400 font-mono">{milkEntries.length > 5 && `+${milkEntries.length - 5} more`}</span>} />
                        {load.milk ? <Spinner /> : recentMilk.length === 0 ? (
                            <EmptyState icon={<Milk size={36} />} text={t('dashboard.noMilkEntries')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {recentMilk.map((e) => (
                                    <div key={e.entry_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-gray-800/20 shrink-0">
                                                {(e.seller_name || e.seller_code || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{e.seller_name || e.seller_code || `#${e.seller_id}`}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <ShiftBadge shift={e.shift} t={t} />
                                                    <MilkTypeBadge type={e.milk_type} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-gray-800">{parseFloat(e.quantity).toFixed(1)} L</p>
                                            <p className="text-xs text-gray-500">{t('bill.fat')} {parseFloat(e.fat).toFixed(1)} · {t('bill.snf')} {parseFloat(e.snf).toFixed(1)}</p>
                                            <p className="text-xs font-semibold text-emerald-600">₹{fmt(e.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CompactCard>

                    {/* Recent Walk-in Sales */}
                    <CompactCard>
                        <SectionHeader icon={<ShoppingCart size={16} className="text-white" />} title={t('dashboard.walkinSales')} sub={`${walkinSales.length} ${t('dashboard.today')} · ₹${fmt(walkinRevenue)}`} action={<span className="text-xs text-gray-400 font-mono">{walkinSales.length > 5 && `+${walkinSales.length - 5} more`}</span>} />
                        {load.walkin ? <Spinner /> : recentWalkin.length === 0 ? (
                            <EmptyState icon={<ShoppingCart size={36} />} text={t('dashboard.noWalkin')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {recentWalkin.map((s) => (
                                    <div key={s.sale_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-blue-400/20 shrink-0">
                                                {(s.buyer_name || t('dashboard.anonymous')).charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{s.buyer_name || t('dashboard.anonymous')}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <MilkTypeBadge type={s.milk_type} />
                                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium backdrop-blur-sm border ${s.payment_mode === "cash" ? "bg-emerald-100/60 text-emerald-700 border-emerald-200/60" : s.payment_mode === "upi" ? "bg-violet-100/60 text-violet-700 border-violet-200/60" : "bg-rose-100/60 text-rose-700 border-rose-200/60"}`}>
                                                        {s.payment_mode}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-gray-800">{parseFloat(s.quantity).toFixed(1)} L</p>
                                            <p className="text-xs text-gray-500">₹{fmt(s.rate)}/L</p>
                                            <p className="text-xs font-semibold text-emerald-600">₹{fmt(s.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CompactCard>
                </div>

                {/* Product Sales and Purchases - two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Product Sales */}
                    <CompactCard>
                        <SectionHeader icon={<ShoppingBag size={16} className="text-white" />} title={t('dashboard.productSales')} sub={`${productSales.length} ${t('dashboard.today')} · ₹${fmt(prodSaleRev)}`} />
                        {load.psales ? <Spinner /> : productSales.length === 0 ? (
                            <EmptyState icon={<ShoppingBag size={36} />} text={t('dashboard.noProductSales')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {productSales.slice(0, 5).map((s) => (
                                    <div key={s.sale_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-400 to-violet-500 flex items-center justify-center shadow-lg shadow-violet-400/20">
                                                <Package size={16} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{s.product_name || `#${s.product_id}`}</p>
                                                <p className="text-xs text-gray-500 truncate">{s.seller_name || "—"}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-gray-800">{parseFloat(s.quantity).toFixed(1)} {s.unit}</p>
                                            <p className="text-xs font-semibold text-violet-600">₹{fmt(s.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CompactCard>

                    {/* Product Purchases */}
                    <CompactCard>
                        <SectionHeader icon={<Layers size={16} className="text-white" />} title={t('dashboard.productPurchases')} sub={`${purchases.length} ${t('dashboard.today')} · ₹${fmt(purchaseSpend)} ${t('dashboard.spent')}`} />
                        {load.ppurch ? <Spinner /> : purchases.length === 0 ? (
                            <EmptyState icon={<Layers size={36} />} text={t('dashboard.noPurchases')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {purchases.slice(0, 5).map((p) => (
                                    <div key={p.purchase_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-400/20">
                                                <Package size={16} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{p.product_name || `#${p.product_id}`}</p>
                                                <p className="text-xs text-gray-500 truncate">{p.supplier_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-gray-800">{parseFloat(p.quantity).toFixed(1)} {p.unit}</p>
                                            <p className="text-xs font-semibold text-amber-600">₹{fmt(p.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CompactCard>
                </div>

                {/* Cattle Feed Sales and Purchases - two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Cattle Feed Sales */}
                    <CompactCard>
                        <SectionHeader icon={<Wheat size={16} className="text-white" />} title={t('dashboard.cattleFeedSales') || 'Cattle Feed Sales'} sub={`${cattleFeedSales.length} ${t('dashboard.today')} · ₹${fmt(cattleFeedSaleRev)}`} />
                        {load.cfsales ? <Spinner /> : cattleFeedSales.length === 0 ? (
                            <EmptyState icon={<Wheat size={36} />} text={t('dashboard.noProductSales')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {cattleFeedSales.slice(0, 5).map((s) => (
                                    <div key={s.sale_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-400/20">
                                                <Wheat size={16} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{s.feed_name || `#${s.feed_id}`}</p>
                                                <p className="text-xs text-gray-500 truncate">{s.seller_name || "—"}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-gray-800">{parseFloat(s.quantity).toFixed(1)} {s.unit}</p>
                                            <p className="text-xs font-semibold text-amber-600">₹{fmt(s.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CompactCard>

                    {/* Cattle Feed Purchases */}
                    <CompactCard>
                        <SectionHeader icon={<Wheat size={16} className="text-white" />} title={t('dashboard.cattleFeedPurchases') || 'Cattle Feed Purchases'} sub={`${cattleFeedPurchases.length} ${t('dashboard.today')} · ₹${fmt(cattleFeedPurchaseSpend)} ${t('dashboard.spent')}`} />
                        {load.cfpurch ? <Spinner /> : cattleFeedPurchases.length === 0 ? (
                            <EmptyState icon={<Wheat size={36} />} text={t('dashboard.noPurchases')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {cattleFeedPurchases.slice(0, 5).map((p) => (
                                    <div key={p.purchase_id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-400/20">
                                                <Wheat size={16} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-gray-800 truncate">{p.feed_name || `#${p.feed_id}`}</p>
                                                <p className="text-xs text-gray-500 truncate">{p.supplier_name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-sm font-bold text-gray-800">{parseFloat(p.quantity).toFixed(1)} {p.unit}</p>
                                            <p className="text-xs font-semibold text-orange-600">₹{fmt(p.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CompactCard>
                </div>

                {/* Bonus and Commission - two columns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Bonus */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.bonus') || 'Bonus'}</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <StatCard label={t('dashboard.utpadakBonusPaid') || 'Utpadak Bonus Paid'} value={"₹" + fmt(profits.utpadak_bonus_paid)} sub={`${bonusPayments.filter(b => b.is_paid).length} ${t('dashboard.transactions')}`} icon={<Gift size={16} />} color="amber" />
                            <StatCard label={t('dashboard.gavaliBonusPaid') || 'Gavali Bonus Paid'} value={"₹" + fmt(profits.gavali_bonus_paid)} sub={`${gavaliBonusPayments.filter(b => b.is_paid).length} ${t('dashboard.transactions')}`} icon={<Gift size={16} />} color="violet" />
                        </div>

                        <CompactCard>
                            <SectionHeader icon={<Gift size={16} className="text-white" />} title={t('dashboard.bonusPayments') || 'Bonus Payments'} sub={`${allBonusPayments.length} ${t('dashboard.transactions')}`} />
                            {load.bonus ? <Spinner /> : allBonusPayments.length === 0 ? (
                                <EmptyState icon={<Gift size={36} />} text={t('dashboard.noAdvances')} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {allBonusPayments.slice(0, 5).map((b) => (
                                        <div key={`${b.bonus_scheme}-${b.payment_id}`} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${b.is_paid ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-400/20" : "bg-gradient-to-br from-gray-400 to-gray-500 shadow-lg shadow-gray-400/20"}`}>
                                                    <Gift size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-800 truncate">{b.seller_name || `#${b.seller_id}`}</p>
                                                    <p className="text-xs text-gray-500 truncate">{b.event_name} · {b.bonus_scheme}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="text-sm font-bold text-emerald-600">₹{fmt(b.total_bonus)}</p>
                                                <p className="text-xs text-gray-500">{b.is_paid ? (t('dashboard.paid') || 'Paid') : (t('dashboard.pending') || 'Pending')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CompactCard>
                    </div>

                    {/* Commission */}
                    <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">{t('dashboard.commission') || 'Commission'}</p>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <StatCard label={t('dashboard.totalCommission') || 'Total Commission'} value={"₹" + fmt(profits.total_commission)} sub={t('dashboard.fromPaidBills') || 'From paid bills'} icon={<Percent size={16} />} color="indigo" />
                            <StatCard label={t('dashboard.commissionRules') || 'Commission Rules'} value={commissionSettings.filter(c => c.is_active).length} sub={t('dashboard.activeRules') || 'active rules'} icon={<Percent size={16} />} color="teal" />
                        </div>

                        <CompactCard>
                            <SectionHeader icon={<Percent size={16} className="text-white" />} title={t('dashboard.commissionSettings') || 'Commission Settings'} sub={`${commissionSettings.length} ${t('dashboard.rules') || 'rules'}`} />
                            {load.commission ? <Spinner /> : commissionSettings.length === 0 ? (
                                <EmptyState icon={<Percent size={36} />} text={t('dashboard.noRules') || 'No commission rules configured'} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {commissionSettings.slice(0, 5).map((c) => (
                                        <div key={c.id} className="flex items-center justify-between py-3 hover:bg-gray-50/50 rounded-lg transition-colors px-1">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-400/20">
                                                    <Percent size={16} className="text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <MilkTypeBadge type={c.milk_type} />
                                                    <p className="text-xs text-gray-500 mt-0.5">Base FAT {parseFloat(c.base_fat).toFixed(2)} · Base SNF {parseFloat(c.base_snf).toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="text-sm font-bold text-gray-800">₹{parseFloat(c.base_commission).toFixed(2)}</p>
                                                <p className="text-xs text-gray-500">{c.is_active ? (t('dashboard.active') || 'Active') : t('status.inactive')}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CompactCard>
                    </div>
                </div>

                {/* Advance Transactions - full width */}
                <CompactCard>
                    <SectionHeader icon={<Wallet size={16} className="text-white" />} title={t('dashboard.cashAdvance')} sub={`${advances.length} ${t('dashboard.transactions')}`} />
                    {load.advance ? <Spinner /> : advances.length === 0 ? (
                        <EmptyState icon={<Wallet size={36} />} text={t('dashboard.noAdvances')} />
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {advances.slice(0, 8).map((a) => (
                                <div key={a.id} className="flex items-center justify-between py-3 px-4 rounded-xl border border-gray-100/60 bg-white/30 backdrop-blur-sm hover:bg-gray-50/50 transition-all duration-200 hover:shadow-md">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${a.type === "given" ? "bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-400/20" : "bg-gradient-to-br from-red-400 to-red-500 shadow-lg shadow-red-400/20"}`}>
                                            {a.type === "given" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{a.seller_name || `#${a.seller_id}`}</p>
                                            <p className="text-xs text-gray-500 truncate">{a.remarks || (a.type === "given" ? t('dashboard.advanceGiven') : t('dashboard.installmentReceived'))}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                        <p className={`text-sm font-bold ${a.type === "given" ? "text-emerald-600" : "text-red-500"}`}>
                                            {a.type === "given" ? "+" : "−"}₹{fmt(a.amount)}
                                        </p>
                                        <p className="text-xs text-gray-400">{fmtTime(a.created_at)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CompactCard>

                {/* Footer */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-700">{period}</strong> {t('dashboard.footerData')}: {new Date(rangeFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(rangeTo).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span>· <strong className="text-amber-500">{t('dashboard.lowStock')}</strong> = {t('dashboard.footerLowStock')} · <strong className="text-red-500">{t('dashboard.outOfStock')}</strong> = {t('dashboard.footerOut')}</span>
                    <span>· {t('dashboard.footerDispatch')}</span>
                    <span>· {t('dashboard.footerOwner')}</span>
                    <span>· {t('dashboard.footerParallel')}</span>
                </div>
            </main>
        </div>
    );
}