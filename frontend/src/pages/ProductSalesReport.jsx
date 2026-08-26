import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
    TrendingUp,
    Users,
    Package,
    ShoppingCart,
    Download,
    Printer,
    X,
    ChevronDown,
    BarChart3,
    AlertCircle,
    CheckCircle2,
    FileDown,
    RefreshCw,
    Search,
    Grid3X3,
    List,
    Clock
} from "lucide-react";

import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import { useAppConfig } from '../context/AppConfigContext';
import AccessDenied from '../components/AccessDenied';

// ── Helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
}) : "—";

const formatCurrency = (amount) => `₹${parseFloat(amount || 0).toFixed(2)}`;

const formatNumber = (num) => parseFloat(num || 0).toFixed(2);

const getWeekRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const day = dt.getDay();
    const monOffset = day === 0 ? -6 : 1 - day;
    const mon = new Date(dt);
    mon.setDate(dt.getDate() + monOffset);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
};

const getMonthRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const y = dt.getFullYear(), m = dt.getMonth();
    return {
        from: new Date(y, m, 1).toISOString().split("T")[0],
        to: new Date(y, m + 1, 0).toISOString().split("T")[0]
    };
};

const getYearRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const y = dt.getFullYear();
    return {
        from: new Date(y, 0, 1).toISOString().split("T")[0],
        to: new Date(y, 11, 31).toISOString().split("T")[0]
    };
};

const getQuarterRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const y = dt.getFullYear();
    const q = Math.floor(dt.getMonth() / 3);
    const startMonth = q * 3;
    return {
        from: new Date(y, startMonth, 1).toISOString().split("T")[0],
        to: new Date(y, startMonth + 3, 0).toISOString().split("T")[0]
    };
};

