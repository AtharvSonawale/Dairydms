import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    ShoppingCart, Save, Sun, Moon, Milk, TrendingUp,
    AlertTriangle, BadgeCheck, X, User,
    Banknote, Smartphone, CreditCard, Waves, Users, Settings,
    CheckCircle2, Clock
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── helpers ───────────────────────────────────────────────────
const getShiftByTime = () => {
    const h = new Date().getHours();
    return h >= 5 && h < 14 ? "morning" : "evening";
};

const today = () => new Date().toISOString().split("T")[0];

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const EMPTY_FORM = {
    buyer_mode: "anon",
    pay_now: true,        // ← ADD
    buyer_name: "ANON",
    buyer_id: "",
    seller_id: "",
    product_type_id: "",
    product_type: "loose",
    milk_type: "cow",
    quantity: "",
    mrp: "",
    payment_mode: "cash",
    shift: getShiftByTime(),
};

// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1 shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {icon}{label}
            </span>
            {children}
        </div>
    );
}

function TinyInput({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={`border border-gray-200 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function ShiftToggle({ value, onChange, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {["morning", "evening"].map((s) => (
                <button key={s} type="button" onClick={() => onChange(s)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === s
                            ? s === "morning" ? "bg-yellow-400 text-yellow-900" : "bg-indigo-500 text-white"
                            : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {s === "morning" ? <Sun size={12} /> : <Moon size={12} />}
                    {s === "morning" ? t('walkinSale.morning') : t('walkinSale.evening')}
                </button>
            ))}
        </div>
    );
}

function MilkTypeToggle({ value, onChange, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
            {[
                { val: "cow", label: t('walkinSale.cow'), active: "bg-amber-400 text-amber-900" },
                { val: "buffalo", label: t('walkinSale.buffalo'), active: "bg-blue-500 text-white" },
            ].map(({ val, label, active }) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                        ${value === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

const paymentBadge = (m, t) =>
    m === "cash" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
        m === "upi" ? "bg-blue-50 text-blue-700 border-blue-100" :
            "bg-orange-50 text-orange-700 border-orange-100";

// ── Main Page ─────────────────────────────────────────────────
export default function WalkinSales() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    const BUYER_MODES = [
        { val: "anon", label: t('walkinSale.anon'), emoji: "👤", desc: t('walkinSale.anonDesc') },
        { val: "named", label: t('walkinSale.named'), emoji: "🏷️", desc: t('walkinSale.namedDesc') },
        { val: "seller", label: t('walkinSale.sellerBuys'), emoji: "🧑‍", desc: t('walkinSale.sellerDesc') },
    ];

    const PAYMENT_MODES = [
        { val: "cash", label: t('walkinSale.cash'), icon: <Banknote size={13} />, active: "bg-emerald-500 text-white border-emerald-500" },
        { val: "upi", label: t('walkinSale.upi'), icon: <Smartphone size={13} />, active: "bg-blue-500 text-white border-blue-500" },
        { val: "credit", label: t('walkinSale.credit'), icon: <CreditCard size={13} />, active: "bg-orange-500 text-white border-orange-500" },
    ];

    // ── State ───────────────────────────────────────────────────
    const [form, setForm] = useState(EMPTY_FORM);
    const [sales, setSales] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [sellerSearch, setSellerSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [selectedDate, setSelectedDate] = useState(today());
    const [availableStock, setAvailableStock] = useState(null);
    const [liveStock, setLiveStock] = useState({ cow: 0, buffalo: 0 });
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);
    const [mrpRates, setMrpRates] = useState({
        cow: "",
        buffalo: "",
    });
    const [editingMrp, setEditingMrp] = useState(false);
    const [savingMrp, setSavingMrp] = useState(false);
    const [showMrpModal, setShowMrpModal] = useState(false);
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchName, setSearchName] = useState("");
const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const startWalkinSalesTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="buyer-modes"]',
                    popover: { title: t('walkinSale.anon'), description: 'Choose who is buying — an anonymous walk-in, a named regular buyer, or a registered seller buying milk back.' },
                },
                {
                    element: '[data-tour="payment-toggle"]',
                    popover: { title: 'Pay Now / Pay After', description: 'Pay Now records the payment immediately. Pay After tracks it as credit owed.' },
                },
                {
                    element: '[data-tour="save-btn"]',
                    popover: { title: t('walkinSale.recordSale'), description: 'Click here to record the sale.' },
                },
                {
                    element: '[data-tour="sales-stats"]',
                    popover: { title: t('walkinSale.salesToday'), description: 'Quick totals for today — cow and buffalo sold, plus total revenue.' },
                },
                {
                    element: '[data-tour="sales-table"]',
                    popover: { title: t('walkinSale.colBuyer'), description: 'All sales for the selected date. Filter by buyer type, or edit/delete any row.' },
                },
            ],
        });
        driverObj.drive();
    };

    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const [filterBuyerType, setFilterBuyerType] = useState("all");
    const [billingSummary, setBillingSummary] = useState({});

    const [productTypes, setProductTypes] = useState([]);
    const [namedBuyers, setNamedBuyers] = useState([]);
    const [namedBuyerSearch, setNamedBuyerSearch] = useState("");
    const [namedBuyerDropdownOpen, setNamedBuyerDropdownOpen] = useState(false);
    const [namedBuyerHighlight, setNamedBuyerHighlight] = useState(-1);
    const [showProductModal, setShowProductModal] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: "", milk_type: "both", type: "loose", extra_rate: "" });
    const [savingProduct, setSavingProduct] = useState(false);
    const [namedBuyerSummaries, setNamedBuyerSummaries] = useState([]);
    const [showClearBillModal, setShowClearBillModal] = useState(false);
    const [clearBillBuyer, setClearBillBuyer] = useState(null);
    const [clearBillAmount, setClearBillAmount] = useState("");
    const [clearingBill, setClearingBill] = useState(false);
    const [buyerBalance, setBuyerBalance] = useState(0);
    const [amountPaid, setAmountPaid] = useState("");    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };
    const [editingSaleId, setEditingSaleId] = useState(null);

    // ── Computed ────────────────────────────────────────────────
    const selectedProductType = productTypes.find(p => String(p.product_type_id) === String(form.product_type_id));
    const packagedExtra = (form.product_type === 'packaged' && selectedProductType)
        ? parseFloat(selectedProductType.extra_rate || 0) : 0;
    const effectiveDisplayMrp = parseFloat(form.mrp || 0) + packagedExtra;
    const amount = form.quantity && form.mrp
        ? (parseFloat(form.quantity || 0) * effectiveDisplayMrp).toFixed(2)
        : null;
    
    const filteredSellers = sellerSearch
        ? sellers.filter((s) =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            String(s.seller_id) === sellerSearch.trim() ||
            (s.seller_code || "").toLowerCase() === sellerSearch.trim().toLowerCase() ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase())
        )
        : sellers;

    const selectedSeller = sellers.find((s) => String(s.seller_id) === String(form.seller_id));

    // ── Fetch Data ─────────────────────────────────────────────
    const fetchSellers = async () => {
        try {
            const { data } = await api.get("/sellers");
            setSellers(data);
        } catch (err) {
            console.error("Failed to fetch sellers:", err);
        }
    };


    const fetchNamedBuyerSummaries = async () => {
        try {
            const { data } = await api.get(
                `/walkin-sales/named-buyer-summaries?from=2000-01-01&to=2099-12-31`
            );
            setNamedBuyerSummaries(data);
        } catch {
            setNamedBuyerSummaries([]);
        }
    };

    const fetchSales = async (from, to) => {
        setLoading(true);
        try {
            const resolvedTo = to || from;
            const url = from === resolvedTo
                ? `/walkin-sales?date=${from}`
                : `/walkin-sales?from=${from}&to=${resolvedTo}`;
            const { data } = await api.get(url);
            setSales(data);
        } catch {
            showFlash("error", t('walkinSale.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const fetchStock = async () => {
        try {
            const { data } = await api.get(`/stock/available?date=${selectedDate}`);
            setAvailableStock(data.available);
            setLiveStock({
                cow: parseFloat(data.collected?.cow || 0),
                buffalo: parseFloat(data.collected?.buffalo || 0),
            });
        } catch (err) {
            setAvailableStock(null);
            setLiveStock({ cow: 0, buffalo: 0 });
        }
    };

    const fetchMRPRates = async () => {
        try {
            const { data } = await api.get("/walkin-sales/mrp-rates");
            setMrpRates({
                cow: data.mrp_cow_rate || "",
                buffalo: data.mrp_buffalo_rate || "",
            });
            setForm(prev => ({
                ...prev,
                mrp: prev.milk_type === 'cow' ? data.mrp_cow_rate || "" : data.mrp_buffalo_rate || "",
            }));
        } catch (err) {
            console.error("Failed to fetch MRP rates:", err);
        }
    };

    // AFTER the closing brace of fetchMRPRates
    const fetchBillingSummary = async (from, to) => {
        try {
            const { data } = await api.get(
                `/walkin-sales/billing-summary?from=${from}&to=${to}`
            );
            return data;
        } catch {
            return {};
        }
    };


    const fetchProductTypes = async () => {
        try {
            const { data } = await api.get("/walkin-sales/product-types");
            setProductTypes(data);
        } catch (err) { console.error("Failed to fetch product types:", err); }
    };

    const fetchNamedBuyers = async () => {
        try {
            const { data } = await api.get("/walkin-sales/named-buyers");
            setNamedBuyers(data);
        } catch (err) { console.error("Failed to fetch named buyers:", err); }
    };

    const fetchBuyerBalance = async (buyerId) => {
        if (!buyerId) { setBuyerBalance(0); return; }
        try {
            const { data } = await api.get(`/walkin-sales/named-buyer-balance/${buyerId}`);
            setBuyerBalance(parseFloat(data.outstanding_balance || 0));
        } catch { setBuyerBalance(0); }
    };

    const saveProductType = async () => {
        if (!newProduct.name || !newProduct.type) { showFlash("error", "Name and type required"); return; }
        setSavingProduct(true);
        try {
            await api.post("/walkin-sales/product-types", {
                ...newProduct,
                extra_rate: parseFloat(newProduct.extra_rate || 0),
            });
            await fetchProductTypes();
            setNewProduct({ name: "", milk_type: "both", type: "loose", extra_rate: "" });
            showFlash("success", "Product type saved");
        } catch { showFlash("error", "Failed to save product type"); }
        finally { setSavingProduct(false); }
    };

    const deleteProductType = async (id) => {
        try {
            await api.delete(`/walkin-sales/product-types/${id}`);
            await fetchProductTypes();
        } catch { showFlash("error", "Failed to delete"); }
    };

    const handleClearBill = async () => {
        if (!clearBillBuyer || !clearBillAmount) return;
        setClearingBill(true);
        try {
            await api.post("/walkin-sales/clear-buyer-bill", {
                buyer_id: clearBillBuyer.buyer_id,
                amount_paid: parseFloat(clearBillAmount),
                outstanding: clearBillBuyer.outstanding,
            });
            showFlash("success", `Bill cleared for ${clearBillBuyer.name}`);
            setShowClearBillModal(false);
            setClearBillBuyer(null);
            setClearBillAmount("");
           if (rangeMode !== "daily") await fetchRangeEntries(fromDate, toDate);
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to clear bill");
        } finally {
            setClearingBill(false);
        }
    };

    const handleDeleteSale = async (saleId) => {
        if (!window.confirm("Delete this sale? This cannot be undone.")) return;
        try {
            await api.delete(`/walkin-sales/${saleId}`);
            await fetchSales(selectedDate, selectedDate);
            await fetchStock();
            await fetchNamedBuyerSummaries();
            showFlash("success", "Sale deleted");
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to delete sale");
        }
    };

    const handleEditSale = (sale) => {
        setEditingSaleId(sale.sale_id);
        const buyerMode = sale.seller_id ? "seller"
            : (sale.buyer_id || (sale.buyer_name && sale.buyer_name !== "ANON")) ? "named"
                : "anon";
        setForm({
            buyer_mode: buyerMode,
            pay_now: sale.amount_paid != null,
            buyer_name: sale.buyer_name || "ANON",
            buyer_id: sale.buyer_id || "",
            seller_id: sale.seller_id || "",
            product_type_id: sale.product_type_id || "",
            product_type: sale.product_type || "loose",
            milk_type: sale.milk_type || "cow",
            quantity: String(sale.quantity || ""),
            mrp: String(sale.mrp || ""),
            payment_mode: sale.payment_mode || "cash",
            shift: sale.shift || getShiftByTime(),
        });
        if (buyerMode === "seller") setSellerSearch(sale.seller_name || "");
        if (buyerMode === "named") setNamedBuyerSearch(sale.registered_buyer_name || sale.buyer_name || "");
        setAmountPaid(sale.amount_paid != null ? String(sale.amount_paid) : "");
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const saveNamedBuyer = async (name) => {
        try {
            const { data } = await api.post("/walkin-sales/named-buyers", { name });
            await fetchNamedBuyers();
            return data;
        } catch (err) {
            // 409 = buyer already exists → fetch and return the existing one
            if (err.response?.status === 409) {
                const existing = namedBuyers.find(
                    b => b.name.toLowerCase() === name.toLowerCase()
                );
                if (existing) return existing;
                // If not in local state yet, refetch
                try {
                    await fetchNamedBuyers();
                    const { data: freshList } = await api.get("/walkin-sales/named-buyers");
                    return freshList.find(b => b.name.toLowerCase() === name.toLowerCase()) || null;
                } catch { return null; }
            }
            showFlash("error", "Failed to register buyer");
            return null;
        }
    };

    const saveMRPRates = async () => {
        if (!mrpRates.cow || !mrpRates.buffalo) {
            showFlash("error", t('walkinSale.mrpRequired'));
            return;
        }
        setSavingMrp(true);
        try {
            await api.post("/walkin-sales/mrp-rates", {
                mrp_cow_rate: parseFloat(mrpRates.cow),
                mrp_buffalo_rate: parseFloat(mrpRates.buffalo),
            });
            showFlash("success", t('walkinSale.mrpSaved'));
        } catch (err) {
            const errorMsg = err.response?.data?.error || t('walkinSale.mrpSaveError');
            showFlash("error", errorMsg);
        } finally {
            setSavingMrp(false);
        }
    };

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return {
            from: mon.toISOString().split("T")[0],
            to: sun.toISOString().split("T")[0],
        };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        // Ensure proper month range from 1st to last day
        const lastDayNum = new Date(y, m + 1, 0).getDate();
        const pad = (n) => String(n).padStart(2, "0");
        return {
            from: `${y}-${pad(m + 1)}-01`,
            to: `${y}-${pad(m + 1)}-${pad(lastDayNum)}`,
        };
    };

    // ── Effects ─────────────────────────────────────────────────
    useEffect(() => {
        fetchSellers();
        fetchMRPRates();
        fetchProductTypes();
        fetchNamedBuyers();
    }, []);

    useEffect(() => {
        if (rangeMode === "daily") {
            fetchSales(selectedDate, selectedDate);
        } else {
            fetchRangeEntries(fromDate, toDate);
        }
        fetchStock();
        setCurrentPage(1);
        setSearchName("");
    }, [selectedDate, fromDate, toDate, rangeMode]);

    // ── Handlers ────────────────────────────────────────────────
    const handleBuyerModeChange = (mode) => {
        set("buyer_mode", mode);
        set("seller_id", "");
        set("buyer_id", "");
        setSellerSearch("");
        setNamedBuyerSearch("");
        setBuyerBalance(0);
        setAmountPaid("");
        if (mode === "anon") set("buyer_name", "ANON");
        if (mode === "named") set("buyer_name", "");
    };

    const handleSellerSearchChange = (val) => {
        setSellerSearch(val);
        setDropdownOpen(true);
        setHighlightedIdx(-1);
        if (!val) {
            set("seller_id", "");
            set("buyer_name", "");
            return;
        }

        const exact = sellers.find(
            (s) =>
                String(s.seller_id) === val.trim() ||
                (s.seller_code || "").toLowerCase() === val.trim().toLowerCase()
        );
        if (exact) {
            set("seller_id", exact.seller_id);
            set("buyer_name", exact.name);
            setSellerSearch(exact.name);
            setDropdownOpen(false);
        }
    };

    const handleSave = async () => {
        if (!form.quantity) { showFlash("error", t('walkinSale.qtyRequired')); return; }
        if (!form.mrp) { showFlash("error", t('walkinSale.mrpRequired')); return; }
        if (form.buyer_mode === "named" && !form.buyer_name.trim()) {
            showFlash("error", t('walkinSale.buyerNameRequired')); return;
        }
        if (form.buyer_mode === "seller" && !form.seller_id) {
            showFlash("error", t('walkinSale.selectSeller')); return;
        }
        if (saving) return;

        if (availableStock) {
            const available = form.milk_type === 'cow' ? availableStock.cow : availableStock.buffalo;
            if (parseFloat(form.quantity) > available) {
                showFlash("error", t('walkinSale.insufficientStock', { type: form.milk_type, available: available.toFixed(2) }));
                return;
            }
        }

        setSaving(true);
        try {
            // ── AUTO-REGISTER named buyer if no buyer_id yet ──────────────
            let resolvedBuyerId = form.buyer_id || null;
            if (form.buyer_mode === "named" && form.buyer_name.trim() && !resolvedBuyerId) {
                const nb = await saveNamedBuyer(form.buyer_name.trim());
                if (!nb) {
                    showFlash("error", t('walkinSale.buyerSaveError') || "Failed to register buyer");
                    setSaving(false);
                    return;
                }
                resolvedBuyerId = nb.buyer_id;
                set("buyer_id", nb.buyer_id);
                setNamedBuyerSearch(nb.name);
            }

            const selectedPT = productTypes.find(p => String(p.product_type_id) === String(form.product_type_id));
            const extraRate = selectedPT ? parseFloat(selectedPT.extra_rate || 0) : 0;
            const effectiveMrp = form.product_type === 'packaged'
                ? parseFloat(form.mrp) + extraRate
                : parseFloat(form.mrp);

            const payload = {
                buyer_name: form.buyer_mode === "anon" ? "ANON" : form.buyer_name.trim(),
                buyer_id: form.buyer_mode === "named" ? resolvedBuyerId : null,  // ← uses resolved id
                seller_id: form.buyer_mode === "seller" ? form.seller_id : null,
                product_type_id: form.product_type_id || null,
                product_type: form.product_type || 'loose',
                milk_type: form.milk_type,
                quantity: parseFloat(form.quantity),
                mrp: effectiveMrp,
                total_amount: parseFloat(amount),
                amount_paid: !form.pay_now
                    ? null
                    : amountPaid !== ""
                        ? parseFloat(amountPaid)
                        : parseFloat(amount),
                payment_mode: form.payment_mode,
                shift: form.shift,
                sale_date: selectedDate,
            };

            if (editingSaleId) {
                await api.put(`/walkin-sales/${editingSaleId}`, payload);
            } else {
                await api.post("/walkin-sales", payload);
            }

            await fetchSales(selectedDate, selectedDate);
            await fetchStock();
            await fetchNamedBuyerSummaries();
            showFlash("success", t('walkinSale.savedSuccess'));

            const currentMilkType = form.milk_type;
            const currentBuyerMode = form.buyer_mode;
            const currentPayNow = form.pay_now;
            setForm({
                ...EMPTY_FORM,
                shift: getShiftByTime(),
                milk_type: currentMilkType,
                buyer_mode: currentBuyerMode,
                pay_now: currentPayNow,
                payment_mode: currentPayNow ? "cash" : "credit",
                mrp: currentMilkType === 'cow' ? mrpRates.cow : mrpRates.buffalo,
                buyer_name: currentBuyerMode === "anon" ? "ANON" : "",
            });
            setAmountPaid("");
            setBuyerBalance(0);
            if (currentBuyerMode === "anon") {
                setNamedBuyerSearch("");
                setSellerSearch("");
            }
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || t('walkinSale.saveError');
            showFlash("error", errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const isFormReady = () => {
        if (!form.quantity || !form.mrp) return false;
        if (form.buyer_mode === "named" && !form.buyer_name.trim()) return false;
        if (form.buyer_mode === "seller" && !form.seller_id) return false;
        if (availableStock) {
            const available = form.milk_type === 'cow' ? availableStock.cow : availableStock.buffalo;
            if (parseFloat(form.quantity) > available) return false;
        }
        return true;
    };

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        // Let seller / named-buyer autocomplete dropdowns handle their own Enter
        if (dropdownOpen || namedBuyerDropdownOpen) return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (saving || !isFormReady()) return;
        handleSave();
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        setPdfReady(false);
        let newFrom = fromDate, newTo = toDate;
        if (mode === "daily") {
            newFrom = selectedDate;
            newTo = selectedDate;
        }
        else if (mode === "weekly") {
            const r = getWeekRange(selectedDate);
            newFrom = r.from;
            newTo = r.to;
        }
        else if (mode === "monthly") {
            const r = getMonthRange(selectedDate);
            newFrom = r.from;
            newTo = r.to;
        }
        setFromDate(newFrom);
        setToDate(newTo);
        // Fetch data when switching modes
        if (mode !== "daily") {
            fetchRangeEntries(newFrom, newTo);
        } else {
            fetchSales(selectedDate, selectedDate);
        }
    };

    const fetchRangeEntries = async (from = fromDate, to = toDate) => {
        setLoadingRange(true);
        try {
            // Ensure proper date formatting
            const fromFormatted = from.split('T')[0];
            const toFormatted = to.split('T')[0];
            const url = fromFormatted === toFormatted
                ? `/walkin-sales?date=${fromFormatted}`
                : `/walkin-sales?from=${fromFormatted}&to=${toFormatted}`;
            const { data } = await api.get(url);
            setRangeEntries(data);
            const summary = await fetchBillingSummary(fromFormatted, toFormatted);
            setBillingSummary(summary);
            setPdfReady(true);
        } catch (err) {
            console.error("Range fetch error:", err);
            showFlash("error", t('walkinSale.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
    };

    const handleDownloadPDF = () => {
        const baseData = rangeMode === "daily" ? sales : (pdfReady ? rangeEntries : sales);
        const data = baseData.filter(s => {
            const isSeller = s.seller_id !== null && s.seller_id !== undefined && s.seller_id !== "";
            const isAnon = s.buyer_name === "ANON";
            const isNamed = !isAnon && !isSeller;
            return filterBuyerType === "all" ? true :
                filterBuyerType === "anon" ? isAnon :
                    filterBuyerType === "seller" ? isSeller :
                        isNamed;
        });

        const win = window.open("", "_blank", "width=1400,height=900");
        if (!win) return;

        const modeLabel = rangeMode === "daily" ? t('walkinSale.pdfDaily')
            : rangeMode === "weekly" ? t('walkinSale.pdfWeekly')
                : rangeMode === "monthly" ? t('walkinSale.pdfMonthly')
                    : t('walkinSale.pdfCustom');

        const buyerLabel = filterBuyerType === "all" ? t('walkinSale.pdfAllBuyers')
            : filterBuyerType === "anon" ? t('walkinSale.pdfAnonymousOnly')
                : filterBuyerType === "named" ? t('walkinSale.pdfNamedOnly')
                    : t('walkinSale.pdfSellerOnly');

        const fmtD = (d) => d
            ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";

        const periodLabel = fromDate === toDate
            ? fmtD(fromDate)
            : `${fmtD(fromDate)} ${t('walkinSale.pdfTo')} ${fmtD(toDate)}`;

        // ── Summary totals ─────────────────────────────────────────
        const grandQty = {};
        data.forEach(e => {
            grandQty[e.milk_type] = (grandQty[e.milk_type] || 0) + parseFloat(e.quantity || 0);
        });
        const totalAmt = data.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const cashAmt = data.filter(e => e.payment_mode === "cash").reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const upiAmt = data.filter(e => e.payment_mode === "upi").reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const creditAmt = data.filter(e => e.payment_mode === "credit").reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);

        // ── Build allDates ─────────────────────────────────────────
        let allDates = [];
        if (rangeMode === "monthly") {
            const start = new Date(fromDate + "T00:00:00");
            const end = new Date(toDate + "T00:00:00");
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const pad = (n) => String(n).padStart(2, "0");
                allDates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }
        } else {
            const allDatesSet = new Set();
            data.forEach(e => {
                const dateKey = (e.sale_date
                    ? String(e.sale_date).split("T")[0].slice(0, 10)
                    : (e.created_at || "").split("T")[0].slice(0, 10));
                if (dateKey && dateKey !== "undefined" && dateKey !== "null") {
                    allDatesSet.add(dateKey);
                }
            });
            allDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));
            if (allDates.length === 0) {
                const start = new Date(fromDate + "T00:00:00");
                const end = new Date(toDate + "T00:00:00");
                for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                    const pad = (n) => String(n).padStart(2, "0");
                    allDates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                }
            }
        }

        // ── Group by person + milk type ────────────────────────────
        const sellerMap = {};
        data.forEach(e => {
            const personKey = e.seller_id
                ? String(e.seller_id)
                : e.buyer_id
                    ? ("nb_" + String(e.buyer_id))
                    : ("__" + (e.buyer_name || "ANON"));
            const key = personKey + "_" + e.milk_type + "_" + (e.shift || "morning");
            const dateKey = (e.sale_date
                ? String(e.sale_date).split("T")[0].slice(0, 10)
                : (e.created_at || "").split("T")[0].slice(0, 10));
            if (!sellerMap[key]) {
                sellerMap[key] = {
                    seller_id: e.seller_id || "",
                    buyer_id: e.buyer_id || "",
                    seller_code: e.seller_code || "",
                    name: e.registered_buyer_name || e.seller_name || e.buyer_name || "ANON",
                    milk_type: e.milk_type,
                    shift: e.shift || "morning",
                    entries: {},
                    totalQty: 0,
                    totalAmt: 0,
                    totalPaid: 0,
                    rate: parseFloat(e.mrp || 0),
                };
            }
            sellerMap[key].entries[dateKey] = (sellerMap[key].entries[dateKey] || 0) + parseFloat(e.quantity || 0);
            sellerMap[key].totalQty += parseFloat(e.quantity || 0);
            sellerMap[key].totalAmt += parseFloat(e.total_amount || 0);
            sellerMap[key].totalPaid += parseFloat(e.amount_paid ?? 0);
        });

        const sellersList = Object.values(sellerMap).sort((a, b) => {
            if (a.name === "ANON" && b.name !== "ANON") return 1;
            if (b.name === "ANON" && a.name !== "ANON") return -1;
            const nameCmp = a.name.localeCompare(b.name);
            if (nameCmp !== 0) return nameCmp;
            if (a.milk_type !== b.milk_type) return a.milk_type === "cow" ? -1 : 1;
            if (a.shift !== b.shift) return a.shift === "morning" ? -1 : 1;
            return 0;
        });

        // ── Person key → rowspan map ───────────────────────────────
        const personKeys = [];
        const personRowCount = {};   // rows per person (all milk types + shifts)
        sellersList.forEach(seller => {
            const personKey = seller.seller_id
                ? String(seller.seller_id)
                : seller.buyer_id
                    ? ("nb_" + String(seller.buyer_id))
                    : ("__" + seller.name);
            if (!personRowCount[personKey]) {
                personKeys.push(personKey);
                personRowCount[personKey] = 0;
            }
            personRowCount[personKey]++;
        });

        // ── Month / period labels ──────────────────────────────────
        const monthLabel = allDates.length > 0
            ? new Date(allDates[0] + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })
            : new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

        // ── Date header cells (day number only) ───────────────────
        const headerDateCols = allDates.map(d => {
            const dayNum = String(new Date(d + "T00:00:00").getDate()).padStart(2, "0");
            return `<th style="padding:3px 1px;border:1px solid #6b7280;font-size:7px;
            text-align:center;width:20px;color:#fff;background:#1e3a8a">${dayNum}</th>`;
        }).join("");

        const personRendered = {};
        const bodyRows = sellersList.map((seller, idx) => {
            // personKey for rowspan must NOT include milk_type or shift —
            // it must match exactly what personRowCount uses above
            const personKey = seller.seller_id
                ? String(seller.seller_id)
                : seller.buyer_id
                    ? ("nb_" + String(seller.buyer_id))
                    : ("__" + seller.name);
            const isFirstRow = !personRendered[personKey];
            if (isFirstRow) personRendered[personKey] = true;
            const rowspan = personRowCount[personKey];   // total rows for this person
            const isAnon = seller.name === "ANON";
            const milkBg = seller.milk_type === "cow" ? "#fffbeb" : "#eff6ff";
            const milkColor = seller.milk_type === "cow" ? "#92400e" : "#1d4ed8";
            const milkLabel = seller.milk_type === "cow" ? t('walkinSale.cow') : t('walkinSale.buffalo');
            const rowBg = idx % 2 === 0 ? "#fff" : "#f9fafb";
            const personIdx = personKeys.indexOf(personKey);

            // ── billing values ─────────────────────────────────────
            const bill = billingSummary[personKey] || {};
            const prevRemaining = bill.prev_remaining != null
                ? `₹${parseFloat(bill.prev_remaining).toFixed(2)}` : "—";
            const rowQty = allDates.reduce((s, d) => s + (seller.entries[d] || 0), 0);
            const totalAmount = bill.total_amount != null
                ? `₹${parseFloat(bill.total_amount).toFixed(2)}` : `₹${(rowQty * seller.rate).toFixed(2)}`;
            const receiptDate = bill.receipt_date
                ? new Date(String(bill.receipt_date).split("T")[0] + "T00:00:00")
                    .toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "2-digit" })
                : "—";
            const restAmount = bill.rest_amount != null
                ? `₹${parseFloat(bill.rest_amount).toFixed(2)}` : "—";

            const dateCells = allDates.map(dateStr => {
                const qty = seller.entries[dateStr];
                return `<td style="padding:2px 1px;border:1px solid #d1d5db;font-size:7px;
            text-align:center;color:#000;font-family:monospace;background:${rowBg}">
            ${qty ? (Number.isInteger(qty) ? qty : qty.toFixed(1)) : ""}
        </td>`;
            }).join("");

            return `<tr>
        ${isFirstRow ? `
        <td rowspan="${rowspan}" style="padding:2px 3px;border:1px solid #d1d5db;font-size:7px;
            text-align:center;color:#9ca3af;vertical-align:middle;background:#f9fafb">
            ${personIdx + 1}</td>
        <td rowspan="${rowspan}" style="padding:2px 5px;border:1px solid #d1d5db;font-size:8px;
            color:#000;font-weight:600;white-space:nowrap;vertical-align:middle;background:#f9fafb">
            ${isAnon
                        ? `<em style="color:#9ca3af;font-weight:400">${t('walkinSale.anonymous')}</em>`
                        : seller.name}
            ${seller.seller_id
                        ? `<div style="font-size:6px;color:#9ca3af;font-family:monospace">${seller.seller_id}</div>`
                        : ""}
        </td>` : ""}
        <td style="padding:2px 3px;border:1px solid #d1d5db;font-size:7px;text-align:center;
            background:${milkBg};color:${milkColor};font-weight:600">${milkLabel}</td>
        <td style="padding:2px 3px;border:1px solid #d1d5db;font-size:7px;text-align:center;
            background:${seller.shift === 'morning' ? '#fefce8' : '#eef2ff'};
            color:${seller.shift === 'morning' ? '#a16207' : '#4338ca'};font-weight:600">
            ${seller.shift === 'morning' ? 'M' : 'E'}</td>
        ${dateCells}
        <td style="padding:2px 4px;border:1px solid #93c5fd;font-size:8px;text-align:right;
            font-weight:700;color:#1d4ed8;background:#dbeafe">${allDates.reduce((s, d) => s + (seller.entries[d] || 0), 0).toFixed(1)}</td>
        <td style="padding:2px 4px;border:1px solid #d1d5db;font-size:7.5px;text-align:right;
            color:#374151;background:${rowBg}">₹${seller.rate.toFixed(0)}</td>
        <td style="padding:2px 4px;border:1px solid #6b7280;font-size:8px;text-align:right;
            font-weight:700;color:#000;background:#e5e7eb">₹${(allDates.reduce((s, d) => s + (seller.entries[d] || 0), 0) * seller.rate).toFixed(0)}</td>
        ${isFirstRow ? `
        <td rowspan="${rowspan}" style="padding:2px 4px;border:1px solid #fca5a5;font-size:8px;
            text-align:right;background:#fef2f2;color:#b91c1c;font-weight:600;vertical-align:middle">
            ${prevRemaining}</td>
        <td rowspan="${rowspan}" style="padding:2px 4px;border:1px solid #6b7280;font-size:8px;
            text-align:right;font-weight:800;color:#000;background:#e5e7eb;vertical-align:middle">
            ${totalAmount}</td>
        <td rowspan="${rowspan}" style="padding:2px 4px;border:1px solid #d1d5db;font-size:7px;
            text-align:center;color:#374151;font-family:monospace;vertical-align:middle;white-space:nowrap">
            ${receiptDate}</td>
        <td rowspan="${rowspan}" style="padding:2px 4px;border:1px solid #fde68a;font-size:8px;
            text-align:right;font-weight:700;background:#fefce8;color:#92400e;vertical-align:middle">
            ${restAmount}</td>
        ` : ""}
    </tr>`;
        }).join("");

        // ── Grand total row ────────────────────────────────────────
        const dateTotals = allDates.map(dateStr => {
            const sum = sellersList.reduce((a, s) => a + (s.entries[dateStr] || 0), 0);
            return `<td style="padding:3px 1px;border:1px solid #6b7280;font-size:7px;text-align:center;
            font-weight:700;color:#fff;background:#1e293b">${sum > 0 ? sum.toFixed(1) : ""}</td>`;
        }).join("");

        const grandTotalQty = sellersList.reduce((a, s) => a + allDates.reduce((sum, d) => sum + (s.entries[d] || 0), 0), 0);
        const grandTotalAmt = sellersList.reduce((a, s) => a + allDates.reduce((sum, d) => sum + (s.entries[d] || 0), 0) * s.rate, 0);
        // ── Write HTML ─────────────────────────────────────────────
        win.document.write(`<!DOCTYPE html><html><head>
<title>${t('walkinSale.pdfTitle')} — ${modeLabel} — ${periodLabel}</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 8px; color: #000; margin: 0; padding: 10px; background: #fff; }
    table { border-collapse: collapse; width: 100%; table-layout: auto; }
    th, td { vertical-align: middle; }
    @media print {
        @page { margin: 6mm; size: A4 landscape; }
        body { padding: 0; }
        .no-print { display: none; }
    }
    @media screen { body { max-width: 297mm; margin: 0 auto; } }
</style>
</head><body>

<!-- ── Header ────────────────────────────────────────────── -->
<div style="display:flex;align-items:flex-start;justify-content:space-between;
    margin-bottom:8px;padding-bottom:6px;border-bottom:2.5px double #1e3a8a">

    <div style="display:flex;align-items:center;gap:10px">
        <div style="font-size:28px"></div>
        <div>
            <div style="font-size:15px;font-weight:900;color:#1e3a8a;letter-spacing:0.5px">
                ${t('walkinSale.pdfTitle')}</div>
            <div style="font-size:9px;color:#374151;margin-top:1px">
                ${modeLabel} ${t('walkinSale.pdfReport')} · ${buyerLabel}</div>
        </div>
    </div>

    <div style="text-align:center">
        <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px">
            ${t('walkinSale.pdfGenerated')}</div>
        <div style="font-size:13px;font-weight:800;color:#111">${monthLabel}</div>
        <div style="font-size:8px;color:#6b7280;margin-top:1px">${periodLabel}</div>
    </div>

    <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;max-width:320px">
        ${[
                { label: t('walkinSale.cowSold'), val: (grandQty["cow"] || 0).toFixed(1) + " L", bg: "#fffbeb", border: "#fde68a", color: "#d97706" },
                { label: t('walkinSale.buffaloSold'), val: (grandQty["buffalo"] || 0).toFixed(1) + " L", bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
                { label: t('walkinSale.totalSales'), val: data.length, bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
                { label: t('walkinSale.cash'), val: "₹" + cashAmt.toFixed(0), bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
                { label: t('walkinSale.upi'), val: "₹" + upiAmt.toFixed(0), bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
                { label: t('walkinSale.credit'), val: "₹" + creditAmt.toFixed(0), bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" },
                { label: t('walkinSale.totalRevenue'), val: "₹" + totalAmt.toFixed(0), bg: "#f1f5f9", border: "#94a3b8", color: "#0f172a" },
            ].map(({ label, val, bg, border, color }) =>
                `<div style="background:${bg};border:1px solid ${border};padding:3px 8px;
                border-radius:4px;text-align:center;min-width:52px">
                <div style="font-size:6.5px;color:#6b7280;font-weight:600;text-transform:uppercase;
                    letter-spacing:0.3px">${label}</div>
                <div style="font-size:11px;font-weight:800;color:${color};line-height:1.2">${val}</div>
            </div>`
            ).join("")}
    </div>
</div>

<!-- ── Register Table ─────────────────────────────────────── -->
<table>
    <thead>
        <tr style="background:#1e3a8a;color:#fff">
            <th colspan="2" style="padding:4px 5px;border:1px solid #3b4f9a;font-size:8px;text-align:left">
                ${t('walkinSale.customerName')}</th>
            <th style="padding:4px 3px;border:1px solid #3b4f9a;font-size:8px;text-align:center">
                ${t('walkinSale.milkType')}</th>
            <th style="padding:4px 3px;border:1px solid #3b4f9a;font-size:8px;text-align:center">
                ${t('walkinSale.shift')}</th>
            <th colspan="${allDates.length}" style="padding:4px 5px;border:1px solid #3b4f9a;
                font-size:8px;text-align:center">${monthLabel}</th>
            <th colspan="3" style="padding:4px 5px;border:1px solid #3b4f9a;font-size:8px;
                text-align:center;background:#1e40af">${t('walkinSale.milkTotal')}</th>
<th colspan="4" style="padding:4px 5px;border:1px solid #3b4f9a;font-size:8px;
                text-align:center;background:#064e3b;color:#a7f3d0">${t('walkinSale.billingSection')}</th>
        </tr>
        <tr style="background:#1e3a8a;color:#fff">
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:18px;text-align:center">#</th>
            <th style="padding:3px 4px;border:1px solid #3b4f9a;font-size:7px;width:90px;text-align:left">
                ${t('walkinSale.customerName')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:28px;text-align:center">
                ${t('walkinSale.milkType')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:22px;text-align:center">
                ${t('walkinSale.shift')}</th>
            ${headerDateCols}
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:32px;
                text-align:right;background:#1e40af">${t('walkinSale.totalLtr')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:28px;
                text-align:right">${t('walkinSale.rate')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:40px;
                text-align:right;background:#374151">${t('walkinSale.milkAmt')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:40px;
                text-align:right;background:#7f1d1d;color:#fecaca">${t('walkinSale.prevRemaining')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:45px;
                text-align:right;background:#374151">${t('walkinSale.totalAmt')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:42px;
                text-align:center;background:#1e3a5f">${t('walkinSale.receiptDate')}</th>
            <th style="padding:3px 2px;border:1px solid #3b4f9a;font-size:7px;width:42px;
                text-align:right;background:#713f12;color:#fde68a">${t('walkinSale.balance')}</th>
        </tr>
    </thead>
    <tbody>
        ${bodyRows}
        <tr style="background:#1e293b;color:#fff;font-weight:bold">
            <td colspan="4" style="padding:4px 5px;border:1px solid #4b5563;font-size:8px;
                text-align:right">${t('walkinSale.grandTotal')}</td>
            ${dateTotals}
            <td style="padding:4px 4px;border:1px solid #3b82f6;font-size:8px;text-align:right;
                background:#1e40af;font-weight:800">${grandTotalQty.toFixed(1)}</td>
            <td style="padding:4px 4px;border:1px solid #4b5563;font-size:7px;
                text-align:center">—</td>
            <td style="padding:4px 4px;border:1px solid #4b5563;font-size:8px;text-align:right;
                background:#374151;font-weight:800">₹${grandTotalAmt.toFixed(2)}</td>
<td colspan="4" style="padding:4px 5px;border:1px solid #4b5563;font-size:7px;
                text-align:center;color:#9ca3af"></td>
        </tr>
    </tbody>
</table>

<!-- ── Footer ────────────────────────────────────────────── -->
<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;
    font-size:8px;color:#94a3b8;border-top:1px solid #e5e7eb;padding-top:6px">
    <span>${t('walkinSale.pdfFooter')} · ${new Date().toLocaleString("en-IN", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true
            })}</span>
    <div style="text-align:center">
        <div style="width:120px;border-top:1px solid #374151;margin-bottom:3px"></div>
        <span style="color:#374151">${t('walkinSale.pdfSignatory')}</span>
    </div>
</div>

<script>window.onload = () => { window.print(); };</script>
</body></html>`);
        win.document.close();
    };

    const filteredSales = sales.filter(s => {
        const matchName = !searchName.trim() ||
            (s.buyer_name || "").toLowerCase().includes(searchName.toLowerCase());

        const isSeller = s.seller_id !== null && s.seller_id !== undefined && s.seller_id !== "";
        const isAnon = s.buyer_name === "ANON";
        const isNamed = !isAnon && !isSeller;

        const matchBuyer =
            filterBuyerType === "all" ? true :
                filterBuyerType === "anon" ? isAnon :
                    filterBuyerType === "seller" ? isSeller :
                        isNamed;

        return matchName && matchBuyer;
    });

    const totalPages = Math.ceil(filteredSales.length / pageSize);
    const paginatedSales = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const COLS = [
        t('walkinSale.colBuyer'), t('walkinSale.colMilk'), t('walkinSale.colQty'),
        t('walkinSale.colMrp'), t('walkinSale.colAmount'), t('walkinSale.colPayment'),
        t('walkinSale.colShift'), t('walkinSale.colTime'), ""
    ];
    const GRID = "1.4fr 90px 75px 80px 95px 90px 100px 70px 72px";

    const totalQty = sales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0);
    const totalRevenue = sales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);

    // ── Render ─────────────────────────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('walkin_sales', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <ShoppingCart size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('walkinSale.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('walkinSale.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('walkinSale.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") {
                                        setFromDate(d);
                                        setToDate(d);
                                        fetchSales(d, d);
                                    }
                                    else if (rangeMode === "weekly") {
                                        const r = getWeekRange(d);
                                        setFromDate(r.from);
                                        setToDate(r.to);
                                        fetchRangeEntries(r.from, r.to);
                                    }
                                    else if (rangeMode === "monthly") {
                                        const r = getMonthRange(d);
                                        setFromDate(r.from);
                                        setToDate(r.to);
                                        fetchRangeEntries(r.from, r.to);
                                    }
                                }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('walkinSale.downloadPDF')}</span>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[
                                        { v: "daily", l: t('walkinSale.day') },
                                        { v: "weekly", l: t('walkinSale.week') },
                                        { v: "monthly", l: t('walkinSale.month') },
                                        { v: "custom", l: t('walkinSale.custom') }
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate} onChange={e => { const v = e.target.value; setFromDate(v); setPdfReady(false); fetchRangeEntries(v, toDate); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate} onChange={e => { const v = e.target.value; setToDate(v); setPdfReady(false); fetchRangeEntries(fromDate, v); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap hidden sm:inline">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </span>
                                )}

                                {loadingRange ? (
                                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold">
                                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /></svg>
                                        {t('dashboard.loading')}
                                    </div>
                                ) : (
<button onClick={handleDownloadPDF} disabled={loadingRange}                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black text-white text-xs font-semibold hover:bg-gray-800 disabled:opacity-40 transition">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                                        PDF
                                    </button>
                                )}
                            </div>
                        </div>

                        <button onClick={() => { setEditingMrp(false); setShowMrpModal(true); }}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 mt-4">
                            <Settings size={13} /> {t('walkinSale.mrpRates')}
                        </button>
                        <button onClick={() => setShowProductModal(true)}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 mt-4">
                            <Milk size={13} /> Products
                        </button>

                       {/* AFTER the Products button */}
                        {namedBuyerSummaries.filter(b => b.outstanding > 0).length > 0 && (
                            <button onClick={() => setShowClearBillModal(true)}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition bg-rose-500 text-white hover:bg-rose-600 mt-4">
                                <Banknote size={13} /> Clear Bills ({namedBuyerSummaries.filter(b => b.outstanding > 0).length})
                            </button>
                        )}
                        <button onClick={startWalkinSalesTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl transition bg-gray-100 text-gray-600 hover:bg-gray-200 mt-4">
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                    </div>
                </div>

                {/* MRP Rates Modal */}
                {showMrpModal && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm shadow-xl p-6 flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <Settings size={15} className="text-gray-500" /> {t('walkinSale.mrpSettings')}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">{t('walkinSale.mrpDesc')}</p>
                                </div>
                                <button onClick={() => { setShowMrpModal(false); setEditingMrp(false); fetchMRPRates(); }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                        <Milk size={12} className="text-amber-600" /> {t('walkinSale.cowMrp')}
                                    </label>
                                    <input
                                        type="number"
                                        value={mrpRates.cow}
                                        onChange={(e) => setMrpRates(prev => ({ ...prev, cow: e.target.value }))}
                                        placeholder="₹0.00"
                                        step="0.01"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                        <Milk size={12} className="text-blue-600" /> {t('walkinSale.buffaloMrp')}
                                    </label>
                                    <input
                                        type="number"
                                        value={mrpRates.buffalo}
                                        onChange={(e) => setMrpRates(prev => ({ ...prev, buffalo: e.target.value }))}
                                        placeholder="₹0.00"
                                        step="0.01"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button onClick={() => { setShowMrpModal(false); setEditingMrp(false); fetchMRPRates(); }}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    {t('walkinSale.cancel')}
                                </button>
                                <button onClick={async () => { await saveMRPRates(); setShowMrpModal(false); }}
                                    disabled={savingMrp}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                    {savingMrp && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {savingMrp ? t('walkinSale.saving') : t('walkinSale.saveRates')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                
                {/* Product Types Modal */}
                {showProductModal && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <Milk size={15} className="text-gray-500" /> Product Types
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">Register loose/packaged milk products. Packaged adds extra rate on top of base MRP.</p>
                                </div>
                                <button onClick={() => setShowProductModal(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Add new product */}
                            <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Add product type</p>
                                <TinyInput
                                    value={newProduct.name}
                                    onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Loose Milk, 500ml Packet"
                                    className="w-full"
                                />
                                <div className="flex gap-2">
                                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold flex-1">
                                        {["loose", "packaged"].map(t => (
                                            <button key={t} type="button"
                                                onClick={() => setNewProduct(p => ({ ...p, type: t }))}
                                                className={`flex-1 py-[7px] transition ${newProduct.type === t ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                                {t === 'loose' ? '🥛 Loose' : '📦 Packaged'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                        {[{ v: "both", l: "Both" }, { v: "cow", l: " Cow" }, { v: "buffalo", l: " Buf" }].map(({ v, l }) => (
                                            <button key={v} type="button"
                                                onClick={() => setNewProduct(p => ({ ...p, milk_type: v }))}
                                                className={`px-2 py-[7px] transition border-r last:border-r-0 border-gray-200 ${newProduct.milk_type === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {newProduct.type === 'packaged' && (
                                    <TinyInput
                                        value={newProduct.extra_rate}
                                        onChange={e => setNewProduct(p => ({ ...p, extra_rate: e.target.value }))}
                                        placeholder="Extra rate per litre (₹)"
                                        type="number"
                                        step="0.50"
                                        className="w-full"
                                    />
                                )}
                                <button onClick={saveProductType} disabled={savingProduct || !newProduct.name}
                                    className="py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2">
                                    {savingProduct && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    Save Product Type
                                </button>
                            </div>

                            {/* Existing product types */}
                            {productTypes.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Registered types</p>
                                    {productTypes.map(p => (
                                        <div key={p.product_type_id} className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-gray-200 bg-white">
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{p.name}</p>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    {p.type === 'packaged' ? `📦 Packaged · +₹${p.extra_rate}/L` : '🥛 Loose'} ·{' '}
                                                    {p.milk_type === 'both' ? 'Both milk types' : p.milk_type === 'cow' ? ' Cow only' : ' Buffalo only'}
                                                </p>
                                            </div>
                                            <button onClick={() => deleteProductType(p.product_type_id)}
                                                className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-rose-100 text-gray-400 hover:text-rose-600 transition">
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Clear Bill Modal */}
                {showClearBillModal && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <Banknote size={15} className="text-rose-500" /> Clear Buyer Bills
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Select a buyer and enter amount paid. Remaining will carry forward.
                                    </p>
                                </div>
                                <button onClick={() => { setShowClearBillModal(false); setClearBillBuyer(null); setClearBillAmount(""); }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Buyer list with outstanding balances */}
                            <div className="flex flex-col gap-2">
                                {namedBuyerSummaries.filter(b => b.outstanding > 0).map(b => (
                                    <button key={b.buyer_id} type="button"
                                        onClick={() => { setClearBillBuyer(b); setClearBillAmount(String(b.outstanding.toFixed(2))); }}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-left transition
                            ${clearBillBuyer?.buyer_id === b.buyer_id
                                                ? "border-rose-300 bg-rose-50"
                                                : "border-gray-200 bg-white hover:border-gray-300"}`}>
                                        <div>
                                            <p className="text-sm font-semibold text-gray-800">{b.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">
                                                Total: ₹{parseFloat(b.total_amount).toFixed(2)} · Paid: ₹{parseFloat(b.total_paid).toFixed(2)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-bold text-rose-600">₹{parseFloat(b.outstanding).toFixed(2)}</p>
                                            <p className="text-[10px] text-gray-400">outstanding</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Payment input */}
                            {clearBillBuyer && (
                                <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <p className="text-xs font-semibold text-gray-600">
                                        Clearing bill for <strong>{clearBillBuyer.name}</strong> — Outstanding: ₹{clearBillBuyer.outstanding.toFixed(2)}
                                    </p>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            Amount Paid
                                        </label>
                                        <TinyInput
                                            value={clearBillAmount}
                                            onChange={e => setClearBillAmount(e.target.value)}
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={clearBillBuyer.outstanding}
                                            placeholder="₹0.00"
                                            className="w-full"
                                        />
                                    </div>
                                    {clearBillAmount && parseFloat(clearBillAmount) < clearBillBuyer.outstanding && (
                                        <p className="text-xs text-amber-600 font-medium">
                                            ₹{(clearBillBuyer.outstanding - parseFloat(clearBillAmount)).toFixed(2)} will carry forward as previous balance
                                        </p>
                                    )}
                                    {clearBillAmount && parseFloat(clearBillAmount) >= clearBillBuyer.outstanding && (
                                        <p className="text-xs text-emerald-600 font-medium">
                                            Bill fully cleared ✓
                                        </p>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button onClick={() => { setShowClearBillModal(false); setClearBillBuyer(null); setClearBillAmount(""); }}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                                <button onClick={handleClearBill}
                                    disabled={clearingBill || !clearBillBuyer || !clearBillAmount || parseFloat(clearBillAmount) <= 0}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-40 flex items-center justify-center gap-2">
                                    {clearingBill && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {clearingBill ? "Clearing…" : "Clear Bill"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="sales-stats">
                    {[
                        { label: t('walkinSale.salesToday'), value: sales.length, icon: <ShoppingCart size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('walkinSale.cowSold'), value: `${sales.filter(s => s.milk_type === "cow").reduce((a, s) => a + parseFloat(s.quantity || 0), 0).toFixed(1)} L`, icon: <Milk size={14} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                        { label: t('walkinSale.buffaloSold'), value: `${sales.filter(s => s.milk_type === "buffalo").reduce((a, s) => a + parseFloat(s.quantity || 0), 0).toFixed(1)} L`, icon: <Milk size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('walkinSale.totalRevenue'), value: `₹${totalRevenue.toFixed(2)}`, icon: <TrendingUp size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                            <div className="shrink-0">{icon}</div>
                            <div>
                                <p className="text-xs text-gray-400 leading-none">{label}</p>
                                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Flash Message */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Entry Form */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t('walkinSale.newSale')}</p>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                                <Milk size={11} className="text-amber-500" />
                                <span className="text-gray-400">{t('walkinSale.cowMrp')}:</span>
                                <span className="font-semibold text-gray-700">₹{parseFloat(mrpRates.cow || 0).toFixed(2)}</span>
                            </span>
                            <span className="text-gray-200">|</span>
                            <span className="flex items-center gap-1">
                                <Milk size={11} className="text-blue-500" />
                                <span className="text-gray-400">{t('walkinSale.buffaloMrp')}:</span>
                                <span className="font-semibold text-gray-700">₹{parseFloat(mrpRates.buffalo || 0).toFixed(2)}</span>
                            </span>
                        </div>
                    </div>

                  {/* Buyer Mode Selector */}
                    <div className="flex gap-2 mb-5" data-tour="buyer-modes">
                        {BUYER_MODES.map(({ val, label, emoji, desc }) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => handleBuyerModeChange(val)}
                                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-semibold transition
                                    ${form.buyer_mode === val ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300"}`}
                            >
                                <span className="text-lg">{emoji}</span>
                                <span>{label}</span>
                                <span className="text-[10px] font-normal text-gray-400">{desc}</span>
                            </button>
                        ))}
                    </div>

                    {/* Form Inputs */}
                    <div className="flex items-start gap-3 flex-wrap" onKeyDown={handleFormKeyDown}>
                        {/* Anonymous Buyer */}
                        {form.buyer_mode === "anon" && (
                            <Field label={t('walkinSale.buyer')} icon={<User size={12} />}>
                                <div className="h-[35px] px-3 flex items-center rounded-xl bg-gray-100 border border-gray-200 text-gray-400 text-sm font-medium w-28">
                                    👤 {t('walkinSale.anonymous')}
                                </div>
                            </Field>
                        )}

                        {/* Named Buyer */}
                        {/* Named Buyer — searchable dropdown like seller */}
                        {form.buyer_mode === "named" && (
                            <Field label={t('walkinSale.buyerName')} icon={<User size={12} />}>
                                <div className="relative w-44">
                                    <TinyInput
                                        value={namedBuyerSearch}
                                        onFocus={() => { setNamedBuyerDropdownOpen(true); setNamedBuyerHighlight(-1); }}
                                        onBlur={() => setTimeout(() => setNamedBuyerDropdownOpen(false), 150)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setNamedBuyerSearch(val);
                                            set("buyer_name", val);
                                            set("buyer_id", "");
                                            setBuyerBalance(0);
                                            setAmountPaid("");
                                            setNamedBuyerDropdownOpen(true);
                                            setNamedBuyerHighlight(-1);
                                        }}
                                        onKeyDown={(e) => {
                                            const filtered = namedBuyers.filter(b =>
                                                b.name.toLowerCase().includes(namedBuyerSearch.toLowerCase())
                                            );
                                            if (e.key === "ArrowDown") { e.preventDefault(); setNamedBuyerHighlight(i => Math.min(i + 1, filtered.length)); }
                                            else if (e.key === "ArrowUp") { e.preventDefault(); setNamedBuyerHighlight(i => Math.max(i - 1, 0)); }
                                            else if (e.key === "Enter") {
                                                e.preventDefault();
                                                if (namedBuyerHighlight === filtered.length) {
                                                    // "Register new" option
                                                    saveNamedBuyer(namedBuyerSearch.trim()).then(nb => {
                                                        if (nb) { set("buyer_id", nb.buyer_id); set("buyer_name", nb.name); setNamedBuyerSearch(nb.name); fetchBuyerBalance(nb.buyer_id); }
                                                    });
                                                    setNamedBuyerDropdownOpen(false);
                                                } else {
                                                    const sel = namedBuyerHighlight >= 0 ? filtered[namedBuyerHighlight] : filtered[0];
                                                    if (sel) { set("buyer_id", sel.buyer_id); set("buyer_name", sel.name); setNamedBuyerSearch(sel.name); fetchBuyerBalance(sel.buyer_id); setNamedBuyerDropdownOpen(false); }
                                                }
                                            } else if (e.key === "Escape") setNamedBuyerDropdownOpen(false);
                                        }}
                                        placeholder="Search or add buyer..."
                                        className="w-44 pr-7"
                                    />
                                    {namedBuyerDropdownOpen && (() => {
                                        const filtered = namedBuyers.filter(b =>
                                            !namedBuyerSearch || b.name.toLowerCase().includes(namedBuyerSearch.toLowerCase())
                                        );
                                        const showRegister = namedBuyerSearch.trim() && !namedBuyers.find(b => b.name.toLowerCase() === namedBuyerSearch.toLowerCase());
                                        return (filtered.length > 0 || showRegister) ? (
                                            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                                <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                    {namedBuyerSearch ? `${filtered.length} match${filtered.length !== 1 ? 'es' : ''}` : 'Registered buyers'}
                                                </p>
                                                {filtered.map((b, idx) => (
                                                    <button key={b.buyer_id} type="button"
                                                        onMouseEnter={() => setNamedBuyerHighlight(idx)}
                                                        onClick={() => { set("buyer_id", b.buyer_id); set("buyer_name", b.name); setNamedBuyerSearch(b.name); fetchBuyerBalance(b.buyer_id); setNamedBuyerDropdownOpen(false); }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition ${namedBuyerHighlight === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${namedBuyerHighlight === idx ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                                                            {b.name?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                        <span className="font-medium text-gray-800 text-xs">{b.name}</span>
                                                    </button>
                                                ))}
                                                {showRegister && (
                                                    <button type="button"
                                                        onMouseEnter={() => setNamedBuyerHighlight(filtered.length)}
                                                        onClick={async () => {
                                                            const nb = await saveNamedBuyer(namedBuyerSearch.trim());
                                                            if (nb) { set("buyer_id", nb.buyer_id); set("buyer_name", nb.name); setNamedBuyerSearch(nb.name); fetchBuyerBalance(nb.buyer_id); }
                                                            setNamedBuyerDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-t border-gray-100 transition ${namedBuyerHighlight === filtered.length ? "bg-emerald-50" : "hover:bg-emerald-50"}`}>
                                                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">+</div>
                                                        <span className="font-medium text-emerald-700 text-xs">Register "{namedBuyerSearch}"</span>
                                                    </button>
                                                )}
                                            </div>
                                        ) : null;
                                    })()}
                                    {form.buyer_id && (
                                        <button type="button"
                                            onClick={() => { set("buyer_id", ""); set("buyer_name", ""); setNamedBuyerSearch(""); setBuyerBalance(0); setAmountPaid(""); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {buyerBalance > 0 && (
                                    <p className="text-[10px] text-rose-500 font-semibold mt-1">
                                        ₹{buyerBalance.toFixed(2)} previous balance
                                    </p>
                                )}
                            </Field>
                        )}

                        {/* Seller Buyer */}
                        {form.buyer_mode === "seller" && (
                            <Field label={t('walkinSale.sellerLabel')} icon={<Users size={12} />}>
                                <div className="relative w-36">
                                    <TinyInput
                                        value={sellerSearch}
                                        onFocus={() => { setDropdownOpen(true); setHighlightedIdx(-1); }}
                                        onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                                        onChange={(e) => handleSellerSearchChange(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (!dropdownOpen || filteredSellers.length === 0) return;
                                            if (e.key === "ArrowDown") {
                                                e.preventDefault();
                                                setHighlightedIdx(i => Math.min(i + 1, filteredSellers.length - 1));
                                            } else if (e.key === "ArrowUp") {
                                                e.preventDefault();
                                                setHighlightedIdx(i => Math.max(i - 1, 0));
                                            } else if (e.key === "Enter") {
                                                e.preventDefault();
                                                const sel = highlightedIdx >= 0 ? filteredSellers[highlightedIdx] : filteredSellers[0];
                                                if (sel) {
                                                    set("seller_id", sel.seller_id);
                                                    set("buyer_name", sel.name);
                                                    setSellerSearch(sel.name);
                                                    setDropdownOpen(false);
                                                }
                                            } else if (e.key === "Escape") {
                                                setDropdownOpen(false);
                                            }
                                        }}
                                        placeholder={t('walkinSale.searchPlaceholder')}
                                        className="w-36 pr-7"
                                    />
                                    {dropdownOpen && !form.seller_id && filteredSellers.length > 0 && (
                                        <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                            <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                                {sellerSearch.trim() ? `${filteredSellers.length} ${filteredSellers.length !== 1 ? t('walkinSale.matchesPlural') : t('walkinSale.matches')}` : t('walkinSale.sellersAZ')}
                                            </p>
                                            {filteredSellers.map((s, idx) => (
                                                <button
                                                    key={s.seller_id}
                                                    type="button"
                                                    onMouseEnter={() => setHighlightedIdx(idx)}
                                                    onClick={() => {
                                                        set("seller_id", s.seller_id);
                                                        set("buyer_name", s.name);
                                                        setSellerSearch(s.name);
                                                        setDropdownOpen(false);
                                                    }}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition
                                                    ${highlightedIdx === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}
                                                >
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition
                                                    ${highlightedIdx === idx ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
                                                        {s.name?.charAt(0)?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-gray-800 text-xs">{s.name}</p>
                                                        <p className="text-[10px] text-gray-400 font-mono">{s.seller_code}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    {form.seller_id && (
                                        <button
                                            type="button"
                                            onClick={() => { set("seller_id", ""); set("buyer_name", ""); setSellerSearch(""); setDropdownOpen(false); }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                                {selectedSeller && (
                                    <p className="text-[10px] text-emerald-600 font-medium mt-1">
                                        🧑‍ {selectedSeller.seller_code} · {selectedSeller.seller_type || "—"}
                                    </p>
                                )}
                            </Field>
                        )}

                        {/* Shift */}
                        <Field label={t('walkinSale.shiftLabel')} icon={form.shift === "morning" ? <Sun size={12} /> : <Moon size={12} />}>
                            <ShiftToggle value={form.shift} onChange={(v) => set("shift", v)} t={t} />
                        </Field>

                        {/* Milk Type */}
                        <Field label={t('walkinSale.milkLabel')} icon={<Milk size={12} />}>
                            <MilkTypeToggle
                                value={form.milk_type}
                                onChange={(v) => {
                                    set("milk_type", v);
                                    set("mrp", v === 'cow' ? mrpRates.cow : mrpRates.buffalo);
                                }}
                                t={t}
                            />
                        </Field>

                        {/* Quantity */}
                        <Field label={availableStock ? t('walkinSale.qtyLabel') : t('walkinSale.qtyLabel')}>
                            <TinyInput
                                value={form.quantity}
                                onChange={(e) => set("quantity", e.target.value)}
                                placeholder="0.0"
                                type="number"
                                step="0.01"
                                className={`w-20 ${availableStock && parseFloat(form.quantity) > (form.milk_type === 'cow' ? availableStock.cow : availableStock.buffalo)
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                    }`}
                            />
                            {availableStock && (
                                <p className={`text-[10px] font-medium mt-0.5 ${(form.milk_type === 'cow' ? availableStock.cow : availableStock.buffalo) <= 0
                                    ? 'text-rose-500' : 'text-emerald-600'
                                    }`}>
                                    {form.milk_type === 'cow' ? availableStock.cow : availableStock.buffalo} L {t('walkinSale.left')}
                                </p>
                            )}
                        </Field>

                        {/* MRP */}
                        <Field label={t('walkinSale.mrpLabel')}>
                            <TinyInput
                                value={form.mrp}
                                onChange={(e) => set("mrp", e.target.value)}
                                placeholder="₹0.00"
                                type="number"
                                step="0.01"
                                className="w-20 bg-gray-50 border-gray-200"
                            />
                        </Field>

                        {/* Product Type */}
                        <Field label="Product" icon={<Milk size={12} />}>
                            <select
                                value={form.product_type_id}
                                onChange={(e) => {
                                    const ptId = e.target.value;
                                    set("product_type_id", ptId);
                                    const pt = productTypes.find(p => String(p.product_type_id) === ptId);
                                    if (pt) set("product_type", pt.type);
                                    else set("product_type", "loose");
                                }}
                                className="border border-gray-200 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-36"
                            >
                                <option value="">Default (Loose)</option>
                                {productTypes
                                    .filter(p => p.milk_type === 'both' || p.milk_type === form.milk_type)
                                    .map(p => (
                                        <option key={p.product_type_id} value={p.product_type_id}>
                                            {p.name} {p.type === 'packaged' ? `(+₹${p.extra_rate})` : ''}
                                        </option>
                                    ))
                                }
                            </select>
                            {form.product_type === 'packaged' && selectedProductType && (
                                <p className="text-[10px] text-blue-600 font-medium mt-0.5">
                                    Rate: ₹{(parseFloat(form.mrp || 0) + parseFloat(selectedProductType.extra_rate || 0)).toFixed(2)}/L
                                </p>
                            )}
                        </Field>

                        {/* Amount Paid (partial payment — only for named buyers) */}
                        {form.buyer_mode === "named" && form.buyer_id && amount && (
                            <Field label="Amt Paid">
                                <TinyInput
                                    value={amountPaid}
                                    onChange={(e) => setAmountPaid(e.target.value)}
                                    placeholder={`₹${amount}`}
                                    type="number"
                                    step="0.01"
                                    className="w-24 bg-amber-50 border-amber-200 text-amber-800"
                                />
                                {amountPaid && parseFloat(amountPaid) < parseFloat(amount) && (
                                    <p className="text-[10px] text-rose-500 font-medium mt-0.5">
                                        ₹{(parseFloat(amount) - parseFloat(amountPaid)).toFixed(2)} pending
                                    </p>
                                )}
                            </Field>
                        )}

                        {/* Payment Mode */}
                        {/* Payment Mode — only show when paying now */}
                        {form.pay_now && (
                            <Field label={t('walkinSale.paymentLabel')} icon={<Banknote size={12} />}>
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {PAYMENT_MODES.map(({ val, label, icon, active }) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => set("payment_mode", val)}
                                            className={`flex items-center gap-1 px-2 py-[7px] border-r last:border-r-0 border-gray-200 transition-colors
                    ${form.payment_mode === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                        >
                                            {icon} {label}
                                        </button>
                                    ))}
                                </div>
                            </Field>
                        )}
                        {/* Pay Now / Pay After toggle — show for all modes */}
                        <Field label="Payment" icon={<Banknote size={12} />}>
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold" data-tour="payment-toggle">
                                <button
                                    type="button"
                                    onClick={() => { set("pay_now", true); set("payment_mode", "cash"); }}
                                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                ${form.pay_now ? "bg-emerald-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                >
                                    <CheckCircle2 size={12} /> Pay Now
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { set("pay_now", false); set("payment_mode", "credit"); }}
                                    className={`flex items-center gap-1.5 px-3 py-[7px] transition-colors
                ${!form.pay_now ? "bg-orange-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                >
                                    <Clock size={12} /> Pay After
                                </button>
                            </div>
                        </Field>
                        {/* Amount */}
                        {amount && (
                            <Field label={t('walkinSale.amountLabel')}>
                                <div className="h-[35px] px-4 flex items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm whitespace-nowrap">
                                    ₹{amount}
                                </div>
                            </Field>
                        )}
                    </div>

                    {/* Form Footer */}
                    {/* Form Footer */}
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            {editingSaleId
                                ? <span className="text-amber-600 font-medium">✏️ Editing sale #{editingSaleId}</span>
                                : <>{sales.length} {sales.length === 1 ? t('walkinSale.sale') : t('walkinSale.sales')} {t('walkinSale.on')}{" "}
                                    {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    {" · "}{t('walkinSale.total')}: <span className="font-semibold text-gray-600">₹{totalRevenue.toFixed(2)}</span></>
                            }
                        </p>
                        <div className="flex items-center gap-2">
                            {editingSaleId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingSaleId(null);
                                        const currentBuyerMode = form.buyer_mode;
                                        const currentMilkType = form.milk_type;
                                        const currentPayNow = form.pay_now;
                                        setForm({
                                            ...EMPTY_FORM,
                                            shift: getShiftByTime(),
                                            milk_type: currentMilkType,
                                            buyer_mode: currentBuyerMode,
                                            pay_now: currentPayNow,
                                            payment_mode: currentPayNow ? "cash" : "credit",
                                            mrp: currentMilkType === 'cow' ? mrpRates.cow : mrpRates.buffalo,
                                            buyer_name: currentBuyerMode === "anon" ? "ANON" : "",
                                        });
                                        setAmountPaid("");
                                        setBuyerBalance(0);
                                        if (currentBuyerMode === "anon") {
                                            setNamedBuyerSearch("");
                                            setSellerSearch("");
                                        }
                                    }}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 transition"
                                >
                                    <X size={14} /> Cancel Edit
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                data-tour="save-btn"
                                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                ${saving ? "bg-gray-300 cursor-not-allowed"
                                        : editingSaleId ? "bg-amber-500 hover:bg-amber-600 active:scale-95"
                                            : "bg-black hover:bg-gray-800 active:scale-95"}`}
                            >
                                <Save size={15} />
                                {saving ? t('walkinSale.saving') : editingSaleId ? "Update Sale" : t('walkinSale.recordSale')}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sales Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="sales-table">
                    {/* Search + filter bar */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex-wrap">
                        <input
                            type="text"
                            value={searchName}
                            onChange={e => { setSearchName(e.target.value); setCurrentPage(1); }}
                            placeholder={t('walkinSale.filterPlaceholder')}
                            className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs text-gray-800 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black transition w-48"
                        />
                        {searchName && (
                            <button onClick={() => { setSearchName(""); setCurrentPage(1); }}
                                className="text-gray-400 hover:text-gray-600 transition">
                                <X size={13} />
                            </button>
                        )}

                        {/* Buyer Type Filter */}
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                            {[
                                { v: "all", l: t('walkinSale.all') },
                                { v: "anon", l: "👤 " + t('walkinSale.anonymous') },
                                { v: "named", l: "🏷️ " + t('walkinSale.named') },
                                { v: "seller", l: "🧑‍ " + t('walkinSale.sellerBuys') },
                            ].map(({ v, l }) => (
                                <button key={v} type="button"
                                    onClick={() => { setFilterBuyerType(v); setCurrentPage(1); }}
                                    className={`px-3 py-1.5 transition border-r last:border-r-0 border-gray-200
                    ${filterBuyerType === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                    {l}
                                </button>
                            ))}
                        </div>

                        <span className="ml-auto text-xs text-gray-400">
                            {filteredSales.length} {filteredSales.length === 1 ? t('walkinSale.sale') : t('walkinSale.sales')}
                            {searchName && ` ${t('walkinSale.matching')} "${searchName}"`}
                            {filterBuyerType !== "all" && ` · ${filterBuyerType}`}
                        </span>
                    </div>

                    {/* Table Header */}
                    <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Table Rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : sales.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <ShoppingCart size={32} />
                            <p className="text-sm">{t('walkinSale.noSales')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {paginatedSales.map((s, i) => (
                                    <div key={s.sale_id || i} className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors" style={{ gridTemplateColumns: GRID }}>
                                        {/* Buyer */}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                                    ${s.buyer_name === "ANON" ? "bg-gray-100 text-gray-400" : "bg-gray-900 text-white"}`}>
                                                    {s.buyer_name === "ANON" ? "?" : s.buyer_name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <span className={`text-xs font-medium truncate ${s.buyer_name === "ANON" ? "text-gray-400 italic" : "text-gray-800"}`}>
                                                    {s.buyer_name === "ANON" ? t('walkinSale.anonymous') : s.buyer_name}
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Milk Type */}
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
                                                ${s.milk_type === "cow" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                                                {s.milk_type === "cow" ? t('walkinSale.cow') : t('walkinSale.buffalo')}
                                            </span>
                                        </TableCell>

                                        {/* Quantity */}
                                        <TableCell className="text-blue-600 font-mono font-semibold text-xs">
                                            {s.quantity}
                                        </TableCell>

                                        {/* MRP */}
                                        <TableCell className="text-gray-600 font-mono text-xs">
                                            ₹{parseFloat(s.mrp || 0).toFixed(2)}
                                        </TableCell>

                                        {/* Amount */}
                                        <TableCell className="text-gray-900 font-bold text-xs">
                                            ₹{parseFloat(s.total_amount).toFixed(2)}
                                        </TableCell>

                                        {/* Payment Mode */}
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${paymentBadge(s.payment_mode, t)}`}>
                                                {s.payment_mode === "cash" ? t('walkinSale.cash') : s.payment_mode === "upi" ? t('walkinSale.upi') : t('walkinSale.credit')}
                                            </span>
                                        </TableCell>

                                        {/* Shift */}
                                        <TableCell>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
                                                ${s.shift === "morning" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"}`}>
                                                {s.shift === "morning" ? <Sun size={10} /> : <Moon size={10} />}
                                                {s.shift === "morning" ? t('walkinSale.morning') : t('walkinSale.evening')}
                                            </span>
                                        </TableCell>

                                        {/* Time */}
                                        <TableCell className="text-gray-400 font-mono text-xs">
                                            {fmtTime(s.created_at)}
                                        </TableCell>

                                        {/* Actions */}
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEditSale(s)}
                                                    className={`w-6 h-6 flex items-center justify-center rounded-lg transition
                ${editingSaleId === s.sale_id
                                                            ? "bg-amber-500 text-white"
                                                            : "bg-gray-100 hover:bg-amber-100 text-gray-400 hover:text-amber-600"}`}
                                                    title="Edit"
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                    </svg>
                                                </button>
                                                {can('walkin_sales', 'D') && (
                                                    <button
                                                        onClick={() => handleDeleteSale(s.sale_id)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-400 hover:text-rose-600 transition"
                                                        title="Delete"
                                                    >
                                                        <X size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredSales.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('walkinSale.prev')}
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .reduce((acc, p, idx, arr) => {
                                        if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, i) =>
                                        p === '...'
                                            ? <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">…</span>
                                            : <button key={p} onClick={() => setCurrentPage(p)}
                                                className={`w-7 h-7 rounded-lg text-xs font-semibold transition border
                                                    ${currentPage === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                                                {p}
                                            </button>
                                    )}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('walkinSale.next')}
                            </button>
                            <span className="text-xs text-gray-400 ml-1">
                                {filteredSales.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredSales.length)}`} {t('walkinSale.of')} {filteredSales.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('walkinSale.rowsPerPage')}</span>
                            <input
                                type="number" min={1} max={filteredSales.length || 1}
                                value={pageSize}
                                onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                    </div>
                )}

                {/* Totals Footer */}
                {sales.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <div className="grid px-4 py-3 gap-4" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('walkinSale.cowSold')}</p>
                                <p className="text-sm font-bold text-amber-600">
                                    {sales.filter(s => s.milk_type === "cow").reduce((a, s) => a + parseFloat(s.quantity || 0), 0).toFixed(1)} L
                                </p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('walkinSale.buffaloSold')}</p>
                                <p className="text-sm font-bold text-blue-600">
                                    {sales.filter(s => s.milk_type === "buffalo").reduce((a, s) => a + parseFloat(s.quantity || 0), 0).toFixed(1)} L
                                </p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('walkinSale.totalQty')}</p>
                                <p className="text-sm font-bold text-gray-700">{totalQty.toFixed(1)} L</p>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('walkinSale.totalRevenue')}</p>
                                <p className="text-sm font-bold text-emerald-600">₹{totalRevenue.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• <strong className="text-gray-600">{sales.length}</strong> {t('walkinSale.sales')} {t('walkinSale.recordedToday')}</span>
                    <span>• {t('walkinSale.legendAnonymous')}</span>
                    <span>• {t('walkinSale.legendSellerBuys')}</span>
                </div>
            </main>
        </div>
    );
}