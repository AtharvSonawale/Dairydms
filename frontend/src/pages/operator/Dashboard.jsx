import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import {
    Milk, ShoppingCart, ShoppingBag, Wallet, TrendingUp,
    TrendingDown, Users, Package, RefreshCw, Sun, Moon,
    AlertTriangle, ChevronRight, Droplets, BarChart3,
    ArrowUpRight, ArrowDownRight, Clock, Activity,
    FlaskConical, Banknote, Layers, Truck, Warehouse,
    Home, BadgeCheck, X
} from "lucide-react";
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
const fmtInt = (v) => parseInt(v || 0).toLocaleString("en-IN");
const fmtTime = (d) =>
    d
        ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "—";
const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return { text: "Good morning", icon: <Sun size={16} className="text-amber-500" /> };
    if (h < 17) return { text: "Good afternoon", icon: <Sun size={16} className="text-orange-400" /> };
    return { text: "Good evening", icon: <Moon size={16} className="text-indigo-400" /> };
};

// ── sub-components ────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, trend, trendVal }) {
    const colorMap = {
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        red: "from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700",
        slate: "from-slate-50 to-slate-100/50 border-slate-200/60 text-slate-700",
        indigo: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700",
        rose: "from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700",
        gray: "from-gray-50 to-gray-100/50 border-gray-200/60 text-gray-700",
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color] || colorMap.gray} shadow-sm p-4 flex flex-col gap-1.5`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="flex items-center justify-between relative z-10">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight relative z-10">{value}</p>
            <div className="flex items-center justify-between relative z-10">
                {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
                {trend && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend === "up" ? "text-emerald-600" : "text-rose-500"}`}>
                        {trend === "up" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {trendVal}
                    </span>
                )}
            </div>
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

function ShiftBadge({ shift }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm
            ${shift === "morning"
                ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                : "bg-indigo-50/80 text-indigo-600 border-indigo-200/60"}`}>
            {shift === "morning" ? <Sun size={10} /> : <Moon size={10} />}
            {shift === "morning" ? "Morning" : "Evening"}
        </span>
    );
}

function MilkTypeBadge({ type }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm
            ${type === "cow"
                ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                : "bg-slate-100/80 text-slate-700 border-slate-200/60"}`}>
            {type === "cow" ? "Cow" : "Buffalo"}
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