// ── Filter Dropdown Portal ──────────────────────────────────
function DropdownPortal({ anchorRef, open, width, children }) {
    const [style, setStyle] = useState(null);
    useEffect(() => {
        if (!open || !anchorRef.current) { setStyle(null); return; }
        const update = () => {
            const r = anchorRef.current.getBoundingClientRect();
            setStyle({
                position: "fixed",
                top: r.bottom + 4,
                left: r.left,
                width: width || r.width,
                zIndex: 9999,
            });
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open, anchorRef]);
    if (!open || !style) return null;
    return createPortal(<div style={style}>{children}</div>, document.body);
}

// ── Chart Components ────────────────────────────────────────
function SimpleBar({ data, maxValue, color = "bg-blue-500", height = 40 }) {
    if (!data || data.length === 0) return null;
    const max = maxValue || Math.max(...data.map(d => d.value || 0), 1);
    return (
        <div className="flex items-end gap-1 h-full" style={{ height }}>
            {data.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 min-w-0">
                    <div
                        className={`${color} rounded-t transition-all duration-500 w-full`}
                        style={{ height: `${Math.max(2, (item.value / max) * 100)}%` }}
                    />
                    <span className="text-[8px] text-gray-400 mt-0.5 truncate w-full text-center">
                        {item.label}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Main Component ──────────────────────────────────────────
export default function ProductSalesReport() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();
    const { appName } = useAppConfig();

    // ── State ──────────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [salesData, setSalesData] = useState([]);
    const [summary, setSummary] = useState(null);
    const [flash, setFlash] = useState(null);

    // ── Date range state ────────────────────────────────────
    const [rangeMode, setRangeMode] = useState("today");
    const [selectedDate, setSelectedDate] = useState(today());
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());

    // ── Filter state ────────────────────────────────────────
    const [filters, setFilters] = useState({
        seller_type: "all",
        buyer_type: "all",
        product_id: "all",
        seller_id: "all",
        operator_id: "all",
        shift: "all",
        milk_type: "all",
        min_amount: "",
        max_amount: "",
    });

    // ── Dropdown states ─────────────────────────────────────
    const [showSellerDropdown, setShowSellerDropdown] = useState(false);
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const [showOperatorDropdown, setShowOperatorDropdown] = useState(false);
    const sellerAnchorRef = useRef(null);
    const productAnchorRef = useRef(null);
    const operatorAnchorRef = useRef(null);

    // ── Reference data ──────────────────────────────────────
    const [sellers, setSellers] = useState([]);
    const [products, setProducts] = useState([]);
    const [operators, setOperators] = useState([]);

    // ── View mode ───────────────────────────────────────────
    const [viewMode, setViewMode] = useState("table");

    // ── Selected seller/product for filters ─────────────────
    const [sellerSearch, setSellerSearch] = useState("");
    const [productSearch, setProductSearch] = useState("");
    const [operatorSearch, setOperatorSearch] = useState("");

    // ── Fetch reference data ────────────────────────────────
    useEffect(() => {
        const fetchRefData = async () => {
            try {
                const [sellersRes, productsRes, operatorsRes] = await Promise.all([
                    api.get("/sellers"),
                    api.get("/products"),
                    api.get("/operators"),
                ]);
                setSellers(sellersRes.data || []);
                setProducts(productsRes.data || []);
                setOperators(operatorsRes.data || []);
            } catch (err) {
                console.error("Failed to fetch reference data:", err);
            }
        };
        fetchRefData();
    }, []);

    // ── Compute date range based on mode ────────────────────
    const computeDateRange = (mode, date) => {
        let from, to;
        switch (mode) {
            case "today":
                from = to = date;
                break;
            case "yesterday": {
                const d = new Date(date + "T00:00:00");
                d.setDate(d.getDate() - 1);
                const s = d.toISOString().split("T")[0];
                from = to = s;
                break;
            }
            case "week":
                { const r = getWeekRange(date); from = r.from; to = r.to; break; }
            case "month":
                { const r = getMonthRange(date); from = r.from; to = r.to; break; }
            case "quarter":
                { const r = getQuarterRange(date); from = r.from; to = r.to; break; }
            case "year":
                { const r = getYearRange(date); from = r.from; to = r.to; break; }
            case "custom":
                from = fromDate;
                to = toDate;
                break;
            default:
                from = to = date;
        }
        return { from, to };
    };

    // ── Fetch sales data ────────────────────────────────────
    const fetchSales = async () => {
        setLoading(true);
        try {
            const { from, to } = computeDateRange(rangeMode, selectedDate);
            setFromDate(from);
            setToDate(to);

            const params = new URLSearchParams();
            params.append("from", from);
            params.append("to", to);

            if (filters.seller_type !== "all") params.append("seller_type", filters.seller_type);
            if (filters.buyer_type !== "all") params.append("buyer_type", filters.buyer_type);
            if (filters.product_id !== "all") params.append("product_id", filters.product_id);
            if (filters.seller_id !== "all") params.append("seller_id", filters.seller_id);
            if (filters.operator_id !== "all") params.append("operator_id", filters.operator_id);
            if (filters.shift !== "all") params.append("shift", filters.shift);
            if (filters.milk_type !== "all") params.append("milk_type", filters.milk_type);
            if (filters.min_amount) params.append("min_amount", filters.min_amount);
            if (filters.max_amount) params.append("max_amount", filters.max_amount);

            const { data } = await api.get(`/product-sales/report?${params}`);
            setSalesData(data.transactions || []);
            setSummary(data.summary || null);
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to load report");
            console.error("Fetch sales error:", err);
        } finally {
            setLoading(false);
        }
    };

    // ── Fetch on filter change ──────────────────────────────
    useEffect(() => {
        fetchSales();
    }, [rangeMode, selectedDate, fromDate, toDate]);

    // ── Filter change handler ────────────────────────────────
    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const applyFilters = () => {
        fetchSales();
    };

    const resetFilters = () => {
        setFilters({
            seller_type: "all",
            buyer_type: "all",
            product_id: "all",
            seller_id: "all",
            operator_id: "all",
            shift: "all",
            milk_type: "all",
            min_amount: "",
            max_amount: "",
        });
        setSellerSearch("");
        setProductSearch("");
        setOperatorSearch("");
        setShowSellerDropdown(false);
        setShowProductDropdown(false);
        setShowOperatorDropdown(false);
        fetchSales();
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Download CSV ─────────────────────────────────────────
    const downloadCSV = () => {
        if (!salesData.length) return;
        const headers = [
            "Date", "Transaction ID", "Seller", "Seller Code", "Seller Type",
            "Buyer Type", "Product", "Quantity", "Rate", "Total Amount",
            "Operator"
        ];
        const rows = salesData.flatMap(txn =>
            txn.items.map(item => [
                formatDate(txn.sale_date),
                txn.transaction_id,
                txn.seller_name || "Anonymous",
                txn.seller_code || "",
                txn.seller_type || "",
                txn.buyer_type || "",
                item.product_name || "",
                formatNumber(item.quantity),
                formatNumber(item.rate),
                formatNumber(item.total_amount),
                txn.operator_name || "",
            ])
        );

        let csv = headers.join(",") + "\n";
        rows.forEach(row => {
            csv += row.join(",") + "\n";
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `product_sales_report_${selectedDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Print report ─────────────────────────────────────────
    const printReport = () => {
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const periodLabel = fromDate === toDate
            ? formatDate(fromDate)
            : `${formatDate(fromDate)} to ${formatDate(toDate)}`;

        const totalRevenue = salesData.reduce((sum, txn) => sum + parseFloat(txn.total_amount || 0), 0);
        const totalQty = salesData.reduce((sum, txn) => {
            return sum + txn.items.reduce((s, item) => s + parseFloat(item.quantity || 0), 0);
        }, 0);

        const uniqueSellers = new Set(salesData.map(t => t.seller_id)).size;
        const uniqueProducts = new Set(salesData.flatMap(t => t.items.map(i => i.product_id))).size;

        win.document.write(`<!DOCTYPE html><html><head>
            <title>Product Sales Report</title>
            <style>
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: Arial, sans-serif; font-size: 9px; color: #000; margin: 16px; background: #fff; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; font-size: 8px; }
                th { background: #000; color: #fff; }
                .header { display: flex; justify-content: space-between; margin-bottom: 14px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                .header h1 { font-size: 18px; margin: 0; }
                .stats { display: flex; gap: 16px; margin-bottom: 14px; }
                .stat-box { background: #f2f2f2; border: 1px solid #999; padding: 8px 14px; border-radius: 4px; text-align: center; }
                .stat-box .label { font-size: 8px; color: #333; text-transform: uppercase; }
                .stat-box .value { font-size: 16px; font-weight: 700; }
                @media print { @page { margin: 8mm; } }
            </style>
        </head><body>
            <div class="header">
                <div>
                    <h1>Product Sales Report</h1>
                    <div style="font-size:10px;color:#333">${periodLabel}</div>
                    <div style="font-size:9px;color:#555">Generated: ${new Date().toLocaleString()}</div>
                </div>
                <div style="font-size:10px;font-weight:bold">${appName || "Dairy CMS"}</div>
            </div>

            <div class="stats">
                <div class="stat-box"><div class="label">Transactions</div><div class="value">${salesData.length}</div></div>
                <div class="stat-box"><div class="label">Total Revenue</div><div class="value">₹${totalRevenue.toFixed(2)}</div></div>
                <div class="stat-box"><div class="label">Total Quantity</div><div class="value">${totalQty.toFixed(2)}</div></div>
                <div class="stat-box"><div class="label">Unique Sellers</div><div class="value">${uniqueSellers}</div></div>
                <div class="stat-box"><div class="label">Unique Products</div><div class="value">${uniqueProducts}</div></div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Transaction</th>
                        <th>Seller</th>
                        <th>Type</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Rate</th>
                        <th>Total</th>
                        <th>Operator</th>
                    </tr>
                </thead>
                <tbody>
        `);

        salesData.forEach(txn => {
            txn.items.forEach((item, idx) => {
                win.document.write(`
                    <tr>
                        <td>${idx === 0 ? formatDate(txn.sale_date) : ""}</td>
                        <td>${idx === 0 ? txn.transaction_id : ""}</td>
                        <td>${idx === 0 ? (txn.seller_name || "Anonymous") : ""}</td>
                        <td>${idx === 0 ? (txn.seller_type || txn.buyer_type || "") : ""}</td>
                        <td>${item.product_name || ""}</td>
                        <td style="text-align:right">${formatNumber(item.quantity)}</td>
                        <td style="text-align:right">${formatNumber(item.rate)}</td>
                        <td style="text-align:right">${formatNumber(item.total_amount)}</td>
                        <td>${idx === 0 ? (txn.operator_name || "") : ""}</td>
                    </tr>
                `);
            });
        });

        win.document.write(`
                </tbody>
            </table>
            <div style="margin-top:20px;font-size:9px;color:#444;display:flex;justify-content:space-between">
                <span>Report generated by ${appName}</span>
                <span>Signature: _________________</span>
            </div>
            <script>window.onload = () => window.print();<\/script>
        </body></html>
        `);
        win.document.close();
    };

    // ── Computed summary stats ──────────────────────────────
    const computedSummary = useMemo(() => {
        if (!salesData.length) return null;

        const totalRevenue = salesData.reduce((sum, txn) => sum + parseFloat(txn.total_amount || 0), 0);
        const totalQty = salesData.reduce((sum, txn) => {
            return sum + txn.items.reduce((s, item) => s + parseFloat(item.quantity || 0), 0);
        }, 0);

        // Top products
        const productMap = {};
        salesData.forEach(txn => {
            txn.items.forEach(item => {
                const key = item.product_id;
                if (!productMap[key]) {
                    productMap[key] = { name: item.product_name, qty: 0, revenue: 0 };
                }
                productMap[key].qty += parseFloat(item.quantity || 0);
                productMap[key].revenue += parseFloat(item.total_amount || 0);
            });
        });
        const topProducts = Object.entries(productMap)
            .map(([id, data]) => ({ id: parseInt(id), ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Top sellers
        const sellerMap = {};
        salesData.forEach(txn => {
            const key = txn.seller_id || "anonymous";
            if (!sellerMap[key]) {
                sellerMap[key] = {
                    name: txn.seller_name || "Anonymous",
                    code: txn.seller_code || "",
                    revenue: 0,
                    count: 0
                };
            }
            sellerMap[key].revenue += parseFloat(txn.total_amount || 0);
            sellerMap[key].count += 1;
        });
        const topSellers = Object.entries(sellerMap)
            .map(([id, data]) => ({ id: id === "anonymous" ? null : parseInt(id), ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        // Daily trend
        const dailyMap = {};
        salesData.forEach(txn => {
            const date = txn.sale_date;
            if (!dailyMap[date]) dailyMap[date] = { revenue: 0, count: 0 };
            dailyMap[date].revenue += parseFloat(txn.total_amount || 0);
            dailyMap[date].count += 1;
        });
        const dailyTrend = Object.entries(dailyMap)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            totalRevenue,
            totalQty,
            totalTransactions: salesData.length,
            totalItems: salesData.reduce((sum, txn) => sum + txn.items.length, 0),
            uniqueSellers: new Set(salesData.map(t => t.seller_id)).size,
            uniqueProducts: new Set(salesData.flatMap(t => t.items.map(i => i.product_id))).size,
            topProducts,
            topSellers,
            dailyTrend,
            avgTransactionValue: salesData.length > 0 ? totalRevenue / salesData.length : 0,
        };
    }, [salesData]);

    // ── Render ──────────────────────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('product_sales', 'R')) return <AccessDenied />;

    const periodLabel = fromDate === toDate
        ? formatDate(fromDate)
        : `${formatDate(fromDate)} — ${formatDate(toDate)}`;

    const selectedSeller = sellers.find(s => s.seller_id === parseInt(filters.seller_id));
    const selectedProduct = products.find(p => p.product_id === parseInt(filters.product_id));
    const selectedOperator = operators.find(o => o.operator_id === parseInt(filters.operator_id));

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success" ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Product Sales Report
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Comprehensive analysis of product sales with advanced filtering
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={fetchSales}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                        <button
                            onClick={downloadCSV}
                            disabled={!salesData.length}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200/80 transition border border-emerald-200/60 backdrop-blur-sm shadow-sm disabled:opacity-50"
                        >
                            <FileDown size={15} /> CSV
                        </button>
                        <button
                            onClick={printReport}
                            disabled={!salesData.length}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-100/80 text-blue-700 hover:bg-blue-200/80 transition border border-blue-200/60 backdrop-blur-sm shadow-sm disabled:opacity-50"
                        >
                            <Printer size={15} /> Print
                        </button>
                        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                            <button
                                onClick={() => setViewMode("table")}
                                className={`px-3 py-2 transition ${viewMode === "table" ? "bg-gray-900 text-white" : "text-gray-500"}`}
                            >
                                <List size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode("cards")}
                                className={`px-3 py-2 transition ${viewMode === "cards" ? "bg-gray-900 text-white" : "text-gray-500"}`}
                            >
                                <Grid3X3 size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Period Selector ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                            {[
                                { v: "today", l: "Today" },
                                { v: "yesterday", l: "Yesterday" },
                                { v: "week", l: "Week" },
                                { v: "month", l: "Month" },
                                { v: "quarter", l: "Quarter" },
                                { v: "year", l: "Year" },
                                { v: "custom", l: "Custom" },
                            ].map(({ v, l }) => (
                                <button
                                    key={v}
                                    onClick={() => {
                                        setRangeMode(v);
                                        if (v === "custom") {
                                            setFromDate(today());
                                            setToDate(today());
                                        }
                                    }}
                                    className={`px-3.5 py-2 transition-all duration-200 ${rangeMode === v
                                        ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30"
                                        : "text-gray-500 hover:bg-gray-100/50"
                                        }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>

                        {rangeMode === "custom" && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={e => setFromDate(e.target.value)}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                                <span className="text-gray-400 text-sm">→</span>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={e => setToDate(e.target.value)}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                                <button
                                    onClick={fetchSales}
                                    className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition shadow-sm"
                                >
                                    Apply
                                </button>
                            </div>
                        )}

                        <div className="ml-auto text-sm text-gray-500 font-medium flex items-center gap-2">
                            {periodLabel}
                            {loading && (
                                <span className="flex items-center gap-1 text-gray-300">
                                    <Clock size={12} className="animate-pulse" /> Loading...
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Filters ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Seller Type Filter */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Seller Type</span>
                            <select
                                value={filters.seller_type}
                                onChange={e => handleFilterChange("seller_type", e.target.value)}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            >
                                <option value="all">All Types</option>
                                <option value="Utpadak">Utpadak</option>
                                <option value="Gavali">Gavali</option>
                            </select>
                        </div>

                        {/* Buyer Type Filter */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Buyer Type</span>
                            <select
                                value={filters.buyer_type}
                                onChange={e => handleFilterChange("buyer_type", e.target.value)}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            >
                                <option value="all">All Buyers</option>
                                <option value="seller">Seller</option>
                                <option value="named">Named</option>
                                <option value="anon">Anonymous</option>
                            </select>
                        </div>

                        {/* Seller Filter */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Seller</span>
                            <div className="relative" ref={sellerAnchorRef}>
                                <button
                                    onClick={() => setShowSellerDropdown(!showSellerDropdown)}
                                    className="flex items-center gap-2 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-white transition min-w-[150px]"
                                >
                                    {selectedSeller ? (
                                        <span className="truncate">{selectedSeller.name}</span>
                                    ) : (
                                        <span className="text-gray-400">All Sellers</span>
                                    )}
                                    <ChevronDown size={14} className="ml-auto text-gray-400" />
                                </button>
                                <DropdownPortal anchorRef={sellerAnchorRef} open={showSellerDropdown} width={250}>
                                    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg overflow-hidden">
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                type="text"
                                                value={sellerSearch}
                                                onChange={e => setSellerSearch(e.target.value)}
                                                placeholder="Search sellers..."
                                                className="w-full border border-gray-200/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-52 overflow-y-auto">
                                            <button
                                                onClick={() => { handleFilterChange("seller_id", "all"); setShowSellerDropdown(false); }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition"
                                            >
                                                All Sellers
                                            </button>
                                            {sellers
                                                .filter(s => !sellerSearch || s.name.toLowerCase().includes(sellerSearch.toLowerCase()))
                                                .map(s => (
                                                    <button
                                                        key={s.seller_id}
                                                        onClick={() => { handleFilterChange("seller_id", String(s.seller_id)); setShowSellerDropdown(false); }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition flex items-center gap-2"
                                                    >
                                                        <span className="font-medium">{s.name}</span>
                                                        <span className="text-xs text-gray-400">{s.seller_code}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                </DropdownPortal>
                            </div>
                        </div>

                        {/* Product Filter */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Product</span>
                            <div className="relative" ref={productAnchorRef}>
                                <button
                                    onClick={() => setShowProductDropdown(!showProductDropdown)}
                                    className="flex items-center gap-2 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-white transition min-w-[150px]"
                                >
                                    {selectedProduct ? (
                                        <span className="truncate">{selectedProduct.product_name}</span>
                                    ) : (
                                        <span className="text-gray-400">All Products</span>
                                    )}
                                    <ChevronDown size={14} className="ml-auto text-gray-400" />
                                </button>
                                <DropdownPortal anchorRef={productAnchorRef} open={showProductDropdown} width={250}>
                                    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg overflow-hidden">
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                type="text"
                                                value={productSearch}
                                                onChange={e => setProductSearch(e.target.value)}
                                                placeholder="Search products..."
                                                className="w-full border border-gray-200/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-52 overflow-y-auto">
                                            <button
                                                onClick={() => { handleFilterChange("product_id", "all"); setShowProductDropdown(false); }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition"
                                            >
                                                All Products
                                            </button>
                                            {products
                                                .filter(p => !productSearch || p.product_name.toLowerCase().includes(productSearch.toLowerCase()))
                                                .map(p => (
                                                    <button
                                                        key={p.product_id}
                                                        onClick={() => { handleFilterChange("product_id", String(p.product_id)); setShowProductDropdown(false); }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition flex items-center justify-between"
                                                    >
                                                        <span className="font-medium">{p.product_name}</span>
                                                        <span className="text-xs text-gray-400">{p.unit}</span>
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                </DropdownPortal>
                            </div>
                        </div>

                        {/* Operator Filter */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Operator</span>
                            <div className="relative" ref={operatorAnchorRef}>
                                <button
                                    onClick={() => setShowOperatorDropdown(!showOperatorDropdown)}
                                    className="flex items-center gap-2 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-white transition min-w-[120px]"
                                >
                                    {selectedOperator ? (
                                        <span className="truncate">{selectedOperator.name}</span>
                                    ) : (
                                        <span className="text-gray-400">All</span>
                                    )}
                                    <ChevronDown size={14} className="ml-auto text-gray-400" />
                                </button>
                                <DropdownPortal anchorRef={operatorAnchorRef} open={showOperatorDropdown} width={200}>
                                    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg overflow-hidden">
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                type="text"
                                                value={operatorSearch}
                                                onChange={e => setOperatorSearch(e.target.value)}
                                                placeholder="Search..."
                                                className="w-full border border-gray-200/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="max-h-52 overflow-y-auto">
                                            <button
                                                onClick={() => { handleFilterChange("operator_id", "all"); setShowOperatorDropdown(false); }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition"
                                            >
                                                All Operators
                                            </button>
                                            {operators
                                                .filter(o => !operatorSearch || o.name.toLowerCase().includes(operatorSearch.toLowerCase()))
                                                .map(o => (
                                                    <button
                                                        key={o.operator_id}
                                                        onClick={() => { handleFilterChange("operator_id", String(o.operator_id)); setShowOperatorDropdown(false); }}
                                                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition"
                                                    >
                                                        {o.name}
                                                    </button>
                                                ))}
                                        </div>
                                    </div>
                                </DropdownPortal>
                            </div>
                        </div>

                        {/* Amount Range */}
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Amount Range</span>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    value={filters.min_amount}
                                    onChange={e => handleFilterChange("min_amount", e.target.value)}
                                    placeholder="Min ₹"
                                    className="w-20 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-2 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                                <span className="text-gray-400">–</span>
                                <input
                                    type="number"
                                    value={filters.max_amount}
                                    onChange={e => handleFilterChange("max_amount", e.target.value)}
                                    placeholder="Max ₹"
                                    className="w-20 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-2 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                            </div>
                        </div>

                        {/* Action buttons */}
                        <button
                            onClick={applyFilters}
                            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition shadow-sm h-[38px] mt-auto flex items-center gap-1"
                        >
                            <Search size={14} /> Apply
                        </button>
                        <button
                            onClick={resetFilters}
                            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition h-[38px] mt-auto flex items-center gap-1"
                        >
                            <X size={14} /> Reset
                        </button>
                    </div>
                </div>

                {/* ── Summary Stats ── */}
                {computedSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <ShoppingCart size={10} /> Transactions
                            </p>
                            <p className="text-xl font-bold text-gray-900">{computedSummary.totalTransactions}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <TrendingUp size={10} /> Revenue
                            </p>
                            <p className="text-xl font-bold text-emerald-600">{formatCurrency(computedSummary.totalRevenue)}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <Package size={10} /> Total Qty
                            </p>
                            <p className="text-xl font-bold text-blue-600">{formatNumber(computedSummary.totalQty)}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <BarChart3 size={10} /> Avg/Transaction
                            </p>
                            <p className="text-xl font-bold text-violet-600">{formatCurrency(computedSummary.avgTransactionValue)}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <Users size={10} /> Unique Sellers
                            </p>
                            <p className="text-xl font-bold text-orange-600">{computedSummary.uniqueSellers}</p>
                        </div>
                        <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm">
                            <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <Package size={10} /> Unique Products
                            </p>
                            <p className="text-xl font-bold text-rose-600">{computedSummary.uniqueProducts}</p>
                        </div>
                    </div>
                )}

                {/* ── Charts Section ── */}
                {computedSummary && salesData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Daily Trend Chart */}
                        {computedSummary.dailyTrend.length > 1 && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                                        <TrendingUp size={14} className="text-blue-500" />
                                        Daily Revenue Trend
                                    </h3>
                                    <span className="text-[10px] text-gray-400">
                                        {computedSummary.dailyTrend.length} days
                                    </span>
                                </div>
                                <div className="h-32">
                                    <SimpleBar
                                        data={computedSummary.dailyTrend.map(d => ({
                                            label: d.date.slice(5),
                                            value: d.revenue
                                        }))}
                                        color="bg-blue-500"
                                        height={120}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Top Products */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <Package size={14} className="text-amber-500" />
                                Top Products by Revenue
                            </h3>
                            <div className="space-y-2">
                                {computedSummary.topProducts.map((p, idx) => (
                                    <div key={p.id} className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-gray-400 w-4">{idx + 1}</span>
                                        <span className="text-xs text-gray-700 flex-1 truncate">{p.name}</span>
                                        <span className="text-xs font-semibold text-emerald-600">{formatCurrency(p.revenue)}</span>
                                        <span className="text-[10px] text-gray-400">{formatNumber(p.qty)} units</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Sellers */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <Users size={14} className="text-violet-500" />
                                Top Sellers by Revenue
                            </h3>
                            <div className="space-y-2">
                                {computedSummary.topSellers.map((s, idx) => (
                                    <div key={s.id || idx} className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-gray-400 w-4">{idx + 1}</span>
                                        <span className="text-xs text-gray-700 flex-1 truncate">{s.name}</span>
                                        <span className="text-[10px] text-gray-400">{s.code}</span>
                                        <span className="text-xs font-semibold text-emerald-600">{formatCurrency(s.revenue)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                            <h3 className="text-xs font-semibold text-gray-700 flex items-center gap-2 mb-3">
                                <BarChart3 size={14} className="text-purple-500" />
                                Quick Insights
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="bg-gray-50/80 rounded-xl p-2 text-center">
                                    <p className="text-[10px] text-gray-400">Items Sold</p>
                                    <p className="text-sm font-bold text-gray-800">{computedSummary.totalItems}</p>
                                </div>
                                <div className="bg-gray-50/80 rounded-xl p-2 text-center">
                                    <p className="text-[10px] text-gray-400">Avg Items/Transaction</p>
                                    <p className="text-sm font-bold text-gray-800">
                                        {computedSummary.totalTransactions > 0
                                            ? (computedSummary.totalItems / computedSummary.totalTransactions).toFixed(1)
                                            : 0}
                                    </p>
                                </div>
                                <div className="bg-gray-50/80 rounded-xl p-2 text-center">
                                    <p className="text-[10px] text-gray-400">Avg Revenue/Item</p>
                                    <p className="text-sm font-bold text-gray-800">
                                        {computedSummary.totalItems > 0
                                            ? formatCurrency(computedSummary.totalRevenue / computedSummary.totalItems)
                                            : formatCurrency(0)}
                                    </p>
                                </div>
                                <div className="bg-gray-50/80 rounded-xl p-2 text-center">
                                    <p className="text-[10px] text-gray-400">Seller Types</p>
                                    <p className="text-sm font-bold text-gray-800">
                                        {new Set(salesData.map(t => t.seller_type).filter(Boolean)).size} types
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Data Table ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                                <ShoppingCart size={14} /> Transactions
                            </h3>
                            <span className="text-xs text-gray-400">{salesData.length} records</span>
                        </div>
                        {loading && (
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                                Loading...
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : salesData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                            <Package size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">No sales data found for the selected period</p>
                            <p className="text-xs text-gray-400">Try adjusting your filters or date range</p>
                        </div>
                    ) : viewMode === "table" ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60">
                                    <tr>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Transaction</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Seller</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                                        <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Operator</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {salesData.map((txn, idx) => (
                                        txn.items.map((item, itemIdx) => (
                                            <tr key={`${txn.transaction_id}-${item.sale_id}`} className="border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors">
                                                <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                                                    {itemIdx === 0 ? formatDate(txn.sale_date) : ""}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500 font-mono">
                                                    {itemIdx === 0 ? txn.transaction_id : ""}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-800 whitespace-nowrap">
                                                    {itemIdx === 0 ? (txn.seller_name || "Anonymous") : ""}
                                                    {itemIdx === 0 && txn.seller_code && (
                                                        <span className="ml-1 text-[10px] text-gray-400 font-mono">{txn.seller_code}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs">
                                                    {itemIdx === 0 && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium
                                                            ${txn.seller_type === 'Utpadak' ? 'bg-blue-100 text-blue-700'
                                                                : txn.seller_type === 'Gavali' ? 'bg-amber-100 text-amber-700'
                                                                    : 'bg-gray-100 text-gray-500'}`}>
                                                            {txn.seller_type || txn.buyer_type || "—"}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-700">
                                                    {item.product_name || ""}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-blue-600 font-medium text-right">
                                                    {formatNumber(item.quantity)}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-amber-600 font-medium text-right">
                                                    {formatNumber(item.rate)}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-emerald-600 font-bold text-right">
                                                    {formatNumber(item.total_amount)}
                                                </td>
                                                <td className="px-3 py-2 text-xs text-gray-500">
                                                    {itemIdx === 0 ? (txn.operator_name || "") : ""}
                                                </td>
                                            </tr>
                                        ))
                                    ))}
                                </tbody>
                                <tfoot className="bg-gradient-to-r from-gray-50/50 to-white/50 border-t-2 border-gray-200/60">
                                    <tr>
                                        <td colSpan="5" className="px-3 py-2 text-xs font-semibold text-gray-700">
                                            {salesData.length} transactions · {salesData.reduce((s, t) => s + t.items.length, 0)} items
                                        </td>
                                        <td className="px-3 py-2 text-xs font-bold text-blue-600 text-right">
                                            {formatNumber(salesData.reduce((s, t) => s + t.items.reduce((a, i) => a + parseFloat(i.quantity || 0), 0), 0))}
                                        </td>
                                        <td className="px-3 py-2"></td>
                                        <td className="px-3 py-2 text-xs font-bold text-emerald-700 text-right">
                                            {formatCurrency(salesData.reduce((s, t) => s + parseFloat(t.total_amount || 0), 0))}
                                        </td>
                                        <td className="px-3 py-2"></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    ) : (
                        // Card View
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                            {salesData.map(txn => (
                                <div key={txn.transaction_id} className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/60 p-3 shadow-sm hover:shadow-md transition">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1">
                                            <Users size={12} className="text-gray-400" />
                                            {txn.seller_name || "Anonymous"}
                                        </span>
                                        <span className="text-[10px] text-gray-400 font-mono">{txn.transaction_id}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium
                                            ${txn.seller_type === 'Utpadak' ? 'bg-blue-100 text-blue-700'
                                                : txn.seller_type === 'Gavali' ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-gray-100 text-gray-500'}`}>
                                            {txn.seller_type || txn.buyer_type || "—"}
                                        </span>
                                        <span className="text-[10px] text-gray-400">{formatDate(txn.sale_date)}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {txn.items.map(item => (
                                            <div key={item.sale_id} className="flex items-center justify-between text-xs">
                                                <span className="text-gray-600 truncate max-w-[80px]">{item.product_name}</span>
                                                <span className="text-gray-400">{formatNumber(item.quantity)}</span>
                                                <span className="text-amber-600 font-medium">₹{formatNumber(item.rate)}</span>
                                                <span className="text-emerald-600 font-bold">₹{formatNumber(item.total_amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-100/60 flex justify-between">
                                        <span className="text-[10px] text-gray-400">{txn.operator_name}</span>
                                        <span className="text-xs font-bold text-emerald-700">
                                            ₹{parseFloat(txn.total_amount).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>• <strong className="text-gray-600">{salesData.length}</strong> transactions found</span>
                    <span>• Report period: {periodLabel}</span>
                    <span>• Filters applied: {
                        Object.entries(filters).filter(([k, v]) => v !== "all" && v !== "").length
                    } active</span>
                    <span className="ml-auto flex items-center gap-1">
                        <BarChart3 size={12} /> {appName || "Dairy CMS"}
                    </span>
                </div>

            </main>
        </div>
    );
}