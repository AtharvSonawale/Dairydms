import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTranslation } from "react-i18next";
import api from "../../api/axios";
import {
    Milk, ShoppingCart, ShoppingBag, Wallet, TrendingUp,
    TrendingDown, Users, Package, RefreshCw, Sun, Moon,
    AlertTriangle, Banknote, Layers, Truck,
    FlaskConical, ArrowUpRight, ArrowDownRight, Home,
    Settings, Calendar,
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
function StatCard({ label, value, sub, icon, color }) {
    const colors = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        red: "text-red-500 bg-red-50 border-red-100",
        slate: "text-slate-600 bg-slate-50 border-slate-200",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        teal: "text-teal-600 bg-teal-50 border-teal-100",
    };
    return (
        <div className={`flex flex-col gap-2 px-4 py-4 rounded-2xl border ${colors[color]} relative overflow-hidden`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
    );
}

function SectionHeader({ icon, title, sub, action }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
                    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function ShiftBadge({ shift, t }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
            ${shift === "morning"
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
            {shift === "morning" ? <Sun size={8} /> : <Moon size={8} />}
            {shift === "morning" ? t('bill.morning') : t('bill.evening')}
        </span>
    );
}

function MilkTypeBadge({ type }) {
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
            ${type === "cow"
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
            {type}
        </span>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
            {icon}
            <p className="text-xs">{text}</p>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );
}

// ── Main Admin Dashboard ──────────────────────────────────────
export default function AdminDashboard() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return { text: t('dashboard.greetMorning'), icon: <Sun size={16} className="text-amber-500" /> };
        if (h < 17) return { text: t('dashboard.greetAfternoon'), icon: <Sun size={16} className="text-orange-400" /> };
        return { text: t('dashboard.greetEvening'), icon: <Moon size={16} className="text-indigo-400" /> };
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

    const [profits, setProfits] = useState({
        total_profit: 0,
        product_sales_profit: 0,
        walkin_profit: 0,
        dispatch_profit: 0,
        owner_usage_cost: 0,
    });

    const [load, setLoad] = useState({
        milk: true, walkin: true, psales: true, ppurch: true,
        advance: true, products: true, dispatch: true,
        ownerUsage: true, operators: true,
    });

    useEffect(() => {
        if (user && user.role === "admin" && user.has_seen_tour === 0) {
            const driverObj = driver({
                showProgress: true,
                allowClose: true,
                onDestroyed: () => {
                    api.put("/admin/mark-tour-seen").catch(() => { });
                },
                steps: [
                    {
                        element: '[data-tour="dashboard-title"]',
                        popover: { title: "Welcome!", description: "This is your admin dashboard — your home base for everything." },
                    },
                    {
                        element: '[data-tour="period-toggle"]',
                        popover: { title: "Time Period", description: "Switch between day, week, month, or year views." },
                    },
                    {
                        element: '[data-tour="revenue-overview"]',
                        popover: { title: "Revenue Overview", description: "Your total profit, sales, and spend at a glance." },
                    },
                    {
                        element: '[data-tour="milk-collection"]',
                        popover: { title: "Milk Collection", description: "Track total milk collected, payable amount, and fat/SNF averages." },
                    },
                ],
            });
            driverObj.drive();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    

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
                ownerUsage: false, operators: false
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

    const recentMilk = [...milkEntries].slice(0, 5);
    const recentWalkin = [...walkinSales].slice(0, 5);

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            {greeting.icon}
                            <span>{greeting.text},</span>
                            <span className="font-semibold text-gray-800">{user?.name || t('status.admin')}</span>
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-violet-50 border border-violet-100 text-violet-600 text-[10px] font-semibold ml-1">
                                <Settings size={10} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight" data-tour="dashboard-title">{t('dashboard.title')}</h1>                        <p className="text-xs text-gray-400 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold flex-shrink-0 w-40" data-tour="period-toggle">
                            {['day', 'week', 'month', 'year'].map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPeriod(p)}
                                    className={`flex-1 py-1.5 transition ${period === p ? "bg-gray-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                                >
                                    {t(`dashboard.${p}`)}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:inline">
                                {t('dashboard.referenceDate')}
                            </span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition w-36"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100 text-gray-600 text-xs font-medium flex-shrink-0 w-56">
                            <Calendar size={12} className="flex-shrink-0" />
                            <span className="truncate">{formatPeriodLabel(period, rangeFrom, rangeTo)}</span>
                        </div>
                    </div>
                </div>

                {/* Period Info Banner */}
                <div className="flex items-center justify-center px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-500">
                    <Calendar size={12} className="mr-2" />
                    {t('dashboard.showingData')} <strong className="text-gray-700 mx-1">{new Date(rangeFrom).toLocaleDateString('en-IN')}</strong> {t('dashboard.to')} <strong className="text-gray-700 mx-1">{new Date(rangeTo).toLocaleDateString('en-IN')}</strong>
                </div>

                {/* Shift Priority Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-amber-100 bg-amber-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-sm shadow-amber-200">
                                <Sun size={18} className="text-amber-900" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">{t('dashboard.morningShift')}</p>
                                <p className="text-2xl font-bold text-amber-800 leading-tight">
                                    {morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                    <span className="text-sm font-medium text-amber-500 ml-1">L</span>
                                </p>
                                <p className="text-[10px] text-amber-500 mt-0.5">{morningEntries.length} {t('dashboard.entries')}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-amber-400 uppercase tracking-wider">{t('bill.amount')}</p>
                            <p className="text-base font-bold text-amber-700">
                                ₹{fmt(morningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-indigo-100 bg-indigo-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-200">
                                <Moon size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">{t('dashboard.eveningShift')}</p>
                                <p className="text-2xl font-bold text-indigo-800 leading-tight">
                                    {eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                    <span className="text-sm font-medium text-indigo-400 ml-1">L</span>
                                </p>
                                <p className="text-[10px] text-indigo-400 mt-0.5">{eveningEntries.length} {t('dashboard.entries')}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-indigo-400 uppercase tracking-wider">{t('bill.amount')}</p>
                            <p className="text-base font-bold text-indigo-700">
                                ₹{fmt(eveningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Period Summary Pills */}
                <div className="flex flex-wrap gap-2">
                    {[
                        { label: t('dashboard.milkEntries'), value: milkEntries.length, color: "bg-amber-50 text-amber-700 border-amber-200" },
                        { label: t('dashboard.sellersActive'), value: [...new Set(milkEntries.map(e => e.seller_id))].length, color: "bg-blue-50 text-blue-700 border-blue-200" },
                        { label: t('dashboard.walkinCount'), value: walkinSales.length, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                        { label: t('dashboard.productSalesCount'), value: productSales.length, color: "bg-violet-50 text-violet-700 border-violet-200" },
                        { label: t('dashboard.dispatchCount'), value: dispatches.length, color: "bg-slate-50 text-slate-700 border-slate-200" },
                        { label: t('dashboard.advanceCount'), value: advances.length, color: "bg-rose-50 text-rose-700 border-rose-200" },
                    ].map(({ label, value, color }) => (
                        <div key={label} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${color}`}>
                            <span className="opacity-60">{label}</span>
                            <span className="font-bold">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Flash message */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        <AlertTriangle size={15} />
                        {flash.msg}
                    </div>
                )}

                {/* Stock alerts */}
                {(outOfStock.length > 0 || lowStockItems.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                        {outOfStock.map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                <AlertTriangle size={12} /> {p.product_name} — {t('dashboard.outOfStockLabel')}
                            </div>
                        ))}
                        {lowStockItems.filter((p) => parseFloat(p.current_stock) > 0).map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                                <AlertTriangle size={12} /> {p.product_name} — {t('dashboard.lowStockLabel')} ({parseFloat(p.current_stock).toFixed(1)} {p.unit})
                            </div>
                        ))}
                    </div>
                )}

                {/* Revenue Overview */}
                <div data-tour="revenue-overview">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('dashboard.revenueOverview')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label={t('dashboard.totalProfit')} value={"₹" + fmt(profits.total_profit)} icon={<Banknote size={15} />} color="emerald" />
                        <StatCard label={t('dashboard.dairySale')} value={"₹" + fmt(dairySaleRev)} sub={`${dispatches.length} ${t('dashboard.dispatches')}`} icon={<Truck size={15} />} color="amber" />
                        <StatCard label={t('dashboard.walkinSales')} value={"₹" + fmt(walkinRevenue)} sub={`${walkinSales.length} ${t('dashboard.transactions')}`} icon={<ShoppingCart size={15} />} color="blue" />
                        <StatCard label={t('dashboard.productSales')} value={"₹" + fmt(prodSaleRev)} sub={`${productSales.length} ${t('dashboard.itemsSold')}`} icon={<ShoppingBag size={15} />} color="violet" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        <StatCard label={t('dashboard.purchaseSpend')} value={"₹" + fmt(purchaseSpend)} sub={`${purchases.length} ${t('dashboard.purchases')}`} icon={<TrendingDown size={15} />} color="red" />
                    </div>
                </div>

                {/* Milk Collection */}
                <div data-tour="milk-collection">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('dashboard.milkCollection')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-amber-100 bg-amber-50 col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{t('dashboard.totalCollection')}</p>
                                <Milk size={15} className="opacity-70" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{totalMilkQty.toFixed(1)} L</p>
                            <div className="text-[10px] text-gray-500">
                                <p>{t('dashboard.opening')}: {openingMilk.cow.toFixed(1)}L cow + {openingMilk.buffalo.toFixed(1)}L buffalo</p>
                            </div>
                            <p className="text-[11px] text-gray-400">{milkEntries.length} {t('dashboard.entries')}</p>
                        </div>

                        <StatCard label={t('dashboard.milkPayable')} value={"₹" + fmt(totalMilkAmt)} sub={t('dashboard.dueAllSellers')} icon={<Banknote size={15} />} color="emerald" />

                        <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-indigo-100 bg-indigo-50 col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{t('dashboard.avgFatSnf')}</p>
                                <FlaskConical size={15} className="opacity-70" />
                            </div>
                            <p className="text-lg font-bold text-gray-900">{avgFat.toFixed(2)} / {avgSnf.toFixed(2)}</p>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] text-amber-600 font-mono">Cow: {avgFatCow.toFixed(2)} FAT · {avgSnfCow.toFixed(2)} SNF</p>
                                <p className="text-[10px] text-blue-600 font-mono">Buffalo: {avgFatBuf.toFixed(2)} FAT · {avgSnfBuf.toFixed(2)} SNF</p>
                            </div>
                        </div>

                        <StatCard label={t('dashboard.activeSellers')} value={[...new Set(milkEntries.map((e) => e.seller_id))].length} sub={`${morningEntries.length}M · ${eveningEntries.length}E ${t('dashboard.morningEntries')}`} icon={<Users size={15} />} color="slate" />
                    </div>

                    {/* Breakdown row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {[
                            { label: t('bill.morning'), qty: morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: morningEntries.length, icon: <Sun size={13} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                            { label: t('bill.evening'), qty: eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: eveningEntries.length, icon: <Moon size={13} />, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                            { label: t('dashboard.cow'), qty: cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: cowEntries.length, icon: null, color: "text-amber-700 bg-amber-50 border-amber-100" },
                            { label: t('dashboard.buffalo'), qty: bufEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: bufEntries.length, icon: null, color: "text-blue-700 bg-blue-50 border-blue-100" },
                        ].map(({ label, qty, count, icon, color }) => (
                            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                                {icon && <div className="shrink-0">{icon}</div>}
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                    <p className="text-base font-bold text-gray-900">{qty.toFixed(1)} L</p>
                                    <p className="text-[10px] text-gray-400">{count} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Walk-in Sales Breakdown */}
                {(cowWalkinQty > 0 || bufWalkinQty > 0) && (
                    <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-blue-100 bg-blue-50">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 opacity-70">{t('dashboard.walkinBreakdown')}</p>
                            <ShoppingCart size={15} className="text-blue-500 opacity-70" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div
                                className={`px-3 py-2.5 rounded-xl border cursor-pointer transition ${cowWalkin ? "bg-amber-400 border-amber-400" : "bg-white border-amber-200"}`}
                                onClick={() => setCowWalkin(true)}
                            >
                                <p className="text-[10px] font-semibold text-amber-800">{t('dashboard.cowWalkin')}</p>
                                <p className="text-lg font-bold text-gray-900">{cowWalkinQty.toFixed(1)} L</p>
                                <p className="text-[10px] text-amber-700 font-semibold">₹{fmt(cowWalkinRev)}</p>
                                <p className="text-[10px] text-amber-600">{cowWalkinSales.length} {t('dashboard.sales')}</p>
                            </div>
                            <div
                                className={`px-3 py-2.5 rounded-xl border cursor-pointer transition ${!cowWalkin ? "bg-blue-500 border-blue-500" : "bg-white border-blue-200"}`}
                                onClick={() => setCowWalkin(false)}
                            >
                                <p className={`text-[10px] font-semibold ${!cowWalkin ? "text-white" : "text-blue-800"}`}>{t('dashboard.bufWalkin')}</p>
                                <p className={`text-lg font-bold ${!cowWalkin ? "text-white" : "text-gray-900"}`}>{bufWalkinQty.toFixed(1)} L</p>
                                <p className={`text-[10px] font-semibold ${!cowWalkin ? "text-blue-100" : "text-blue-700"}`}>₹{fmt(bufWalkinRev)}</p>
                                <p className={`text-[10px] ${!cowWalkin ? "text-blue-200" : "text-blue-500"}`}>{bufWalkinSales.length} {t('dashboard.sales')}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tank Dispatch */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('dashboard.tankDispatch')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <StatCard label={t('dashboard.dispatchesToday')} value={dispatches.length} sub={t('dashboard.trips')} icon={<Truck size={15} />} color="blue" />
                        <StatCard label={t('dashboard.totalDispatched')} value={totalDispatched.toFixed(1) + " L"} sub={t('dashboard.milkSentFactory')} icon={<Milk size={15} />} color="amber" />
                        <StatCard label={t('dashboard.factoryRevenue')} value={"₹" + fmt(totalFactoryRev)} sub={t('dashboard.fromFactory')} icon={<Banknote size={15} />} color="emerald" />
                        <StatCard label={t('dashboard.avgFactoryRate')} value={"₹" + avgFactoryRate.toFixed(2) + "/L"} sub={dispatches.length ? `${dispatches.length} ${t('dashboard.dispatches')}` : t('dashboard.noDispatch')} icon={<TrendingUp size={15} />} color="violet" />
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader icon={<Truck size={13} className="text-white" />} title={t('dashboard.dispatchRecords')} sub={`${dispatches.length} ${t('dashboard.today')} · ₹${fmt(totalFactoryRev)} ${t('dashboard.factoryRevenue')}`} />
                        {load.dispatch ? <Spinner /> : dispatches.length === 0 ? (
                            <EmptyState icon={<Truck size={28} />} text={t('dashboard.noDispatches')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {dispatches.map((d) => (
                                    <div key={d.dispatch_id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
                                                <Truck size={12} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{d.factory_name || "—"}</p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    {d.vehicle_no && (
                                                        <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                                                            {d.vehicle_no}
                                                        </span>
                                                    )}
                                                    {d.driver_name && (
                                                        <span className="text-[10px] text-gray-400 truncate">{d.driver_name}</span>
                                                    )}
                                                    {d.avg_fat && (
                                                        <span className="text-[10px] text-amber-600 font-mono">
                                                            FAT {parseFloat(d.avg_fat).toFixed(2)}%
                                                        </span>
                                                    )}
                                                    {d.avg_snf && (
                                                        <span className="text-[10px] text-violet-600 font-mono">
                                                            SNF {parseFloat(d.avg_snf).toFixed(2)}%
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-xs font-bold text-gray-800">{parseFloat(d.total_liters).toFixed(1)} L</p>
                                            <p className="text-[10px] text-gray-400">₹{fmt(d.factory_rate)}/L</p>
                                            <p className="text-[10px] text-emerald-600 font-semibold">₹{fmt(d.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Owner Usage */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('dashboard.ownerUsage')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <StatCard label={t('dashboard.totalUsed')} value={totalUsageQty.toFixed(1) + " L"} sub={t('dashboard.personalConsumption')} icon={<Home size={15} />} color="teal" />
                        <StatCard label={t('dashboard.morningUsage')} value={morningUsageQ.toFixed(1) + " L"} sub={`${morningUsage.length} ${t('dashboard.entries')}`} icon={<Sun size={15} />} color="amber" />
                        <StatCard label={t('dashboard.eveningUsage')} value={eveningUsageQ.toFixed(1) + " L"} sub={`${eveningUsage.length} ${t('dashboard.entries')}`} icon={<Moon size={15} />} color="indigo" />
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader icon={<Home size={13} className="text-white" />} title={t('dashboard.usageRecords')} sub={`${ownerUsage.length} ${t('dashboard.entries')} ${t('dashboard.today')} · ${totalUsageQty.toFixed(1)} L ${t('dashboard.totalUsed')}`} />
                        {load.ownerUsage ? <Spinner /> : ownerUsage.length === 0 ? (
                            <EmptyState icon={<Home size={28} />} text={t('dashboard.noUsage')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {ownerUsage.map((u) => (
                                    <div key={u.usage_id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${u.shift === "morning" ? "bg-amber-50" : "bg-indigo-50"}`}>
                                                {u.shift === "morning" ? <Sun size={13} className="text-amber-600" /> : <Moon size={13} className="text-indigo-600" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <ShiftBadge shift={u.shift} t={t} />
                                                    <MilkTypeBadge type={u.milk_type} />
                                                </div>
                                                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{u.purpose || t('dashboard.personalUse')}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-xs font-bold text-gray-800">{parseFloat(u.quantity).toFixed(1)} L</p>
                                            <p className="text-[10px] text-gray-400">{fmtTime(u.created_at)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Cash Advance */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('dashboard.cashAdvance')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <StatCard label={t('dashboard.givenToday')} value={"₹" + fmt(advGiven)} sub={`${advances.filter((a) => a.type === "given").length} ${t('dashboard.transactions')}`} icon={<TrendingUp size={15} />} color="emerald" />
                        <StatCard label={t('dashboard.receivedToday')} value={"₹" + fmt(advReceived)} sub={`${advances.filter((a) => a.type === "received").length} ${t('dashboard.transactions')}`} icon={<TrendingDown size={15} />} color="red" />
                        <StatCard label={t('dashboard.netAdvance')} value={"₹" + fmt(Math.abs(advGiven - advReceived))} sub={advGiven >= advReceived ? t('dashboard.netGiven') : t('dashboard.netRecovered')} icon={<Wallet size={15} />} color={advGiven >= advReceived ? "amber" : "emerald"} />
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
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-gray-900 flex items-center justify-center">
                                        <Users size={13} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{t('dashboard.sellerSummary')}</p>
                                        <p className="text-[10px] text-gray-400">{sellers.length} {t('dashboard.sellers')} · {formatPeriodLabel(period, rangeFrom, rangeTo)}</p>
                                    </div>
                                </div>
                                <span className="text-[10px] text-gray-400 font-mono">{milkEntries.length} {t('dashboard.entries')}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs min-w-max">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-100">
                                            {[t('dashboard.th_no'), t('dashboard.th_seller'), t('dashboard.th_code'), t('dashboard.th_entries'), t('dashboard.th_cow'), t('dashboard.th_buffalo'), t('dashboard.th_totalQty'), t('dashboard.th_amount')].map(h => (
                                                <th key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-left whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sellers.map((s, i) => (
                                            <tr key={i} className={`border-b border-gray-50 hover:bg-blue-50/20 transition ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                                                <td className="px-3 py-2 text-gray-400 font-mono">{i + 1}</td>
                                                <td className="px-3 py-2 font-semibold text-gray-800 whitespace-nowrap">{s.name}</td>
                                                <td className="px-3 py-2 font-mono text-gray-500">{s.code || '—'}</td>
                                                <td className="px-3 py-2 text-blue-600 font-semibold">{s.entries}</td>
                                                <td className="px-3 py-2 text-amber-600 font-mono">{s.cowQty > 0 ? s.cowQty.toFixed(1) : '—'}</td>
                                                <td className="px-3 py-2 text-blue-500 font-mono">{s.bufQty > 0 ? s.bufQty.toFixed(1) : '—'}</td>
                                                <td className="px-3 py-2 font-bold text-gray-800">{s.qty.toFixed(1)} L</td>
                                                <td className="px-3 py-2 font-bold text-emerald-600">₹{fmt(s.amt)}</td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                                            <td colSpan={3} className="px-3 py-2 text-xs text-gray-600">{t('dashboard.total')} ({sellers.length} {t('dashboard.sellers')})</td>
                                            <td className="px-3 py-2 text-blue-600">{milkEntries.length}</td>
                                            <td className="px-3 py-2 text-amber-600 font-mono">{cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}</td>
                                            <td className="px-3 py-2 text-blue-500 font-mono">{bufEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}</td>
                                            <td className="px-3 py-2 text-gray-800">{totalMilkQty.toFixed(1)} L</td>
                                            <td className="px-3 py-2 text-emerald-600">₹{fmt(totalMilkAmt)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* Product Stock */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader icon={<Package size={13} className="text-white" />} title={t('dashboard.productStock')} sub={`${products.length} ${t('dashboard.products')} · ${outOfStock.length} ${t('dashboard.outOfStock')}`} />
                    {load.products ? <Spinner /> : products.length === 0 ? (
                        <EmptyState icon={<Package size={28} />} text={t('dashboard.noProducts')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {products.map((p) => {
                                const stock = parseFloat(p.current_stock || 0);
                                const statusColor = stock <= 0 ? "text-red-500 bg-red-50 border-red-100" : stock < 5 ? "text-amber-600 bg-amber-50 border-amber-100" : "text-emerald-600 bg-emerald-50 border-emerald-100";
                                return (
                                    <div key={p.product_id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                <Package size={12} className="text-gray-500" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-800">{p.product_name}</p>
                                                <p className="text-[10px] text-gray-400">{p.unit}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${statusColor}`}>
                                            {stock <= 0 ? t('dashboard.outOfStock') : stock.toFixed(1) + " " + p.unit}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent Milk Entries */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader icon={<Milk size={13} className="text-white" />} title={t('dashboard.recentMilk')} sub={`${milkEntries.length} ${t('dashboard.total')} ${t('dashboard.today')}`} action={<span className="text-[10px] text-gray-400 font-mono">{milkEntries.length > 5 && `+${milkEntries.length - 5} more`}</span>} />
                    {load.milk ? <Spinner /> : recentMilk.length === 0 ? (
                        <EmptyState icon={<Milk size={28} />} text={t('dashboard.noMilkEntries')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {recentMilk.map((e) => (
                                <div key={e.entry_id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                            {(e.seller_name || e.seller_code || "?").charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{e.seller_name || e.seller_code || `#${e.seller_id}`}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <ShiftBadge shift={e.shift} t={t} />
                                                <MilkTypeBadge type={e.milk_type} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-xs font-bold text-gray-800">{parseFloat(e.quantity).toFixed(1)} L</p>
                                        <p className="text-[10px] text-gray-400">{t('bill.fat')} {parseFloat(e.fat).toFixed(1)} · {t('bill.snf')} {parseFloat(e.snf).toFixed(1)}</p>
                                        <p className="text-[10px] text-emerald-600 font-semibold">₹{fmt(e.total_amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Walk-in Sales */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader icon={<ShoppingCart size={13} className="text-white" />} title={t('dashboard.walkinSales')} sub={`${walkinSales.length} ${t('dashboard.today')} · ₹${fmt(walkinRevenue)}`} action={<span className="text-[10px] text-gray-400 font-mono">{walkinSales.length > 5 && `+${walkinSales.length - 5} more`}</span>} />
                    {load.walkin ? <Spinner /> : recentWalkin.length === 0 ? (
                        <EmptyState icon={<ShoppingCart size={28} />} text={t('dashboard.noWalkin')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {recentWalkin.map((s) => (
                                <div key={s.sale_id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                                            {(s.buyer_name || t('dashboard.anonymous')).charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{s.buyer_name || t('dashboard.anonymous')}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <MilkTypeBadge type={s.milk_type} />
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.payment_mode === "cash" ? "bg-emerald-50 text-emerald-700" : s.payment_mode === "upi" ? "bg-violet-50 text-violet-700" : "bg-rose-50 text-rose-700"}`}>
                                                    {s.payment_mode}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-xs font-bold text-gray-800">{parseFloat(s.quantity).toFixed(1)} L</p>
                                        <p className="text-[10px] text-gray-400">₹{fmt(s.rate)}/L</p>
                                        <p className="text-[10px] text-emerald-600 font-semibold">₹{fmt(s.total_amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Sales */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader icon={<ShoppingBag size={13} className="text-white" />} title={t('dashboard.productSales')} sub={`${productSales.length} ${t('dashboard.today')} · ₹${fmt(prodSaleRev)}`} />
                    {load.psales ? <Spinner /> : productSales.length === 0 ? (
                        <EmptyState icon={<ShoppingBag size={28} />} text={t('dashboard.noProductSales')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {productSales.slice(0, 5).map((s) => (
                                <div key={s.sale_id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                            <Package size={12} className="text-violet-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{s.product_name || `#${s.product_id}`}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{s.seller_name || "—"}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-xs font-bold text-gray-800">{parseFloat(s.quantity).toFixed(1)} {s.unit}</p>
                                        <p className="text-[10px] text-violet-600 font-semibold">₹{fmt(s.total_amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Product Purchases */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader icon={<Layers size={13} className="text-white" />} title={t('dashboard.productPurchases')} sub={`${purchases.length} ${t('dashboard.today')} · ₹${fmt(purchaseSpend)} ${t('dashboard.spent')}`} />
                    {load.ppurch ? <Spinner /> : purchases.length === 0 ? (
                        <EmptyState icon={<Layers size={28} />} text={t('dashboard.noPurchases')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {purchases.slice(0, 5).map((p) => (
                                <div key={p.purchase_id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                            <Package size={12} className="text-amber-600" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{p.product_name || `#${p.product_id}`}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{p.supplier_name}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-xs font-bold text-gray-800">{parseFloat(p.quantity).toFixed(1)} {p.unit}</p>
                                        <p className="text-[10px] text-amber-600 font-semibold">₹{fmt(p.total_amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Advance Transactions */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader icon={<Wallet size={13} className="text-white" />} title={t('dashboard.cashAdvance')} sub={`${advances.length} ${t('dashboard.transactions')}`} />
                    {load.advance ? <Spinner /> : advances.length === 0 ? (
                        <EmptyState icon={<Wallet size={28} />} text={t('dashboard.noAdvances')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {advances.slice(0, 8).map((a) => (
                                <div key={a.id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${a.type === "given" ? "bg-emerald-500" : "bg-red-500"}`}>
                                            {a.type === "given" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{a.seller_name || `#${a.seller_id}`}</p>
                                            <p className="text-[10px] text-gray-400 truncate">{a.remarks || (a.type === "given" ? t('dashboard.advanceGiven') : t('dashboard.installmentReceived'))}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className={`text-xs font-bold ${a.type === "given" ? "text-emerald-600" : "text-red-500"}`}>
                                            {a.type === "given" ? "+" : "−"}₹{fmt(a.amount)}
                                        </p>
                                        <p className="text-[10px] text-gray-400">{fmtTime(a.created_at)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-4">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-600">{period}</strong> {t('dashboard.footerData')}: {new Date(rangeFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(rangeTo).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span>· <strong className="text-amber-500">{t('dashboard.lowStock')}</strong> = {t('dashboard.footerLowStock')} · <strong className="text-red-500">{t('dashboard.outOfStock')}</strong> = {t('dashboard.footerOut')}</span>
                    <span>· {t('dashboard.footerDispatch')}</span>
                    <span>· {t('dashboard.footerOwner')}</span>
                    <span>· {t('dashboard.footerParallel')}</span>
                </div>
            </main>
        </div>
    );
}