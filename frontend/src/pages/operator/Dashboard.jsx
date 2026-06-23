import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import {
    Milk, ShoppingCart, ShoppingBag, Wallet, TrendingUp,
    TrendingDown, Users, Package, RefreshCw, Sun, Moon,
    AlertTriangle, ChevronRight, Droplets, BarChart3,
    ArrowUpRight, ArrowDownRight, Clock, Activity,
    FlaskConical, Banknote, Layers, Truck, Warehouse,
} from "lucide-react";
import { usePermission } from '../../context/PermissionContext'; // <-- ADD THIS
import AccessDenied from '../../components/AccessDenied'; // <-- ADD THIS

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
    const colors = {
        blue: "text-blue-600   bg-blue-50   border-blue-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600  bg-amber-50  border-amber-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        red: "text-red-500    bg-red-50    border-red-100",
        slate: "text-slate-600  bg-slate-50  border-slate-200",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        rose: "text-rose-500   bg-rose-50   border-rose-100",
    };
    return (
        <div className={`flex flex-col gap-2 px-4 py-4 rounded-2xl border ${colors[color]} relative overflow-hidden`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
            <div className="flex items-center justify-between">
                {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
                {trend && (
                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${trend === "up" ? "text-emerald-600" : "text-red-500"}`}>
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

function ShiftBadge({ shift }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
            ${shift === "morning"
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
            {shift === "morning" ? <Sun size={8} /> : <Moon size={8} />}
            {shift}
        </span>
    );
}

function MilkTypeBadge({ type }) {
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
            ${type === "cow"
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
            {type === "cow" ? "" : ""} {type}
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

// ── Main Dashboard ────────────────────────────────────────────
export default function OperatorDashboard() {
    const { user } = useAuth();
    const { can, loading: permLoading } = usePermission(); // <-- ADD THIS

    // Permission checks
    if (permLoading) return ( // <-- ADD THIS
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );
    if (!can('operator_dashboard', 'R')) return <AccessDenied />; // <-- ADD THIS

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
    const [cowWalkin, setCowWalkin] = useState(true); // tab for walkin
    const [cowCollection, setCowCollection] = useState(true); // tab for collection
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
    const totalDispatched = dispatches.reduce((a, d) => a + parseFloat(d.total_liters || 0), 0);    const totalFactoryRev = dispatches.reduce((a, d) => a + parseFloat(d.total_amount || 0), 0);
    const avgFactoryRate = dispatches.length
        ? dispatches.reduce((a, d) => a + parseFloat(d.factory_rate || 0), 0) / dispatches.length
        : 0;

    // ── recent milk entries (last 5) ──
    const recentMilk = [...milkEntries].slice(0, 5);

    // ── recent walk-in sales (last 5) ──
    const recentWalkin = [...walkinSales].slice(0, 5);

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

                {/* ── Top bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            {greeting.icon}
                            <span>{greeting.text},</span>
                            <span className="font-semibold text-gray-800">{user?.name || "Operator"}</span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight">Dashboard</h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(selectedDate).toLocaleDateString("en-IN", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Viewing Date</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                        <button
                            onClick={() => fetchAll(selectedDate)}
                            disabled={refreshing}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                transition bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 mt-4 disabled:opacity-50"
                        >
                            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                            {refreshing ? "Loading…" : "Refresh"}
                        </button>
                    </div>
                </div>

                {/* ── Shift Priority Banner ── */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-amber-100 bg-amber-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-sm shadow-amber-200">
                                <Sun size={18} className="text-amber-900" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Morning Shift</p>
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

                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-indigo-100 bg-indigo-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-200">
                                <Moon size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">Evening Shift</p>
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

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        <AlertTriangle size={15} />
                        {flash.msg}
                    </div>
                )}

                {/* ── Stock Alerts ── */}
                {(outOfStock.length > 0 || lowStockItems.length > 0) && (
                    <div className="flex flex-wrap gap-2">
                        {outOfStock.map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                <AlertTriangle size={12} /> {p.product_name} — Out of Stock
                            </div>
                        ))}
                        {lowStockItems.filter(p => parseFloat(p.current_stock) > 0).map((p) => (
                            <div key={p.product_id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                                <AlertTriangle size={12} /> {p.product_name} — Low Stock ({parseFloat(p.current_stock).toFixed(1)} {p.unit})
                            </div>
                        ))}
                    </div>
                )}

                {/* ══ SECTION 1 — Revenue Overview ══ */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Revenue Overview</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label="Total Profit"
                            value={"₹" + fmt(totalProfit)}
                            sub="Dairy + Walk-in + Products"
                            icon={<Banknote size={15} />}
                            color="emerald"
                        />
                        <StatCard
                            label="Dairy Sale"
                            value={"₹" + fmt(dairySaleRev)}
                            sub={`${dispatches.length} dispatches`}
                            icon={<Truck size={15} />}
                            color="amber"
                        />
                        <StatCard
                            label="Walk-in Sales"
                            value={"₹" + fmt(walkinRevenue)}
                            sub={`${walkinSales.length} transactions`}
                            icon={<ShoppingCart size={15} />}
                            color="blue"
                        />
                        <StatCard
                            label="Product Sales"
                            value={"₹" + fmt(prodSaleRev)}
                            sub={`${productSales.length} items sold`}
                            icon={<ShoppingBag size={15} />}
                            color="violet"
                        />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                        <StatCard
                            label="Purchase Spend"
                            value={"₹" + fmt(purchaseSpend)}
                            sub={`${purchases.length} purchases`}
                            icon={<TrendingDown size={15} />}
                            color="red"
                        />
                    </div>
                </div>

                {/* ══ SECTION 2 — Milk Collection ══ */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Milk Collection</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Total Collection with cow/buffalo tab */}
                        <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-amber-100 bg-amber-50 col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Total Collection</p>
                                <Milk size={15} className="opacity-70" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{totalMilkQty.toFixed(1)} L</p>
                            <div className="flex gap-1">
                                <button onClick={() => setCowCollection(true)}
                                    className={`flex-1 text-[10px] font-bold py-0.5 rounded-lg transition ${cowCollection ? "bg-amber-400 text-amber-900" : "bg-amber-100 text-amber-500"}`}>
                                     {cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}L
                                </button>
                                <button onClick={() => setCowCollection(false)}
                                    className={`flex-1 text-[10px] font-bold py-0.5 rounded-lg transition ${!cowCollection ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-500"}`}>
                                     {bufEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}L
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-400">{milkEntries.length} entries</p>
                        </div>

                        <StatCard
                            label="Milk Payable"
                            value={"₹" + fmt(totalMilkAmt)}
                            sub="Due to sellers"
                            icon={<Banknote size={15} />}
                            color="emerald"
                        />

                        {/* FAT/SNF with cow/buffalo breakdown */}
                        <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-indigo-100 bg-indigo-50 col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">Avg FAT / SNF</p>
                                <FlaskConical size={15} className="opacity-70" />
                            </div>
                            <p className="text-lg font-bold text-gray-900">{avgFat.toFixed(2)} / {avgSnf.toFixed(2)}</p>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] text-amber-600 font-mono"> {avgFatCow.toFixed(2)} FAT · {avgSnfCow.toFixed(2)} SNF</p>
                                <p className="text-[10px] text-blue-600 font-mono"> {avgFatBuf.toFixed(2)} FAT · {avgSnfBuf.toFixed(2)} SNF</p>
                            </div>
                        </div>

                        <StatCard
                            label="Sellers Active"
                            value={[...new Set(milkEntries.map((e) => e.seller_id))].length}
                            sub={`${morningEntries.length}M · ${eveningEntries.length}E shifts`}
                            icon={<Users size={15} />}
                            color="slate"
                        />
                    </div>
                </div>
                {/* ══ Walk-in Breakdown ══ */}
                <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-blue-100 bg-blue-50">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 opacity-70">Walk-in Sales Breakdown</p>
                        <ShoppingCart size={15} className="text-blue-500 opacity-70" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`px-3 py-2.5 rounded-xl border cursor-pointer transition ${cowWalkin ? "bg-amber-400 border-amber-400" : "bg-white border-amber-200"}`}
                            onClick={() => setCowWalkin(true)}>
                            <p className="text-[10px] font-semibold text-amber-800"> Cow Walk-in</p>
                            <p className="text-lg font-bold text-gray-900">{cowWalkinQty.toFixed(1)} L</p>
                            <p className="text-[10px] text-amber-700 font-semibold">₹{fmt(cowWalkinRev)}</p>
                            <p className="text-[10px] text-amber-600">{cowWalkinSales.length} sales</p>
                        </div>
                        <div className={`px-3 py-2.5 rounded-xl border cursor-pointer transition ${!cowWalkin ? "bg-blue-500 border-blue-500" : "bg-white border-blue-200"}`}
                            onClick={() => setCowWalkin(false)}>
                            <p className={`text-[10px] font-semibold ${!cowWalkin ? "text-white" : "text-blue-800"}`}> Buffalo Walk-in</p>
                            <p className={`text-lg font-bold ${!cowWalkin ? "text-white" : "text-gray-900"}`}>{bufWalkinQty.toFixed(1)} L</p>
                            <p className={`text-[10px] font-semibold ${!cowWalkin ? "text-blue-100" : "text-blue-700"}`}>₹{fmt(bufWalkinRev)}</p>
                            <p className={`text-[10px] ${!cowWalkin ? "text-blue-200" : "text-blue-500"}`}>{bufWalkinSales.length} sales</p>
                        </div>
                    </div>
                </div>

                {/* ══ SECTION 3 — Cash Advance Summary ══ */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Cash Advance</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <StatCard
                            label="Given Today"
                            value={"₹" + fmt(advGiven)}
                            sub={`${advances.filter((a) => a.type === "given").length} transactions`}
                            icon={<TrendingUp size={15} />}
                            color="emerald"
                        />
                    </div>
                </div>

                {/* ══ SECTION 4 — Tables Row ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── Recent Milk Entries ── */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<Milk size={13} className="text-white" />}
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
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : recentMilk.length === 0 ? (
                            <EmptyState icon={<Milk size={28} />} text="No milk entries today" />
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

                    {/* ── Recent Walk-in Sales ── */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<ShoppingCart size={13} className="text-white" />}
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
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : recentWalkin.length === 0 ? (
                            <EmptyState icon={<ShoppingCart size={28} />} text="No walk-in sales today" />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {recentWalkin.map((s) => (
                                    <div key={s.sale_id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                                                {(s.buyer_name || "A").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{s.buyer_name || "Anonymous"}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <MilkTypeBadge type={s.milk_type} />
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium
                                                        ${s.payment_mode === "cash" ? "bg-emerald-50 text-emerald-700"
                                                            : s.payment_mode === "upi" ? "bg-violet-50 text-violet-700"
                                                                : "bg-rose-50 text-rose-700"}`}>
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

                {/* ══ SECTION 5 — Products & Advances ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── Product Stock Overview ── */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<Package size={13} className="text-white" />}
                            title="Product Stock"
                            sub={`${products.length} products · ${outOfStock.length} out of stock`}
                        />
                        {load.products ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : products.length === 0 ? (
                            <EmptyState icon={<Package size={28} />} text="No products in catalogue" />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {products.map((p) => {
                                    const stock = parseFloat(p.current_stock || 0);
                                    const statusColor = stock <= 0
                                        ? "text-red-500 bg-red-50 border-red-100"
                                        : stock < 5
                                            ? "text-amber-600 bg-amber-50 border-amber-100"
                                            : "text-emerald-600 bg-emerald-50 border-emerald-100";
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
                                                {stock <= 0 ? "Out" : stock.toFixed(1) + " " + p.unit}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Today's Advance Transactions ── */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<Wallet size={13} className="text-white" />}
                            title="Cash Advance Today"
                            sub={`${advances.length} transactions`}
                        />
                        {load.advance ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : advances.length === 0 ? (
                            <EmptyState icon={<Wallet size={28} />} text="No advance transactions today" />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {advances.slice(0, 6).map((a) => (
                                    <div key={a.id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0
                                                ${a.type === "given" ? "bg-emerald-500" : "bg-red-500"}`}>
                                                {a.type === "given" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{a.seller_name || `#${a.seller_id}`}</p>
                                                <p className="text-[10px] text-gray-400 truncate">{a.remarks || (a.type === "given" ? "Advance given" : "Installment received")}</p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className={`text-xs font-bold ${a.type === "given" ? "text-emerald-600" : "text-red-500"}`}>
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

                {/* ══ SECTION 6 — Product Sales & Purchases ══ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                    {/* ── Product Sales ── */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<ShoppingBag size={13} className="text-white" />}
                            title="Product Sales"
                            sub={`${productSales.length} today · ₹${fmt(prodSaleRev)}`}
                        />
                        {load.psales ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : productSales.length === 0 ? (
                            <EmptyState icon={<ShoppingBag size={28} />} text="No product sales today" />
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

                    {/* ── Product Purchases ── */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<Layers size={13} className="text-white" />}
                            title="Product Purchases"
                            sub={`${purchases.length} today · ₹${fmt(purchaseSpend)} spent`}
                        />
                        {load.ppurch ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : purchases.length === 0 ? (
                            <EmptyState icon={<Layers size={28} />} text="No purchases today" />
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
                </div>

                {/* ══ SECTION 7 — Tank Dispatch ══ */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tank Dispatch</p>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                        <StatCard
                            label="Dispatches Today"
                            value={dispatches.length}
                            sub="Trips to factory"
                            icon={<Truck size={15} />}
                            color="blue"
                        />
                        <StatCard
                            label="Total Dispatched"
                            value={totalDispatched.toFixed(1) + " L"}
                            sub="Milk sent to factory"
                            icon={<Milk size={15} />}
                            color="amber"
                        />
                        <StatCard
                            label="Factory Revenue"
                            value={"₹" + fmt(totalFactoryRev)}
                            sub="From dispatches"
                            icon={<Banknote size={15} />}
                            color="emerald"
                        />
                        <StatCard
                            label="Avg Factory Rate"
                            value={"₹" + fmt(avgFactoryRate) + "/L"}
                            sub={dispatches.length ? `${dispatches.length} dispatch(es)` : "No dispatches"}
                            icon={<TrendingUp size={15} />}
                            color="violet"
                        />
                    </div>

                    {/* Dispatch list */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<Truck size={13} className="text-white" />}
                            title="Dispatch Records"
                            sub={`${dispatches.length} today · ₹${fmt(totalFactoryRev)} factory revenue`}
                        />
                        {load.dispatch ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : dispatches.length === 0 ? (
                            <EmptyState icon={<Truck size={28} />} text="No dispatches recorded today" />
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

                {/* ── Footer legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-4">
                    <span>• All data shown is for <strong className="text-gray-600">{new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</strong></span>
                    <span>• <strong className="text-amber-500">Low stock</strong> = below 5 units · <strong className="text-red-500">Out</strong> = zero stock</span>
                    <span>• Dashboard fetches all modules in parallel on load</span>
                    <span>• Tank dispatch revenue is separate from walk-in and product sales</span>
                </div>

            </main>
        </div>
    );
}