function FlashMessage({ flash, setFlash }) {
    if (!flash) return null;
    return (
        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold backdrop-blur-sm shadow-sm
            ${flash.type === "success"
                ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
            {flash.type === "error" ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
            {flash.msg}
            <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                <X size={16} />
            </button>
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function OperatorDashboard() {
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission();

    // Permission checks
    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );
    if (!can('operator_dashboard', 'R')) return <AccessDenied />;

    const greeting = greet();
    const [selectedDate, setSelectedDate] = useState(today());
    const [refreshing, setRefreshing] = useState(false);
    const [flash, setFlash] = useState(null);

    // ── data state ──
    const [milkEntries, setMilkEntries] = useState([]);
    const [walkinSales, setWalkinSales] = useState([]);
    const [productSales, setProductSales] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [products, setProducts] = useState([]);
    const [dispatches, setDispatches] = useState([]);
    const [openingMilk, setOpeningMilk] = useState({ cow: 0, buffalo: 0 });
    const [cowWalkin, setCowWalkin] = useState(true);
    const [cowCollection, setCowCollection] = useState(true);
    // ── loading state per section ──
    const [load, setLoad] = useState({
        milk: true, walkin: true, psales: true,
        ppurch: true, advance: true, products: true, dispatch: true,
    });

    const setL = (key, val) => setLoad((p) => ({ ...p, [key]: val }));

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3000);
    };

    // ── fetchers ──
    const fetchAll = useCallback(async (date) => {
        setRefreshing(true);
        try {
            await Promise.allSettled([
                api.get(`/milk-entries?date=${date}`)
                    .then(({ data }) => setMilkEntries(data))
                    .catch(() => setMilkEntries([]))
                    .finally(() => setL("milk", false)),

                api.get(`/walkin-sales?date=${date}`)
                    .then(({ data }) => setWalkinSales(data))
                    .catch(() => setWalkinSales([]))
                    .finally(() => setL("walkin", false)),

                api.get(`/product-sales?date=${date}`)
                    .then(({ data }) => setProductSales(data))
                    .catch(() => setProductSales([]))
                    .finally(() => setL("psales", false)),

                api.get(`/products/purchases?date=${date}`)
                    .then(({ data }) => setPurchases(Array.isArray(data) ? data : []))
                    .catch(() => setPurchases([]))
                    .finally(() => setL("ppurch", false)),

                api.get(`/cash-advance?date=${date}`)
                    .then(({ data }) => setAdvances(data))
                    .catch(() => setAdvances([]))
                    .finally(() => setL("advance", false)),

                api.get(`/products`)
                    .then(({ data }) => setProducts(data))
                    .catch(() => setProducts([]))
                    .finally(() => setL("products", false)),

                api.get(`/tank-dispatch?date=${date}`)
                    .then(({ data }) => setDispatches(Array.isArray(data) ? data : []))
                    .catch(() => setDispatches([]))
                    .finally(() => setL("dispatch", false)),

                api.get(`/stock/available?date=${date}`)
                    .then(({ data }) => setOpeningMilk({
                        cow: parseFloat(data.opening?.cow || 0),
                        buffalo: parseFloat(data.opening?.buffalo || 0),
                    }))
                    .catch(() => setOpeningMilk({ cow: 0, buffalo: 0 })),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAll(selectedDate); }, [selectedDate, fetchAll]);

    // ── computed stats ──

    // Milk
    const totalMilkQty = milkEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalMilkAmt = milkEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const avgFat = milkEntries.length
        ? milkEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / milkEntries.length
        : 0;
    const avgSnf = milkEntries.length
        ? milkEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / milkEntries.length
        : 0;
    const morningEntries = milkEntries.filter((e) => e.shift === "morning");
    const eveningEntries = milkEntries.filter((e) => e.shift === "evening");
    const cowEntries = milkEntries.filter((e) => e.milk_type === "cow");
    const bufEntries = milkEntries.filter((e) => e.milk_type === "buffalo");

    // Walk-in sales
    const walkinRevenue = walkinSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const walkinQty = walkinSales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0);

    // Product sales
    const prodSaleRev = productSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);

    // Purchases
    const purchaseSpend = purchases.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);

    // Cash advance
    const advGiven = advances.filter((a) => a.type === "given").reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    // Total revenue
    const totalRevenue = walkinRevenue + prodSaleRev;

    // Stock alerts
    const lowStockItems = products.filter((p) => parseFloat(p.current_stock || 0) < 5);
    const outOfStock = products.filter((p) => parseFloat(p.current_stock || 0) <= 0);

    // Tank dispatch
    // Per-type FAT/SNF
    const avgFatCow = cowEntries.length
        ? cowEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / cowEntries.length : 0;
    const avgSnfCow = cowEntries.length
        ? cowEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / cowEntries.length : 0;
    const avgFatBuf = bufEntries.length
        ? bufEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / bufEntries.length : 0;
    const avgSnfBuf = bufEntries.length
        ? bufEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / bufEntries.length : 0;

    // Walk-in per type
    const cowWalkinSales = walkinSales.filter(s => s.milk_type === "cow");
    const bufWalkinSales = walkinSales.filter(s => s.milk_type === "buffalo");
    const cowWalkinRev = cowWalkinSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const bufWalkinRev = bufWalkinSales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const cowWalkinQty = cowWalkinSales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0);
    const bufWalkinQty = bufWalkinSales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0);

    // Dairy sale revenue = factory dispatch revenue
    const dairySaleRev = dispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);

    // True profit = Dairy sale + Walkin + Product sales
    const totalProfit = dairySaleRev + walkinRevenue + prodSaleRev;

    // Tank dispatch
    const totalDispatched = dispatches.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);
    const totalFactoryRev = dispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);
    const avgFactoryRate = dispatches.length
        ? dispatches.reduce((a, d) => a + parseFloat(d.factory_rate || 0), 0) / dispatches.length
        : 0;

    // ── recent milk entries (last 5) ──
    const recentMilk = [...milkEntries].slice(0, 5);

    // ── recent walk-in sales (last 5) ──
    const recentWalkin = [...walkinSales].slice(0, 5);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4 relative overflow-hidden">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2.5">
                            {greeting.icon}
                            <span className="text-sm font-medium text-gray-600">{greeting.text},</span>
                            <span className="font-bold text-gray-800">{user?.name || "Operator"}</span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Dashboard</h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(selectedDate).toLocaleDateString("en-IN", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 relative z-10">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Viewing Date</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>
                        <button
                            onClick={() => fetchAll(selectedDate)}
                            disabled={refreshing}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm disabled:opacity-50 mt-4"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                            {refreshing ? "Loading…" : "Refresh"}
                        </button>
                    </div>
                </div>

                {/* ── Flash ── */}
                <FlashMessage flash={flash} setFlash={setFlash} />

                {/* ── Shift Priority Banner ── */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-amber-50/80 backdrop-blur-sm shadow-lg shadow-amber-200/50 px-5 py-4">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/5 blur-3xl" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <Sun size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Morning Shift</p>
                                    <p className="text-2xl font-bold text-amber-800 leading-tight">
                                        {morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                        <span className="text-sm font-medium text-amber-500 ml-1">L</span>
                                    </p>
                                    <p className="text-[10px] text-amber-500 mt-0.5">{morningEntries.length} entries</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-amber-400 uppercase tracking-wider">Amount</p>
                                <p className="text-base font-bold text-amber-700">
                                    ₹{fmt(morningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-indigo-50/80 backdrop-blur-sm shadow-lg shadow-indigo-200/50 px-5 py-4">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/5 blur-3xl" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <Moon size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Evening Shift</p>
                                    <p className="text-2xl font-bold text-indigo-800 leading-tight">
                                        {eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                        <span className="text-sm font-medium text-indigo-400 ml-1">L</span>
                                    </p>
                                    <p className="text-[10px] text-indigo-400 mt-0.5">{eveningEntries.length} entries</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-indigo-400 uppercase tracking-wider">Amount</p>
                                <p className="text-base font-bold text-indigo-700">
                                    ₹{fmt(eveningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Stock Alerts ── */}
                {(outOfStock.length > 0 || lowStockItems.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                        {outOfStock.map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-700 text-xs font-bold backdrop-blur-sm shadow-sm">
                                <AlertTriangle size={12} /> {p.product_name} — Out of Stock
                            </div>
                        ))}
                        {lowStockItems.filter(p => parseFloat(p.current_stock) > 0).map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/80 border border-amber-200/60 text-amber-700 text-xs font-bold backdrop-blur-sm shadow-sm">
                                <AlertTriangle size={12} /> {p.product_name} — Low Stock ({parseFloat(p.current_stock).toFixed(1)} {p.unit})
                            </div>
                        ))}
                    </div>
                )}

                {/* ══ SECTION 1 — Revenue Overview ══ */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Banknote size={14} /> Revenue Overview
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Profit"
                            value={"₹" + fmt(totalProfit)}
                            sub="Dairy + Walk-in + Products"
                            icon={<Banknote size={16} />}
                            color="emerald"
                        />
                        <StatCard
                            label="Dairy Sale"
                            value={"₹" + fmt(dairySaleRev)}
                            sub={`${dispatches.length} dispatches`}
                            icon={<Truck size={16} />}
                            color="amber"
                        />
                        <StatCard
                            label="Walk-in Sales"
                            value={"₹" + fmt(walkinRevenue)}
                            sub={`${walkinSales.length} transactions`}
                            icon={<ShoppingCart size={16} />}
                            color="blue"
                        />
                        <StatCard
                            label="Product Sales"
                            value={"₹" + fmt(prodSaleRev)}
                            sub={`${productSales.length} items sold`}
                            icon={<ShoppingBag size={16} />}
                            color="violet"
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
                        <StatCard
                            label="Purchase Spend"
                            value={"₹" + fmt(purchaseSpend)}
                            sub={`${purchases.length} purchases`}
                            icon={<TrendingDown size={16} />}
                            color="red"
                        />
                    </div>
                </div>

                {/* ══ SECTION 2 — Milk Collection ══ */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Milk size={14} /> Milk Collection
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {/* Total Collection with cow/buffalo tab */}
                        <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-amber-50/80 backdrop-blur-sm shadow-lg shadow-amber-200/50 p-4 col-span-2 sm:col-span-1">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/5 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Total Collection</p>
                                    <Milk size={15} className="opacity-70 text-amber-600" />
                                </div>
                                <p className="text-2xl font-bold text-gray-900">{totalMilkQty.toFixed(1)} L</p>
                                <div className="flex gap-1 mt-1">
                                    <button onClick={() => setCowCollection(true)}
                                        className={`flex-1 text-[10px] font-bold py-0.5 rounded-lg transition ${cowCollection ? "bg-amber-400 text-amber-900" : "bg-amber-100 text-amber-500"}`}>
                                        Cow {cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}L
                                    </button>
                                    <button onClick={() => setCowCollection(false)}
                                        className={`flex-1 text-[10px] font-bold py-0.5 rounded-lg transition ${!cowCollection ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-500"}`}>
                                        Buffalo {bufEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}L
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-0.5">{milkEntries.length} entries</p>
                            </div>
                        </div>

                        <StatCard
                            label="Milk Payable"
                            value={"₹" + fmt(totalMilkAmt)}
                            sub="Due to sellers"
                            icon={<Banknote size={16} />}
                            color="emerald"
                        />

                        {/* FAT/SNF with cow/buffalo breakdown */}
                        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-indigo-50/80 backdrop-blur-sm shadow-lg shadow-indigo-200/50 p-4 col-span-2 sm:col-span-1">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/5 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Avg FAT / SNF</p>
                                    <FlaskConical size={15} className="opacity-70 text-indigo-600" />
                                </div>
                                <p className="text-lg font-bold text-gray-900">{avgFat.toFixed(2)} / {avgSnf.toFixed(2)}</p>
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                    <p className="text-[10px] text-amber-600 font-mono">Cow: {avgFatCow.toFixed(2)} FAT · {avgSnfCow.toFixed(2)} SNF</p>
                                    <p className="text-[10px] text-blue-600 font-mono">Buffalo: {avgFatBuf.toFixed(2)} FAT · {avgSnfBuf.toFixed(2)} SNF</p>
                                </div>
                            </div>
                        </div>

                        <StatCard
                            label="Sellers Active"
                            value={[...new Set(milkEntries.map((e) => e.seller_id))].length}
                            sub={`${morningEntries.length}M · ${eveningEntries.length}E shifts`}
                            icon={<Users size={16} />}
                            color="slate"
                        />
                    </div>
                </div>

                {/* ══ Walk-in Breakdown ══ */}
                <div className="relative overflow-hidden rounded-2xl border border-blue-200/60 bg-blue-50/80 backdrop-blur-sm shadow-lg shadow-blue-200/50 p-4">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-400/5 blur-3xl" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-2">
                                <ShoppingCart size={14} /> Walk-in Sales Breakdown
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className={`px-4 py-3 rounded-xl border-2 cursor-pointer transition relative overflow-hidden ${cowWalkin ? "bg-amber-400/20 border-amber-400" : "bg-white/50 border-amber-200/60"}`}
                                onClick={() => setCowWalkin(true)}>
                                <p className="text-[10px] font-bold text-amber-800">Cow Walk-in</p>
                                <p className="text-lg font-bold text-gray-900">{cowWalkinQty.toFixed(1)} L</p>
                                <p className="text-[10px] text-amber-700 font-bold">₹{fmt(cowWalkinRev)}</p>
                                <p className="text-[10px] text-amber-600">{cowWalkinSales.length} sales</p>
                            </div>
                            <div className={`px-4 py-3 rounded-xl border-2 cursor-pointer transition relative overflow-hidden ${!cowWalkin ? "bg-blue-500/20 border-blue-500" : "bg-white/50 border-blue-200/60"}`}
                                onClick={() => setCowWalkin(false)}>
                                <p className={`text-[10px] font-bold ${!cowWalkin ? "text-blue-800" : "text-blue-800"}`}>Buffalo Walk-in</p>
                                <p className="text-lg font-bold text-gray-900">{bufWalkinQty.toFixed(1)} L</p>
                                <p className="text-[10px] text-blue-700 font-bold">₹{fmt(bufWalkinRev)}</p>
                                <p className="text-[10px] text-blue-600">{bufWalkinSales.length} sales</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ══ SECTION 3 — Cash Advance Summary ══ */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Wallet size={14} /> Cash Advance
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatCard
                            label="Given Today"
                            value={"₹" + fmt(advGiven)}
                            sub={`${advances.filter((a) => a.type === "given").length} transactions`}
                            icon={<TrendingUp size={16} />}
                            color="emerald"
                        />
                    </div>
                </div>

                {/* ══ SECTION 4 — Tables Row ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Recent Milk Entries ── */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<Milk size={16} className="text-white" />}
                                title="Recent Milk Entries"
                                sub={`${milkEntries.length} total today`}
                                action={
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        {milkEntries.length > 5 && `+${milkEntries.length - 5} more`}
                                    </span>
                                }
                            />
                            {load.milk ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : recentMilk.length === 0 ? (
                                <EmptyState icon={<Milk size={32} />} text="No milk entries today" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {recentMilk.map((e) => (
                                        <div key={e.entry_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm">
                                                    {(e.seller_name || e.seller_code || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{e.seller_name || e.seller_code || `#${e.seller_id}`}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        <ShiftBadge shift={e.shift} />
                                                        <MilkTypeBadge type={e.milk_type} />
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="text-xs font-bold text-gray-800">{parseFloat(e.quantity).toFixed(1)} L</p>
                                                <p className="text-[10px] text-gray-400">FAT {parseFloat(e.fat).toFixed(1)} · SNF {parseFloat(e.snf).toFixed(1)}</p>
                                                <p className="text-[10px] text-emerald-600 font-semibold">₹{fmt(e.total_amount)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Recent Walk-in Sales ── */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<ShoppingCart size={16} className="text-white" />}
                                title="Walk-in Sales"
                                sub={`${walkinSales.length} today · ₹${fmt(walkinRevenue)}`}
                                action={
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        {walkinSales.length > 5 && `+${walkinSales.length - 5} more`}
                                    </span>
                                }
                            />
                            {load.walkin ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : recentWalkin.length === 0 ? (
                                <EmptyState icon={<ShoppingCart size={32} />} text="No walk-in sales today" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {recentWalkin.map((s) => (
                                        <div key={s.sale_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg shadow-blue-500/20">
                                                    {(s.buyer_name || "A").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{s.buyer_name || "Anonymous"}</p>
                                                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                        <MilkTypeBadge type={s.milk_type} />
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border backdrop-blur-sm
                                                            ${s.payment_mode === "cash" ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"
                                                                : s.payment_mode === "upi" ? "bg-violet-50/80 text-violet-700 border-violet-200/60"
                                                                    : "bg-rose-50/80 text-rose-700 border-rose-200/60"}`}>
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
                    </div>
                </div>

                {/* ══ SECTION 5 — Products & Advances ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Product Stock Overview ── */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<Package size={16} className="text-white" />}
                                title="Product Stock"
                                sub={`${products.length} products · ${outOfStock.length} out of stock`}
                            />
                            {load.products ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : products.length === 0 ? (
                                <EmptyState icon={<Package size={32} />} text="No products in catalogue" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {products.map((p) => {
                                        const stock = parseFloat(p.current_stock || 0);
                                        const statusColor = stock <= 0
                                            ? "bg-rose-50/80 text-rose-600 border-rose-200/60"
                                            : stock < 5
                                                ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                                                : "bg-emerald-50/80 text-emerald-700 border-emerald-200/60";
                                        return (
                                            <div key={p.product_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-gray-100/80 flex items-center justify-center shrink-0 border border-gray-200/60">
                                                        <Package size={14} className="text-gray-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-semibold text-gray-800">{p.product_name}</p>
                                                        <p className="text-[10px] text-gray-400">{p.unit}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-2.5 py-1 rounded-lg border text-xs font-bold backdrop-blur-sm ${statusColor}`}>
                                                    {stock <= 0 ? "Out" : stock.toFixed(1) + " " + p.unit}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Today's Advance Transactions ── */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<Wallet size={16} className="text-white" />}
                                title="Cash Advance Today"
                                sub={`${advances.length} transactions`}
                            />
                            {load.advance ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : advances.length === 0 ? (
                                <EmptyState icon={<Wallet size={32} />} text="No advance transactions today" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {advances.slice(0, 6).map((a) => (
                                        <div key={a.id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0
                                                    ${a.type === "given" ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30" : "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30"}`}>
                                                    {a.type === "given" ? <TrendingUp size={14} className="text-white" /> : <TrendingDown size={14} className="text-white" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{a.seller_name || `#${a.seller_id}`}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{a.remarks || (a.type === "given" ? "Advance given" : "Installment received")}</p>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className={`text-xs font-bold ${a.type === "given" ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {a.type === "given" ? "+" : "-"}₹{fmt(a.amount)}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{fmtTime(a.created_at)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ══ SECTION 6 — Product Sales & Purchases ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Product Sales ── */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<ShoppingBag size={16} className="text-white" />}
                                title="Product Sales"
                                sub={`${productSales.length} today · ₹${fmt(prodSaleRev)}`}
                            />
                            {load.psales ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : productSales.length === 0 ? (
                                <EmptyState icon={<ShoppingBag size={32} />} text="No product sales today" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {productSales.slice(0, 5).map((s) => (
                                        <div key={s.sale_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-violet-100/80 flex items-center justify-center shrink-0 border border-violet-200/60">
                                                    <Package size={14} className="text-violet-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{s.product_name || `#${s.product_id}`}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{s.seller_name || "—"}</p>
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
                    </div>

                    {/* ── Product Purchases ── */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<Layers size={16} className="text-white" />}
                                title="Product Purchases"
                                sub={`${purchases.length} today · ₹${fmt(purchaseSpend)} spent`}
                            />
                            {load.ppurch ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : purchases.length === 0 ? (
                                <EmptyState icon={<Layers size={32} />} text="No purchases today" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {purchases.slice(0, 5).map((p) => (
                                        <div key={p.purchase_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-amber-100/80 flex items-center justify-center shrink-0 border border-amber-200/60">
                                                    <Package size={14} className="text-amber-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{p.product_name || `#${p.product_id}`}</p>
                                                    <p className="text-[10px] text-gray-500 truncate">{p.supplier_name}</p>
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
                    </div>
                </div>

                {/* ══ SECTION 7 — Tank Dispatch ══ */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Truck size={14} /> Tank Dispatch
                    </p>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <StatCard
                            label="Dispatches Today"
                            value={dispatches.length}
                            sub="Trips to factory"
                            icon={<Truck size={16} />}
                            color="blue"
                        />
                        <StatCard
                            label="Total Dispatched"
                            value={totalDispatched.toFixed(1) + " L"}
                            sub="Milk sent to factory"
                            icon={<Milk size={16} />}
                            color="amber"
                        />
                        <StatCard
                            label="Factory Revenue"
                            value={"₹" + fmt(totalFactoryRev)}
                            sub="From dispatches"
                            icon={<Banknote size={16} />}
                            color="emerald"
                        />
                        <StatCard
                            label="Avg Factory Rate"
                            value={"₹" + fmt(avgFactoryRate) + "/L"}
                            sub={dispatches.length ? `${dispatches.length} dispatch(es)` : "No dispatches"}
                            icon={<TrendingUp size={16} />}
                            color="violet"
                        />
                    </div>

                    {/* Dispatch list */}
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<Truck size={16} className="text-white" />}
                                title="Dispatch Records"
                                sub={`${dispatches.length} today · ₹${fmt(totalFactoryRev)} factory revenue`}
                            />
                            {load.dispatch ? (
                                <div className="flex items-center justify-center py-10">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : dispatches.length === 0 ? (
                                <EmptyState icon={<Truck size={32} />} text="No dispatches recorded today" />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {dispatches.map((d) => (
                                        <div key={d.dispatch_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center shadow-lg shadow-gray-900/20 shrink-0">
                                                    <Truck size={14} className="text-white" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{d.factory_name || "—"}</p>
                                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                        {d.vehicle_no && (
                                                            <span className="text-[10px] text-blue-600 font-mono bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200/60">
                                                                {d.vehicle_no}
                                                            </span>
                                                        )}
                                                        {d.driver_name && (
                                                            <span className="text-[10px] text-gray-500 truncate">{d.driver_name}</span>
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
                </div>

                {/* ── Footer legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>• All data shown is for <strong className="text-gray-600">{new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
                    <span>• <strong className="text-amber-500">Low stock</strong> = below 5 units · <strong className="text-rose-500">Out</strong> = zero stock</span>
                    <span>• Dashboard fetches all modules in parallel on load</span>
                    <span>• Tank dispatch revenue is separate from walk-in and product sales</span>
                </div>

            </main>
        </div>
    );
}