import * as XLSX from 'xlsx';
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';
import api from '../../api/axios';
import {
    TrendingUp, FlaskConical, Pencil, Trash2, Star,
    RefreshCw, ChevronRight, AlertTriangle, BadgeCheck, X,
    UploadCloud, FileSpreadsheet, CheckCircle2, XCircle,
    Download, RotateCcw, Import, Home, Settings,
    LayoutGrid, Maximize2, Minimize2
} from 'lucide-react';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── SectionCard Component (matching Dashboard) ────────────────────────────
function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" {...rest}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 relative z-10">{children}</div>
        </div>
    );
}

// ── small helpers ──────────────────────────────────────────
const badge = (type, t) =>
    type === 'cow'
        ? 'bg-amber-50/80 text-amber-700 border border-amber-200/60 backdrop-blur-sm'
        : 'bg-blue-50/80 text-blue-700 border border-blue-200/60 backdrop-blur-sm';

const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_FORM = {
    milk_type: 'cow',
    fat: '',
    snf: '',
    rate: '',
    mrp: '',
    effective_from: '',
    effective_to: '',
};

const rateColumnMap = {
    'milk type': 'milk_type',
    'milk_type': 'milk_type',
    'type': 'milk_type',
    'fat': 'fat',
    'fat%': 'fat',
    'fat percent': 'fat',
    'snf': 'snf',
    'snf%': 'snf',
    'snf percent': 'snf',
    'rate': 'rate',
    'rate per litre': 'rate',
    'rate_per_litre': 'rate',
    'rate per l': 'rate',
    'mrp': 'mrp',
    'mrp per litre': 'mrp',
    'mrp_per_litre': 'mrp',
    'effective from': 'effective_from',
    'effective_from': 'effective_from',
    'from': 'effective_from',
    'effective to': 'effective_to',
    'effective_to': 'effective_to',
    'to': 'effective_to',
};

// ── Field component ────────────────────────────────────────
const Field = ({ label, name, type = 'text', value, onChange, placeholder, required, step, t }) => (
    <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        <input
            name={name} type={type} value={value} onChange={onChange}
            placeholder={placeholder} required={required} step={step}
            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
        />
    </div>
);

// ── StatCard component ────────────────────────────────────
function StatCard({ label, value, sub, icon, color }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 relative z-10 opacity-70">{icon}</div>
            <div className="relative z-10">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Page ──────────────────────────────────────────────
export default function RateChart() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const { can, loading: permLoading } = usePermission();

    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [formError, setFormError] = useState('');
    const [filter, setFilter] = useState('cow');
    const [pageSize, setPageSize] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);
    const [flash, setFlash] = useState(null);
    const [copyingForward, setCopyingForward] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [viewMode, setViewMode] = useState('matrix');

    const [showPremiumModal, setShowPremiumModal] = useState(false);
    const [sellers, setSellers] = useState([]);
    const [selectedSellers, setSelectedSellers] = useState([]);
    const [premiumForm, setPremiumForm] = useState({
        milk_type: 'cow', rate_per_liter: '', reason: '',
        effective_from: '', effective_to: '',
    });
    const [premiumSaving, setPremiumSaving] = useState(false);
    const [sellersLoading, setSellersLoading] = useState(false);
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [copyStartDate, setCopyStartDate] = useState('');
    const [copyEndDate, setCopyEndDate] = useState('');
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [genForm, setGenForm] = useState({
        fat_min: '', fat_max: '', fat_step: '0.1',
        snf_min: '', snf_max: '', snf_step: '0.1',
        base_rate: '', fat_multiplier: '', snf_multiplier: '',
        mrp_margin: '',
    });
    const [genPreview, setGenPreview] = useState([]);

    const [showRateImportModal, setShowRateImportModal] = useState(false);
    const [rateImportFile, setRateImportFile] = useState(null);
    const [rateImportData, setRateImportData] = useState([]);
    const [rateImportLoading, setRateImportLoading] = useState(false);
    const [rateImportErrors, setRateImportErrors] = useState([]);
    const [rateParsingFile, setRateParsingFile] = useState(false);
    const [rateImportResult, setRateImportResult] = useState(null);
    const [rateIsDragging, setRateIsDragging] = useState(false);

    // ── Matrix generator (Fat Step / SNF Step) ──
    const [showMatrixModal, setShowMatrixModal] = useState(false);
    const [matrixFullscreen, setMatrixFullscreen] = useState(false);
    const [matrixForm, setMatrixForm] = useState({
        base_rate: '',
        fat_min: '', fat_max: '', fat_step: '0.1',
        snf_min: '', snf_max: '', snf_step: '0.1',
        mrp_margin: '',
    });
    const [fatSlabs, setFatSlabs] = useState([{ id: 1, from_fat: '', increment: '' }]);
    const [snfSlabs, setSnfSlabs] = useState([{ id: 1, from_snf: '', increment: '' }]);
    const [matrixPreview, setMatrixPreview] = useState({ fatValues: [], snfValues: [], grid: {}, rows: [] });
    const [matrixSaving, setMatrixSaving] = useState(false);
    const [matrixError, setMatrixError] = useState('');

    // ── fetch ──
    const fetchRates = useCallback(async () => {
        setLoading(true);
        setCurrentPage(1);
        try {
            const { data } = await api.get(`/rates?date=${selectedDate}&milk_type=${filter}`);
            setRates(data);
        } catch {
            showFlash('error', t('rateChart.loadError'));
        } finally {
            setLoading(false);
        }
    }, [selectedDate, filter, t]);

    useEffect(() => { fetchRates(); }, [fetchRates]);

    // ── helpers ──
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startRateChartTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="date-picker"]',
                    popover: { title: t('rateChart.dateLabel'), description: t('rateChart.tourDateDesc', 'Pick the date to view or add rates for.') },
                },
                {
                    element: '[data-tour="action-buttons"]',
                    popover: { title: t('rateChart.addRate'), description: t('rateChart.tourActionsDesc', 'Carry rates forward to future dates, auto-generate a full chart by formula, assign premium rates to specific sellers, or add a single rate manually.') },
                },
                {
                    element: '[data-tour="filter-tabs"]',
                    popover: { title: t('rateChart.cow'), description: t('rateChart.tourFilterDesc', 'Switch between cow and buffalo rate charts.') },
                },
                {
                    element: '[data-tour="rates-table"]',
                    popover: { title: t('rateChart.ratePerL'), description: t('rateChart.tourTableDesc', 'Each row shows the rate for a specific FAT/SNF combination. Edit or delete rates here.') },
                },
            ],
        });
        driverObj.drive();
    };

    const handleChange = (e) => {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setFormError('');
    };

    const openAdd = () => {
        setForm({ ...EMPTY_FORM, milk_type: filter, effective_from: selectedDate });
        setEditId(null);
        setFormError('');
        setShowForm(true);
    };

    const openEdit = (rate) => {
        setForm({
            milk_type: rate.milk_type,
            fat: rate.fat,
            snf: rate.snf,
            rate: rate.rate,
            mrp: rate.mrp || '',
            effective_from: rate.effective_from?.split('T')[0] || '',
            effective_to: rate.effective_to?.split('T')[0] || '',
        });
        setEditId(rate.rate_id);
        setFormError('');
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editId) {
                await api.put(`/rates/${editId}?milk_type=${form.milk_type}`, form);
                showFlash('success', t('rateChart.updateSuccess'));
                await fetchRates();
            } else {
                const { data } = await api.post('/rates', form);
                if (data.milk_type === filter) setRates(prev => [data, ...prev]);
                showFlash('success', t('rateChart.addSuccess'));
            }
            setShowForm(false);
            setEditId(null);
        } catch (err) {
            setFormError(err.response?.data?.message || t('rateChart.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm(t('rateChart.deleteConfirm'))) return;
        setDeleting(id);
        try {
            await api.delete(`/rates/${id}?milk_type=${filter}`);
            setRates(prev => prev.filter(r => r.rate_id !== id));
            showFlash('success', t('rateChart.deleteSuccess'));
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('rateChart.deleteError'));
        } finally {
            setDeleting(null);
        }
    };

    const handleDeleteAllRates = async () => {
        const dateStr = new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        if (!window.confirm(t('rateChart.deleteAllConfirm', { filter, date: dateStr }))) return;
        try {
            await api.delete(`/rates/all?date=${selectedDate}&milk_type=${filter}`);
            setRates([]);
            showFlash('success', t('rateChart.deleteAllSuccess', { filter, date: dateStr }));
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('rateChart.deleteError'));
        }
    };

    const handleCopyForward = async () => {
        if (!copyStartDate || !copyEndDate) { showFlash('error', t('rateChart.copyDateRequired')); return; }
        if (copyEndDate < copyStartDate) { showFlash('error', t('rateChart.copyDateInvalid')); return; }
        setCopyingForward(true);
        try {
            const { data } = await api.post('/rates/copy-forward', {
                from_date: selectedDate,
                start_date: copyStartDate,
                end_date: copyEndDate,
                milk_type: filter,
            });

            showFlash('success', data.message);
            setShowCopyModal(false);
            setCopyStartDate('');
            setCopyEndDate('');
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('rateChart.copyError'));
        } finally {
            setCopyingForward(false);
        }
    };

    const openPremiumModal = async () => {
        setShowPremiumModal(true);
        setSelectedSellers([]);
        setPremiumForm({ milk_type: filter, rate_per_liter: '', reason: '', effective_from: '', effective_to: '' });
        setFormError('');
        if (sellers.length === 0) {
            setSellersLoading(true);
            try {
                const { data } = await api.get('/sellers');
                setSellers(data);
            } catch {
                showFlash('error', t('rateChart.sellerLoadError'));
            } finally {
                setSellersLoading(false);
            }
        }
    };

    const buildPreview = (f = genForm) => {
        const fatMin = parseFloat(f.fat_min), fatMax = parseFloat(f.fat_max), fatStep = parseFloat(f.fat_step) || 0.1;
        const snfMin = parseFloat(f.snf_min), snfMax = parseFloat(f.snf_max), snfStep = parseFloat(f.snf_step) || 0.1;
        const base = parseFloat(f.base_rate), fatMul = parseFloat(f.fat_multiplier), snfMul = parseFloat(f.snf_multiplier);
        const mrpMargin = parseFloat(f.mrp_margin) || 0;
        if ([fatMin, fatMax, snfMin, snfMax, base, fatMul, snfMul].some(isNaN)) { setGenPreview([]); return; }
        const rows = [];
        for (let fat = fatMin; fat <= fatMax + 0.001; fat = Math.round((fat + fatStep) * 100) / 100) {
            for (let snf = snfMin; snf <= snfMax + 0.001; snf = Math.round((snf + snfStep) * 100) / 100) {
                const rate = Math.round((base + fat * fatMul + snf * snfMul) * 100) / 100;
                const mrp = mrpMargin ? Math.round((rate + mrpMargin) * 100) / 100 : null;
                rows.push({ fat: fat.toFixed(1), snf: snf.toFixed(1), rate, mrp });
            }
        }
        setGenPreview(rows);
    };

    const handleGenChange = (e) => {
        const updated = { ...genForm, [e.target.name]: e.target.value };
        setGenForm(updated);
        buildPreview(updated);
    };

    const handleGenerateSubmit = async () => {
        if (genPreview.length === 0) { showFlash('error', t('rateChart.noRatesToGenerate')); return; }
        setGenerating(true);
        try {
            await api.post('/rates/generate', {
                milk_type: filter,
                rate_date: selectedDate,
                rates: genPreview,
            });
            const dateStr = new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            showFlash('success', t('rateChart.generateSuccess', { count: genPreview.length, date: dateStr }));
            setShowGenerateModal(false);
            setGenPreview([]);
            setGenForm({ fat_min: '', fat_max: '', fat_step: '0.1', snf_min: '', snf_max: '', snf_step: '0.1', base_rate: '', fat_multiplier: '', snf_multiplier: '', mrp_margin: '' });
            fetchRates();
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('rateChart.generateError'));
        } finally {
            setGenerating(false);
        }
    };

    // ── Bulk rate import ──
    const isValidRateRow = (row) => {
        const milkOk = row.milk_type === 'cow' || row.milk_type === 'buffalo';
        const fatOk = row.fat !== '' && row.fat !== undefined && !isNaN(parseFloat(row.fat));
        const snfOk = row.snf !== '' && row.snf !== undefined && !isNaN(parseFloat(row.snf));
        const rateOk = row.rate !== '' && row.rate !== undefined && !isNaN(parseFloat(row.rate));
        const fromOk = !!row.effective_from;
        return milkOk && fatOk && snfOk && rateOk && fromOk;
    };

    const processRateFile = (file) => {
        if (!file) return;
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
            setRateImportErrors([t('rateChart.import.errors.invalidFile')]);
            return;
        }
        setRateImportFile(file);
        setRateImportErrors([]);
        setRateImportData([]);
        setRateParsingFile(true);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const json = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

                if (json.length === 0) {
                    setRateImportErrors([t('rateChart.import.errors.emptyFile')]);
                    return;
                }

                const headers = Object.keys(json[0]);
                const mappedHeaders = headers.map(h => rateColumnMap[h.trim().toLowerCase()] || null);

                const fatIdx = mappedHeaders.indexOf('fat');
                const snfIdx = mappedHeaders.indexOf('snf');
                const rateIdx = mappedHeaders.indexOf('rate');
                if (fatIdx === -1 || snfIdx === -1 || rateIdx === -1) {
                    setRateImportErrors([t('rateChart.import.errors.missingColumns')]);
                    return;
                }

                const rows = json.map((row, idx) => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        const field = mappedHeaders[i];
                        if (field) {
                            let val = row[h];
                            if (field === 'milk_type') val = String(val).trim().toLowerCase();
                            if (field === 'effective_from' || field === 'effective_to') {
                                if (val instanceof Date) {
                                    val = val.toISOString().split('T')[0];
                                } else if (typeof val === 'number') {
                                    const d = XLSX.SSF.parse_date_code(val);
                                    val = d ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}` : '';
                                }
                            }
                            obj[field] = val;
                        }
                    });
                    if (!obj.milk_type) obj.milk_type = filter;
                    return { ...obj, _rowIndex: idx + 1 };
                });

                const errors = [];
                rows.forEach((row, idx) => {
                    if (!isValidRateRow(row)) {
                        errors.push(t('rateChart.import.errors.rowRequired', { row: idx + 1 }));
                    }
                });
                setRateImportErrors(errors);
                setRateImportData(rows);
            } catch (err) {
                setRateImportErrors([t('rateChart.import.errors.parseFailed', { message: err.message })]);
            } finally {
                setRateParsingFile(false);
            }
        };
        reader.onerror = () => {
            setRateImportErrors([t('rateChart.import.errors.readFailed')]);
            setRateParsingFile(false);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleRateFileUpload = (e) => processRateFile(e.target.files[0]);

    const handleRateDrop = (e) => {
        e.preventDefault();
        setRateIsDragging(false);
        processRateFile(e.dataTransfer.files[0]);
    };
    const handleRateDragOver = (e) => { e.preventDefault(); setRateIsDragging(true); };
    const handleRateDragLeave = (e) => { e.preventDefault(); setRateIsDragging(false); };

    const downloadRateTemplate = () => {
        const headers = [
            t('rateChart.import.templateHeaders.milkType'),
            t('rateChart.import.templateHeaders.fat'),
            t('rateChart.import.templateHeaders.snf'),
            t('rateChart.import.templateHeaders.rate'),
            t('rateChart.import.templateHeaders.mrp'),
            t('rateChart.import.templateHeaders.effectiveFrom'),
            t('rateChart.import.templateHeaders.effectiveTo'),
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, t('rateChart.import.templateSheetName'));
        XLSX.writeFile(wb, 'rate_chart_import_template.xlsx');
    };

    const resetRateImport = () => {
        setRateImportFile(null);
        setRateImportData([]);
        setRateImportErrors([]);
    };

    const handleRateImportSave = async () => {
        if (rateImportData.length === 0) return;
        const validRows = rateImportData.filter(isValidRateRow);
        if (validRows.length === 0) {
            setRateImportErrors([t('rateChart.import.errors.noValidRows')]);
            return;
        }

        setRateImportLoading(true);
        try {
            const response = await api.post('/rates/import', { rates: validRows });
            const { added, skipped, errors: importResultErrors } = response.data;

            if (importResultErrors && importResultErrors.length > 0) {
                setRateImportErrors(importResultErrors.map(e => t('rateChart.import.errors.rowError', { row: e.row, error: e.error })));
            } else {
                setRateImportErrors([]);
            }

            setRateImportResult({ added, skipped });
            await fetchRates();

            if (!skipped) {
                setShowRateImportModal(false);
                setRateImportFile(null);
                setRateImportData([]);
            }
        } catch (err) {
            setRateImportErrors([err.response?.data?.message || err.message]);
        } finally {
            setRateImportLoading(false);
        }
    };

    const toggleSeller = (id) =>
        setSelectedSellers(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );

    const handlePremiumSubmit = async (e) => {
        e.preventDefault();
        if (selectedSellers.length === 0) { setFormError(t('rateChart.selectSellerRequired')); return; }
        setPremiumSaving(true);
        setFormError('');
        try {
            await api.post('/rates/premium', { seller_ids: selectedSellers, ...premiumForm });
            showFlash('success', t('rateChart.premiumAssignSuccess', { count: selectedSellers.length }));
            setShowPremiumModal(false);
        } catch (err) {
            setFormError(err.response?.data?.message || t('rateChart.premiumAssignError'));
        } finally {
            setPremiumSaving(false);
        }
    };

    // ── Matrix generator: builds a cumulative delta map for one axis ──
    // For each value from `min` to `max` (step `step`), records the delta accumulated
    // so far, then advances it by whichever slab's `from` is the largest value <= v.
    const buildDeltaMap = (slabs, min, max, step, fromKey) => {
        const deltaMap = {};
        if ([min, max, step].some(isNaN) || step <= 0 || max < min) return deltaMap;

        const sorted = slabs
            .map(s => ({ from: parseFloat(s[fromKey]), inc: parseFloat(s.increment) }))
            .filter(s => !isNaN(s.from) && !isNaN(s.inc))
            .sort((a, b) => a.from - b.from);

        const activeIncFor = (v) => {
            let inc = 0;
            for (const s of sorted) {
                if (v >= s.from - 0.0001) inc = s.inc;
                else break;
            }
            return inc;
        };

        let delta = 0;
        for (let v = min; v <= max + 0.0001; v = Math.round((v + step) * 100) / 100) {
            deltaMap[v.toFixed(2)] = Math.round(delta * 100) / 100;
            delta += activeIncFor(v);
        }
        return deltaMap;
    };

    const buildMatrixPreview = (form = matrixForm, fSlabs = fatSlabs, sSlabs = snfSlabs) => {
        const base = parseFloat(form.base_rate);
        const fatMin = parseFloat(form.fat_min), fatMax = parseFloat(form.fat_max), fatStep = parseFloat(form.fat_step) || 0.1;
        const snfMin = parseFloat(form.snf_min), snfMax = parseFloat(form.snf_max), snfStep = parseFloat(form.snf_step) || 0.1;
        const mrpMargin = parseFloat(form.mrp_margin) || 0;

        if ([base, fatMin, fatMax, snfMin, snfMax].some(isNaN)) {
            setMatrixPreview({ fatValues: [], snfValues: [], grid: {}, rows: [] });
            return;
        }

        const fatDeltaMap = buildDeltaMap(fSlabs, fatMin, fatMax, fatStep, 'from_fat');
        const snfDeltaMap = buildDeltaMap(sSlabs, snfMin, snfMax, snfStep, 'from_snf');
        const fatValues = Object.keys(fatDeltaMap).sort((a, b) => parseFloat(a) - parseFloat(b));
        const snfValues = Object.keys(snfDeltaMap).sort((a, b) => parseFloat(a) - parseFloat(b));

        const grid = {};
        const rows = [];
        fatValues.forEach(fat => {
            snfValues.forEach(snf => {
                const rate = Math.round((base + fatDeltaMap[fat] + snfDeltaMap[snf]) * 100) / 100;
                const mrp = mrpMargin ? Math.round((rate + mrpMargin) * 100) / 100 : null;
                grid[`${fat}_${snf}`] = { fat, snf, rate, mrp };
                rows.push({ fat, snf, rate, mrp });
            });
        });

        setMatrixPreview({ fatValues, snfValues, grid, rows });
    };

    const handleMatrixFormChange = (e) => {
        const updated = { ...matrixForm, [e.target.name]: e.target.value };
        setMatrixForm(updated);
        buildMatrixPreview(updated, fatSlabs, snfSlabs);
    };

    const updateFatSlab = (id, field, value) => {
        const updated = fatSlabs.map(s => s.id === id ? { ...s, [field]: value } : s);
        setFatSlabs(updated);
        buildMatrixPreview(matrixForm, updated, snfSlabs);
    };
    const addFatSlab = () => {
        const updated = [...fatSlabs, { id: Date.now(), from_fat: '', increment: '' }];
        setFatSlabs(updated);
        buildMatrixPreview(matrixForm, updated, snfSlabs);
    };
    const removeFatSlab = (id) => {
        const updated = fatSlabs.filter(s => s.id !== id);
        setFatSlabs(updated);
        buildMatrixPreview(matrixForm, updated, snfSlabs);
    };

    const updateSnfSlab = (id, field, value) => {
        const updated = snfSlabs.map(s => s.id === id ? { ...s, [field]: value } : s);
        setSnfSlabs(updated);
        buildMatrixPreview(matrixForm, fatSlabs, updated);
    };
    const addSnfSlab = () => {
        const updated = [...snfSlabs, { id: Date.now(), from_snf: '', increment: '' }];
        setSnfSlabs(updated);
        buildMatrixPreview(matrixForm, fatSlabs, updated);
    };
    const removeSnfSlab = (id) => {
        const updated = snfSlabs.filter(s => s.id !== id);
        setSnfSlabs(updated);
        buildMatrixPreview(matrixForm, fatSlabs, updated);
    };

    const openMatrixModal = () => {
        setMatrixForm({
            base_rate: '', fat_min: '', fat_max: '', fat_step: '0.1',
            snf_min: '', snf_max: '', snf_step: '0.1', mrp_margin: '',
        });
        setFatSlabs([{ id: 1, from_fat: '', increment: '' }]);
        setSnfSlabs([{ id: 1, from_snf: '', increment: '' }]);
        setMatrixPreview({ fatValues: [], snfValues: [], grid: {}, rows: [] });
        setMatrixError('');
        setMatrixFullscreen(false);
        setShowMatrixModal(true);
    };

    // Saves the generated matrix for BOTH cow and buffalo, for selectedDate,
    // reusing the existing /rates/generate endpoint (called once per milk type).
    const handleMatrixGenerateSave = async () => {
        if (matrixPreview.rows.length === 0) {
            setMatrixError(t('rateChart.matrixGen.noRates', 'Fill in base rate and ranges to generate a preview.'));
            return;
        }
        setMatrixSaving(true);
        setMatrixError('');
        try {
            const payloadRows = matrixPreview.rows.map(r => ({ fat: r.fat, snf: r.snf, rate: r.rate, mrp: r.mrp }));
            const results = await Promise.all(
                ['cow', 'buffalo'].map(mt =>
                    api.post('/rates/generate', { milk_type: mt, rate_date: selectedDate, rates: payloadRows })
                )
            );
            const totalInserted = results.reduce((sum, r) => sum + (r.data.inserted || 0), 0);
            const dateStr = new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            showFlash('success', t('rateChart.matrixGen.saveSuccess', {
                count: totalInserted, date: dateStr,
                defaultValue: `${totalInserted} rate(s) saved for ${dateStr} across Cow & Buffalo.`,
            }));
            setShowMatrixModal(false);
            fetchRates();
        } catch (err) {
            setMatrixError(err.response?.data?.message || t('rateChart.matrixGen.saveError', 'Failed to save rate matrix.'));
        } finally {
            setMatrixSaving(false);
        }
    };

    // ── stats ──
    const activeCount = rates.filter(r => !r.effective_to).length;
    const totalPages = Math.ceil(rates.length / pageSize);
    const paginated = rates.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ── matrix view data ──
    const fatValues = [...new Set(rates.map(r => parseFloat(r.fat).toFixed(1)))]
        .sort((a, b) => parseFloat(a) - parseFloat(b));
    const snfValues = [...new Set(rates.map(r => parseFloat(r.snf).toFixed(1)))]
        .sort((a, b) => parseFloat(a) - parseFloat(b));
    const rateGrid = {};
    rates.forEach(r => {
        const key = `${parseFloat(r.fat).toFixed(1)}_${parseFloat(r.snf).toFixed(1)}`;
        rateGrid[key] = r;
    });

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('rate_chart', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div className="flex items-center gap-3 shrink-0">
                        
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                                <Home size={16} className="text-gray-400" />
                                <span>{t('rateChart.pageBreadcrumb', { defaultValue: 'Milk Collection' })}</span>
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                    <Settings size={12} /> {t('status.admin')}
                                </span>
                            </div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent leading-tight">
                                {t('rateChart.pageTitle')}
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {t('rateChart.pageSubtitle')} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-end gap-2 flex-wrap" data-tour="action-buttons">
                        <button onClick={startRateChartTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                            <BadgeCheck size={15} /> {t('rateChart.startTour')}
                        </button>

                        <button onClick={() => { setShowCopyModal(true); setCopyStartDate(''); setCopyEndDate(''); }} disabled={copyingForward}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200 disabled:opacity-50">
                            {copyingForward
                                ? <><RefreshCw size={15} className="animate-spin" /> {t('rateChart.copying')}</>
                                : <><ChevronRight size={15} /> {t('rateChart.carryForward')}</>}
                        </button>

                        <button onClick={() => { setShowGenerateModal(true); setGenPreview([]); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200">
                            <FlaskConical size={15} /> {t('rateChart.generateRates')}
                        </button>

                        <button onClick={openMatrixModal}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/30 hover:shadow-xl hover:shadow-fuchsia-500/40 transition-all duration-200">
                            <LayoutGrid size={15} /> {t('rateChart.matrixGen.button', 'Generate Rate Matrix by Fat Step and SNF Step')}
                        </button>

                        <button onClick={() => setShowRateImportModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-600 to-gray-700 text-white shadow-lg shadow-gray-600/30 hover:shadow-xl hover:shadow-gray-600/40 transition-all duration-200">
                            <Import size={15} /> {t('rateChart.import.button')}
                        </button>

                        <button onClick={openPremiumModal}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-200">
                            <Star size={15} /> {t('rateChart.premiumRates')}
                        </button>

                        <button onClick={openAdd}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200
                                ${isAdmin ? 'bg-gradient-to-br from-gray-900 to-gray-800 shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40' : 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40'}`}>
                            <span className="text-base leading-none">+</span> {t('rateChart.addRate')}
                        </button>
                        {rates.length > 0 && (
                            <button onClick={handleDeleteAllRates}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200">
                                <Trash2 size={15} /> {t('rateChart.deleteAll')}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === 'success'
                            ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700'
                            : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Add / Edit Form ── */}
                {showForm && (
                    <SectionCard
                        title={editId ? t('rateChart.editRate') : t('rateChart.addNewRate')}
                        icon={<FlaskConical size={16} className="text-white" />}
                    >
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Milk Type */}
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('rateChart.milkType')} <span className="text-rose-400">*</span>
                                </label>
                                <div className="flex gap-3">
                                    {['cow', 'buffalo'].map(type => (
                                        <label key={type}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition shadow-sm
                                                ${form.milk_type === type
                                                    ? type === 'cow'
                                                        ? 'bg-amber-50/80 border-amber-300/60 text-amber-800 shadow-amber-200/30'
                                                        : 'bg-blue-50/80 border-blue-300/60 text-blue-800 shadow-blue-200/30'
                                                    : 'bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300/80'
                                                }`}>
                                            <input type="radio" name="milk_type" value={type}
                                                checked={form.milk_type === type}
                                                onChange={handleChange} className="hidden" />
                                            {type === 'cow' ? t('rateChart.cow') : t('rateChart.buffalo')}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* FAT + SNF */}
                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('rateChart.fatPercent')} name="fat" type="number" step="0.1"
                                    value={form.fat} onChange={handleChange} placeholder="e.g. 3.5" required t={t} />
                                <Field label={t('rateChart.snfPercent')} name="snf" type="number" step="0.1"
                                    value={form.snf} onChange={handleChange} placeholder="e.g. 8.4" required t={t} />
                            </div>

                            {/* Rate + Dates */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <Field label={t('rateChart.ratePerLitre')} name="rate" type="number" step="0.01"
                                    value={form.rate} onChange={handleChange} placeholder="e.g. 34.50" required t={t} />
                                <Field label={t('rateChart.mrpPerLitre')} name="mrp" type="number" step="0.01"
                                    value={form.mrp} onChange={handleChange} placeholder="e.g. 40.00" t={t} />
                                <Field label={t('rateChart.effectiveFrom')} name="effective_from" type="date"
                                    value={form.effective_from} onChange={handleChange} required t={t} />
                                <Field label={t('rateChart.effectiveTo')} name="effective_to" type="date"
                                    value={form.effective_to} onChange={handleChange} t={t} />
                            </div>

                            {formError && (
                                <div className="flex items-center gap-2 bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 rounded-xl px-4 py-3 text-sm text-rose-700 shadow-sm">
                                    <AlertTriangle size={14} /> {formError}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100/60">
                                <button type="button" onClick={() => { setShowForm(false); setFormError(''); }}
                                    className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                    {t('rateChart.cancel')}
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {saving ? t('rateChart.saving') : editId ? t('rateChart.updateRate') : t('rateChart.addRate')}
                                </button>
                            </div>
                        </form>
                    </SectionCard>
                )}

                {/* ── Filter tabs ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4" data-tour="filter-tabs" data-tour="date-picker">
                    <div className="flex items-center gap-2 flex-wrap">
                        {['cow', 'buffalo'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`text-xs font-semibold px-4 py-1.5 rounded-full transition border shadow-sm
                                    ${filter === f
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30'
                                        : 'bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50'
                                    }`}
                            >
                                {f === 'cow' ? t('rateChart.cow') : t('rateChart.buffalo')}
                            </button>
                        ))}

                        <div className="flex items-center gap-2 ml-auto">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('rateChart.dateLabel')}
                                </span>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={e => setSelectedDate(e.target.value)}
                                    className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-1 bg-gray-100/60 rounded-lg p-1 shadow-sm ml-auto">
                            <button onClick={() => setViewMode('matrix')}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition
                                    ${viewMode === 'matrix' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {t('rateChart.viewMatrix')}
                            </button>
                            <button onClick={() => setViewMode('list')}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition
                                    ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                                {t('rateChart.viewList')}
                            </button>
                        </div>

                        <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">
                            {rates.length} {t('rateChart.entries')}
                        </span>
                    </div>
                </div>

                {/* ── Table ── */}
                <SectionCard
                    title={t('rateChart.rateChart')}
                    icon={<FlaskConical size={16} className="text-white" />}
                    data-tour="rates-table"
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : rates.length === 0 ? (
                        <div className="text-center py-20">
                            <p className="text-3xl mb-3">📊</p>
                            <p className="text-gray-500 text-sm font-medium">{t('rateChart.noRatesFound')}</p>
                            <p className="text-gray-400 text-xs mt-1">{t('rateChart.addFirstRate')}</p>
                        </div>
                    ) : viewMode === 'matrix' ? (
                        <div className="overflow-auto max-h-[500px] rounded-xl border border-gray-200/60 shadow-sm">
                            <table className="border-collapse text-sm w-full">
                                <thead>
                                    <tr>
                                        <th className="sticky top-0 left-0 z-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white text-xs font-semibold px-4 py-2.5 border border-gray-700 whitespace-nowrap shadow-lg">
                                            {t('rateChart.fat')} ⁄ {t('rateChart.snf')}
                                        </th>
                                        {snfValues.map(snf => (
                                            <th key={snf}
                                                className="sticky top-0 z-10 bg-white/80 text-gray-500 text-xs font-semibold px-4 py-2.5 border border-gray-200/60 whitespace-nowrap">
                                                {snf}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {fatValues.map(fat => (
                                        <tr key={fat}>
                                            <td className="sticky left-0 z-10 bg-white/80 text-gray-700 text-xs font-semibold px-4 py-2 border border-gray-200/60 whitespace-nowrap">
                                                {fat}
                                            </td>
                                            {snfValues.map(snf => {
                                                const cell = rateGrid[`${fat}_${snf}`];
                                                return (
                                                    <td key={snf}
                                                        onClick={() => isAdmin && (cell ? openEdit(cell) : openAdd())}
                                                        title={cell?.mrp ? `MRP ₹${parseFloat(cell.mrp).toFixed(2)}` : undefined}
                                                        className={`px-4 py-2 border border-gray-200/60 text-center whitespace-nowrap transition
                                                            ${cell ? 'font-bold text-gray-900 bg-white/50 hover:bg-blue-50/30 cursor-pointer' : 'text-gray-300 bg-gray-50/30'}
                                                            ${isAdmin ? 'cursor-pointer hover:bg-blue-50/30' : ''}`}>
                                                        {cell ? parseFloat(cell.rate).toFixed(2) : '—'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="overflow-x-auto overflow-y-auto max-h-[360px] rounded-xl border border-gray-200/60 shadow-sm">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gradient-to-r from-gray-50/50 to-white/50 z-10 border-b border-gray-200/60">
                                    <tr>
                                        {[t('rateChart.type'), t('rateChart.fat'), t('rateChart.snf'), t('rateChart.ratePerL'), t('rateChart.mrpPerL'), t('rateChart.from'), t('rateChart.to'), isAdmin ? t('rateChart.actions') : null]
                                            .filter(Boolean)
                                            .map((h, i) => (
                                                <th key={i} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-r border-gray-200/60 last:border-r-0">{h}</th>
                                            ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/60">
                                    {paginated.map(rate => (
                                        <tr key={rate.rate_id} className="hover:bg-blue-50/30 transition group">
                                            <td className="px-5 py-3.5 border-r border-gray-200/60">
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${badge(rate.milk_type, t)}`}>
                                                    {rate.milk_type === 'cow' ? t('rateChart.cow') : t('rateChart.buffalo')}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-gray-700 border-r border-gray-200/60">{parseFloat(rate.fat).toFixed(1)}</td>
                                            <td className="px-5 py-3.5 font-mono text-gray-700 border-r border-gray-200/60">{parseFloat(rate.snf).toFixed(1)}</td>
                                            <td className="px-5 py-3.5 border-r border-gray-200/60">
                                                <span className="font-bold text-gray-900">₹{parseFloat(rate.rate).toFixed(2)}</span>
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-gray-500 text-xs border-r border-gray-200/60">
                                                {rate.mrp ? `₹${parseFloat(rate.mrp).toFixed(2)}` : <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap border-r border-gray-200/60">{fmt(rate.effective_from)}</td>
                                            <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap border-r border-gray-200/60">
                                                {rate.effective_to
                                                    ? fmt(rate.effective_to)
                                                    : <span className="text-emerald-600 font-medium">{t('rateChart.active')}</span>}
                                            </td>

                                            {isAdmin && (
                                                <td className="px-5 py-3.5">
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => openEdit(rate)}
                                                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 rounded-lg transition border border-blue-200/60 shadow-sm backdrop-blur-sm">
                                                            <Pencil size={11} /><span className="text-xs font-medium">{t('rateChart.edit')}</span>
                                                        </button>
                                                        <button onClick={() => handleDelete(rate.rate_id)}
                                                            disabled={deleting === rate.rate_id}
                                                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 rounded-lg transition border border-rose-200/60 shadow-sm backdrop-blur-sm disabled:opacity-50">
                                                            <Trash2 size={11} /><span className="text-xs font-medium">{deleting === rate.rate_id ? '…' : t('rateChart.del')}</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </SectionCard>

                {/* ── Legend + Pagination ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                            {t('rateChart.prev')}
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
                                            className={`w-7 h-7 rounded-lg text-xs font-semibold transition border shadow-sm
                                                ${currentPage === p ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30' : 'bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50'}`}>
                                            {p}
                                        </button>
                                )}
                        </div>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                            {t('rateChart.next')}
                        </button>
                        <span className="text-xs text-gray-400 ml-1">
                            {rates.length === 0 ? '0' : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, rates.length)}`} {t('rateChart.of')} {rates.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('rateChart.rowsPerPage')}</span>
                            <input
                                type="number" min={1} max={rates.length || 1}
                                value={pageSize}
                                onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                className="w-14 border border-gray-200/60 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            <span>• <strong className="text-gray-600">{t('rateChart.active')}</strong> = {t('rateChart.activeDesc')}</span>
                            <span>• {t('rateChart.hoverTip')}</span>
                            {!isAdmin && <span>• {t('rateChart.contactAdminTip')}</span>}
                        </div>
                    </div>
                </div>

                {/* ── Premium Rate Modal ── */}
                {showPremiumModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/60 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-amber-50/50 to-white/50">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <Star size={15} className="text-amber-500" /> {t('rateChart.assignPremiumRate')}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {t('rateChart.premiumDesc')}
                                    </p>
                                </div>
                                <button onClick={() => setShowPremiumModal(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                    <X size={15} />
                                </button>
                            </div>

                            <form onSubmit={handlePremiumSubmit} className="flex flex-col flex-1 overflow-hidden">
                                <div className="overflow-y-auto p-6 space-y-5">

                                    {/* Milk Type */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            {t('rateChart.milkType')} <span className="text-rose-400">*</span>
                                        </label>
                                        <div className="flex gap-3">
                                            {['cow', 'buffalo'].map(type => (
                                                <label key={type}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border cursor-pointer text-sm font-medium transition shadow-sm
                                                        ${premiumForm.milk_type === type
                                                            ? type === 'cow'
                                                                ? 'bg-amber-50/80 border-amber-300/60 text-amber-800 shadow-amber-200/30'
                                                                : 'bg-blue-50/80 border-blue-300/60 text-blue-800 shadow-blue-200/30'
                                                            : 'bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300/80'
                                                        }`}>
                                                    <input type="radio" name="premium_milk_type" value={type}
                                                        checked={premiumForm.milk_type === type}
                                                        onChange={e => setPremiumForm(p => ({ ...p, milk_type: e.target.value }))}
                                                        className="hidden" />
                                                    {type === 'cow' ? t('rateChart.cow') : t('rateChart.buffalo')}
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Rate + Dates */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <Field label={t('rateChart.premiumRatePerLitre')} name="rate_per_liter" type="number" step="0.01"
                                            value={premiumForm.rate_per_liter}
                                            onChange={e => setPremiumForm(p => ({ ...p, rate_per_liter: e.target.value }))}
                                            placeholder="e.g. 42.00" required t={t} />
                                        <Field label={t('rateChart.effectiveFrom')} name="effective_from" type="date"
                                            value={premiumForm.effective_from}
                                            onChange={e => setPremiumForm(p => ({ ...p, effective_from: e.target.value }))}
                                            required t={t} />
                                        <Field label={t('rateChart.effectiveTo')} name="effective_to" type="date"
                                            value={premiumForm.effective_to}
                                            onChange={e => setPremiumForm(p => ({ ...p, effective_to: e.target.value }))} t={t} />
                                    </div>

                                    {/* Reason */}
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            {t('rateChart.reasonNote')} <span className="text-rose-400">*</span>
                                        </label>
                                        <textarea
                                            value={premiumForm.reason} required rows={2}
                                            onChange={e => setPremiumForm(p => ({ ...p, reason: e.target.value }))}
                                            placeholder={t('rateChart.reasonPlaceholder')}
                                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition resize-none"
                                        />
                                    </div>

                                    {/* Seller selection */}
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                {t('rateChart.selectSellers')} <span className="text-rose-400">*</span>
                                            </label>
                                            {sellers.length > 0 && (
                                                <div className="flex gap-2">
                                                    <button type="button"
                                                        onClick={() => setSelectedSellers(sellers.map(s => s.seller_id))}
                                                        className="text-xs text-blue-600 hover:underline">
                                                        {t('rateChart.selectAll')}
                                                    </button>
                                                    <span className="text-gray-300">|</span>
                                                    <button type="button"
                                                        onClick={() => setSelectedSellers([])}
                                                        className="text-xs text-gray-400 hover:underline">
                                                        {t('rateChart.clear')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {sellersLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                            </div>
                                        ) : (
                                            <div className="border border-gray-200/60 rounded-xl overflow-hidden max-h-52 overflow-y-auto shadow-sm">
                                                {sellers.length === 0 ? (
                                                    <p className="text-center text-sm text-gray-400 py-6">{t('rateChart.noSellersFound')}</p>
                                                ) : sellers.map((seller, i) => (
                                                    <label key={seller.seller_id}
                                                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition
                                                            ${i !== sellers.length - 1 ? 'border-b border-gray-200/60' : ''}
                                                            ${selectedSellers.includes(seller.seller_id) ? 'bg-amber-50/80 backdrop-blur-sm' : 'hover:bg-gray-50/50'}`}>
                                                        <input type="checkbox"
                                                            checked={selectedSellers.includes(seller.seller_id)}
                                                            onChange={() => toggleSeller(seller.seller_id)}
                                                            className="accent-amber-500 w-4 h-4 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 truncate">{seller.name}</p>
                                                            {seller.mobile && (
                                                                <p className="text-xs text-gray-400">{seller.mobile}</p>
                                                            )}
                                                        </div>
                                                        {selectedSellers.includes(seller.seller_id) && (
                                                            <span className="text-amber-500 text-xs font-semibold shrink-0">{t('rateChart.selected')}</span>
                                                        )}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {selectedSellers.length > 0 && (
                                            <p className="text-xs text-amber-700 font-medium">
                                                {selectedSellers.length} {t('rateChart.sellerSelected', { count: selectedSellers.length })}
                                            </p>
                                        )}
                                    </div>

                                    {formError && (
                                        <div className="flex items-center gap-2 bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 rounded-xl px-4 py-3 text-sm text-rose-700 shadow-sm">
                                            <AlertTriangle size={14} /> {formError}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200/60 bg-gray-50/60 rounded-b-2xl">
                                    <button type="button" onClick={() => setShowPremiumModal(false)}
                                        className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                        {t('rateChart.cancel')}
                                    </button>
                                    <button type="submit" disabled={premiumSaving}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                                            text-white bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-200 disabled:opacity-50">
                                        {premiumSaving && (
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        )}
                                        {premiumSaving ? t('rateChart.assigning') : t('rateChart.assignToSellers', { count: selectedSellers.length })}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Copy Forward Modal ── */}
                {showCopyModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/60 w-full max-w-sm shadow-2xl p-6 flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-800">{t('rateChart.carryRatesForward')}</h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {t('rateChart.copyDesc', { filter: filter === 'cow' ? t('rateChart.cow') : t('rateChart.buffalo') })}
                                    </p>
                                </div>
                                <button onClick={() => setShowCopyModal(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('rateChart.sourceDate')}</label>
                                    <div className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-gray-100/60 font-mono shadow-sm">
                                        {new Date(selectedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                    <p className="text-[11px] text-gray-400">{t('rateChart.copyFromDateDesc')}</p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        {t('rateChart.copyFromDate')} <span className="text-rose-400">*</span>
                                    </label>
                                    <input type="date" value={copyStartDate}
                                        onChange={e => setCopyStartDate(e.target.value)}
                                        className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                        {t('rateChart.copyUntilDate')} <span className="text-rose-400">*</span>
                                    </label>
                                    <input type="date" value={copyEndDate}
                                        min={copyStartDate || undefined}
                                        onChange={e => setCopyEndDate(e.target.value)}
                                        className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                    {copyStartDate && copyEndDate && copyEndDate >= copyStartDate && (
                                        <p className="text-[11px] text-emerald-600 font-medium mt-1">
                                            {(() => {
                                                const dates = [];
                                                const c = new Date(copyStartDate);
                                                const e = new Date(copyEndDate);
                                                while (c <= e) { dates.push(1); c.setDate(c.getDate() + 1); }
                                                return dates.length;
                                            })()} {t('rateChart.copyPreview', { start: new Date(copyStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), end: new Date(copyEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) })}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setShowCopyModal(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                                    {t('rateChart.cancel')}
                                </button>
                                <button type="button" onClick={handleCopyForward} disabled={copyingForward || !copyStartDate || !copyEndDate}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {copyingForward && <RefreshCw size={12} className="animate-spin" />}
                                    {copyingForward ? t('rateChart.copying') : t('rateChart.carryForward')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Generate Rate Chart Modal ── */}
                {showGenerateModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/60 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">

                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-violet-50/50 to-white/50 rounded-xl">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <FlaskConical size={15} className="text-violet-500" /> {t('rateChart.generateRateChart')}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {t('rateChart.generateFormulaDesc')}
                                        <span className="font-mono text-violet-600">Rate = Base + (FAT × Fat Multiplier) + (SNF × SNF Multiplier)</span>
                                    </p>
                                </div>
                                <button onClick={() => setShowGenerateModal(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="overflow-y-auto p-6 flex flex-col gap-5">

                                {/* FAT range */}
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('rateChart.fatRange')}</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Field label={t('rateChart.fatMin')} name="fat_min" type="number" step="0.1" value={genForm.fat_min} onChange={handleGenChange} placeholder="e.g. 3.0" t={t} />
                                        <Field label={t('rateChart.fatMax')} name="fat_max" type="number" step="0.1" value={genForm.fat_max} onChange={handleGenChange} placeholder="e.g. 8.0" t={t} />
                                        <Field label={t('rateChart.fatStep')} name="fat_step" type="number" step="0.1" value={genForm.fat_step} onChange={handleGenChange} placeholder="0.1" t={t} />
                                    </div>
                                </div>

                                {/* SNF range */}
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('rateChart.snfRange')}</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        <Field label={t('rateChart.snfMin')} name="snf_min" type="number" step="0.1" value={genForm.snf_min} onChange={handleGenChange} placeholder="e.g. 7.0" t={t} />
                                        <Field label={t('rateChart.snfMax')} name="snf_max" type="number" step="0.1" value={genForm.snf_max} onChange={handleGenChange} placeholder="e.g. 9.5" t={t} />
                                        <Field label={t('rateChart.snfStep')} name="snf_step" type="number" step="0.1" value={genForm.snf_step} onChange={handleGenChange} placeholder="0.1" t={t} />
                                    </div>
                                </div>

                                {/* Formula */}
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('rateChart.formulaParameters')}</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <Field label={t('rateChart.baseRate')} name="base_rate" type="number" step="0.01" value={genForm.base_rate} onChange={handleGenChange} placeholder="e.g. 10.00" t={t} />
                                        <Field label={t('rateChart.fatMultiplier')} name="fat_multiplier" type="number" step="0.01" value={genForm.fat_multiplier} onChange={handleGenChange} placeholder="e.g. 4.00" t={t} />
                                        <Field label={t('rateChart.snfMultiplier')} name="snf_multiplier" type="number" step="0.01" value={genForm.snf_multiplier} onChange={handleGenChange} placeholder="e.g. 1.50" t={t} />
                                        <Field label={t('rateChart.mrpMargin')} name="mrp_margin" type="number" step="0.01" value={genForm.mrp_margin} onChange={handleGenChange} placeholder="e.g. 5.00" t={t} />
                                    </div>
                                </div>

                                {/* Preview */}
                                {genPreview.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                {t('rateChart.preview')} — {genPreview.length} {t('rateChart.combinations')}
                                            </p>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm ${badge(filter, t)}`}>
                                                {filter === 'cow' ? t('rateChart.cow') : t('rateChart.buffalo')} · {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                        <div className="border border-gray-200/60 rounded-xl overflow-hidden max-h-52 overflow-y-auto shadow-sm">
                                            <table className="w-full text-xs">
                                                <thead className="bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60 sticky top-0">
                                                    <tr>
                                                        {[t('rateChart.fat'), t('rateChart.snf'), t('rateChart.ratePerL'), t('rateChart.mrpPerL')].map(h => (
                                                            <th key={h} className="px-4 py-2 text-left font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200/60 last:border-r-0">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200/60">
                                                    {genPreview.map((row, i) => (
                                                        <tr key={i} className="hover:bg-blue-50/30">
                                                            <td className="px-4 py-2 font-mono text-gray-700 border-r border-gray-200/60">{row.fat}</td>
                                                            <td className="px-4 py-2 font-mono text-gray-700 border-r border-gray-200/60">{row.snf}</td>
                                                            <td className="px-4 py-2 font-bold text-gray-900 border-r border-gray-200/60">₹{row.rate.toFixed(2)}</td>
                                                            <td className="px-4 py-2 text-gray-500">{row.mrp ? `₹${row.mrp.toFixed(2)}` : <span className="text-gray-300">—</span>}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/60 bg-gray-50/60 rounded-b-2xl">
                                <p className="text-xs text-gray-400">
                                    {genPreview.length > 0
                                        ? `${genPreview.length} ${t('rateChart.ratesWillBeSaved')}`
                                        : t('rateChart.fillAllFieldsToPreview')}
                                </p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowGenerateModal(false)}
                                        className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                        {t('rateChart.cancel')}
                                    </button>
                                    <button type="button" onClick={handleGenerateSubmit}
                                        disabled={generating || genPreview.length === 0}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                                            text-white bg-gradient-to-br from-violet-500 to-violet-600 shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-50">
                                        {generating && <RefreshCw size={12} className="animate-spin" />}
                                        {generating ? t('rateChart.saving') : t('rateChart.saveRates', { count: genPreview.length || 0 })}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Generate Rate Matrix by Fat Step & SNF Step Modal ── */}
                {showMatrixModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className={`bg-white/95 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl flex flex-col transition-all duration-200
                            ${matrixFullscreen ? 'w-full h-full max-w-none max-h-none rounded-none' : 'w-full max-w-6xl max-h-[92vh]'}`}>

                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-fuchsia-50/50 to-white/50 rounded-xl">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <LayoutGrid size={15} className="text-fuchsia-500" /> {t('rateChart.matrixGen.title', 'Generate Rate Matrix by Fat Step and SNF Step')}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {t('rateChart.matrixGen.desc', 'Define a base rate, FAT/SNF ranges, and step slabs. Saved rates apply to both Cow and Buffalo.')}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setMatrixFullscreen(f => !f)}
                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                        {matrixFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                                    </button>
                                    <button onClick={() => setShowMatrixModal(false)}
                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-y-auto p-6 flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6">

                                {/* LEFT: configuration */}
                                <div className="flex flex-col gap-5">

                                    <div className="grid grid-cols-2 gap-3">
                                        <Field label={t('rateChart.matrixGen.baseRate', 'Base Rate')} name="base_rate" type="number" step="0.01"
                                            value={matrixForm.base_rate} onChange={handleMatrixFormChange} placeholder="e.g. 55.00" required t={t} />
                                        <Field label={t('rateChart.mrpMargin')} name="mrp_margin" type="number" step="0.01"
                                            value={matrixForm.mrp_margin} onChange={handleMatrixFormChange} placeholder="e.g. 5.00" t={t} />
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('rateChart.fatRange')}</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            <Field label={t('rateChart.fatMin')} name="fat_min" type="number" step="0.1" value={matrixForm.fat_min} onChange={handleMatrixFormChange} placeholder="e.g. 3.0" t={t} />
                                            <Field label={t('rateChart.fatMax')} name="fat_max" type="number" step="0.1" value={matrixForm.fat_max} onChange={handleMatrixFormChange} placeholder="e.g. 8.0" t={t} />
                                            <Field label={t('rateChart.fatStep')} name="fat_step" type="number" step="0.1" value={matrixForm.fat_step} onChange={handleMatrixFormChange} placeholder="0.1" t={t} />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('rateChart.snfRange')}</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            <Field label={t('rateChart.snfMin')} name="snf_min" type="number" step="0.1" value={matrixForm.snf_min} onChange={handleMatrixFormChange} placeholder="e.g. 7.0" t={t} />
                                            <Field label={t('rateChart.snfMax')} name="snf_max" type="number" step="0.1" value={matrixForm.snf_max} onChange={handleMatrixFormChange} placeholder="e.g. 9.5" t={t} />
                                            <Field label={t('rateChart.snfStep')} name="snf_step" type="number" step="0.1" value={matrixForm.snf_step} onChange={handleMatrixFormChange} placeholder="0.1" t={t} />
                                        </div>
                                    </div>

                                    {/* FAT slabs */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                {t('rateChart.matrixGen.fatSlabs', 'FAT Step Increments')}
                                            </p>
                                            <button type="button" onClick={addFatSlab}
                                                className="text-xs font-semibold text-fuchsia-600 hover:underline">
                                                + {t('rateChart.matrixGen.addSlab', 'Add slab')}
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {fatSlabs.map((slab) => (
                                                <div key={slab.id} className="flex items-end gap-2 bg-gray-50/60 border border-gray-200/60 rounded-xl p-2.5 shadow-sm">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                            {t('rateChart.matrixGen.fromFat', 'From FAT')}
                                                        </label>
                                                        <input type="number" step="0.1" value={slab.from_fat}
                                                            onChange={e => updateFatSlab(slab.id, 'from_fat', e.target.value)}
                                                            placeholder="e.g. 6.0"
                                                            className="w-full border border-gray-200/60 bg-white/60 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                            {t('rateChart.matrixGen.incPerStep', 'Increment / Step')}
                                                        </label>
                                                        <input type="number" step="0.01" value={slab.increment}
                                                            onChange={e => updateFatSlab(slab.id, 'increment', e.target.value)}
                                                            placeholder="e.g. 0.86"
                                                            className="w-full border border-gray-200/60 bg-white/60 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                                                    </div>
                                                    {fatSlabs.length > 1 && (
                                                        <button type="button" onClick={() => removeFatSlab(slab.id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-500 border border-rose-200/60 shrink-0 transition">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* SNF slabs */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                {t('rateChart.matrixGen.snfSlabs', 'SNF Step Increments')}
                                            </p>
                                            <button type="button" onClick={addSnfSlab}
                                                className="text-xs font-semibold text-fuchsia-600 hover:underline">
                                                + {t('rateChart.matrixGen.addSlab', 'Add slab')}
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {snfSlabs.map((slab) => (
                                                <div key={slab.id} className="flex items-end gap-2 bg-gray-50/60 border border-gray-200/60 rounded-xl p-2.5 shadow-sm">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                            {t('rateChart.matrixGen.fromSnf', 'From SNF')}
                                                        </label>
                                                        <input type="number" step="0.1" value={slab.from_snf}
                                                            onChange={e => updateSnfSlab(slab.id, 'from_snf', e.target.value)}
                                                            placeholder="e.g. 9.0"
                                                            className="w-full border border-gray-200/60 bg-white/60 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                            {t('rateChart.matrixGen.incPerStep', 'Increment / Step')}
                                                        </label>
                                                        <input type="number" step="0.01" value={slab.increment}
                                                            onChange={e => updateSnfSlab(slab.id, 'increment', e.target.value)}
                                                            placeholder="e.g. 0.05"
                                                            className="w-full border border-gray-200/60 bg-white/60 rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20" />
                                                    </div>
                                                    {snfSlabs.length > 1 && (
                                                        <button type="button" onClick={() => removeSnfSlab(slab.id)}
                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-500 border border-rose-200/60 shrink-0 transition">
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {matrixError && (
                                        <div className="flex items-center gap-2 bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 rounded-xl px-4 py-3 text-sm text-rose-700 shadow-sm">
                                            <AlertTriangle size={14} /> {matrixError}
                                        </div>
                                    )}
                                </div>

                                {/* RIGHT: live matrix preview */}
                                <div className="flex flex-col gap-2 min-h-[300px]">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            {t('rateChart.preview')} {matrixPreview.rows.length > 0 && `— ${matrixPreview.rows.length} ${t('rateChart.combinations')}`}
                                        </p>
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-fuchsia-50/80 text-fuchsia-700 border-fuchsia-200/60 backdrop-blur-sm">
                                            {t('rateChart.cow')} + {t('rateChart.buffalo')} · {new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>

                                    {matrixPreview.fatValues.length === 0 ? (
                                        <div className="flex-1 flex items-center justify-center border border-dashed border-gray-200/60 rounded-xl text-center py-16">
                                            <p className="text-xs text-gray-400">{t('rateChart.fillAllFieldsToPreview')}</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-auto flex-1 max-h-[520px] rounded-xl border border-gray-200/60 shadow-sm">
                                            <table className="border-collapse text-xs w-full">
                                                <thead>
                                                    <tr>
                                                        <th className="sticky top-0 left-0 z-20 bg-gradient-to-br from-gray-900 to-gray-800 text-white font-semibold px-3 py-2 border border-gray-700 whitespace-nowrap shadow-lg">
                                                            {t('rateChart.fat')} ⁄ {t('rateChart.snf')}
                                                        </th>
                                                        {matrixPreview.snfValues.map(snf => (
                                                            <th key={snf} className="sticky top-0 z-10 bg-white/80 text-gray-500 font-semibold px-3 py-2 border border-gray-200/60 whitespace-nowrap">
                                                                {snf}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {matrixPreview.fatValues.map(fat => (
                                                        <tr key={fat}>
                                                            <td className="sticky left-0 z-10 bg-white/80 text-gray-700 font-semibold px-3 py-1.5 border border-gray-200/60 whitespace-nowrap">
                                                                {fat}
                                                            </td>
                                                            {matrixPreview.snfValues.map(snf => {
                                                                const cell = matrixPreview.grid[`${fat}_${snf}`];
                                                                return (
                                                                    <td key={snf}
                                                                        title={cell?.mrp ? `MRP ₹${cell.mrp.toFixed(2)}` : undefined}
                                                                        className="px-3 py-1.5 border border-gray-200/60 text-center whitespace-nowrap font-bold text-gray-900 bg-white/50">
                                                                        {cell ? cell.rate.toFixed(2) : '—'}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/60 bg-gray-50/60 rounded-b-2xl shrink-0">
                                <p className="text-xs text-gray-400">
                                    {matrixPreview.rows.length > 0
                                        ? `${matrixPreview.rows.length} ${t('rateChart.matrixGen.willBeSavedBoth', 'rate(s) will be saved for BOTH Cow & Buffalo')}`
                                        : t('rateChart.fillAllFieldsToPreview')}
                                </p>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowMatrixModal(false)}
                                        className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                        {t('rateChart.cancel')}
                                    </button>
                                    <button type="button" onClick={handleMatrixGenerateSave}
                                        disabled={matrixSaving || matrixPreview.rows.length === 0}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                                            text-white bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 shadow-lg shadow-fuchsia-500/30 hover:shadow-xl hover:shadow-fuchsia-500/40 transition-all duration-200 disabled:opacity-50">
                                        {matrixSaving && <RefreshCw size={12} className="animate-spin" />}
                                        {matrixSaving ? t('rateChart.saving') : t('rateChart.matrixGen.saveButton', 'Save Rate Matrix')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Import Rates Modal ── */}
                {showRateImportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 max-w-4xl w-full max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-gray-50/50 to-white/50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center shrink-0 shadow-lg shadow-gray-900/20">
                                        <FileSpreadsheet size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-gray-800">{t('rateChart.import.title')}</h2>
                                        <p className="text-xs text-gray-400 mt-0.5">{t('rateChart.import.subtitle')}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setShowRateImportModal(false); resetRateImport(); }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto flex-1">
                                {!rateImportFile ? (
                                    <label
                                        onDrop={handleRateDrop}
                                        onDragOver={handleRateDragOver}
                                        onDragLeave={handleRateDragLeave}
                                        className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-12 px-6 cursor-pointer transition shadow-sm
                                            ${rateIsDragging ? "border-gray-900 bg-gray-100/60 backdrop-blur-sm shadow-lg" : "border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50"}`}>
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center transition shadow-sm
                                            ${rateIsDragging ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/20" : "bg-gray-100/80 text-gray-400"}`}>
                                            <UploadCloud size={22} />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-semibold text-gray-700">
                                                {rateIsDragging ? t('rateChart.import.dropHere') : t('rateChart.import.dragDrop')}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">{t('rateChart.import.browseOr')}</p>
                                        </div>
                                        <input type="file" accept=".xlsx,.xls,.csv" onChange={handleRateFileUpload} className="hidden" />
                                    </label>
                                ) : (
                                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200/60 bg-gray-50/60 mb-4 shadow-sm">
                                        <div className="w-9 h-9 rounded-lg bg-white border border-gray-200/60 flex items-center justify-center shrink-0 shadow-sm">
                                            <FileSpreadsheet size={16} className="text-emerald-600" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-800 truncate">{rateImportFile.name}</p>
                                            <p className="text-xs text-gray-400">{(rateImportFile.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                        {rateParsingFile && (
                                            <span className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin shrink-0" />
                                        )}
                                        <button onClick={resetRateImport}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-100 text-gray-500 text-xs font-medium transition border border-gray-200/60 shrink-0 shadow-sm">
                                            <RotateCcw size={11} /> {t('rateChart.import.replace')}
                                        </button>
                                    </div>
                                )}

                                {rateImportData.length > 0 && (
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-gray-100/80 text-gray-600 border border-gray-200/60 backdrop-blur-sm shadow-sm">
                                            {t('rateChart.import.rowCount', { count: rateImportData.length })}
                                        </span>
                                        <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50/80 text-emerald-700 border border-emerald-200/60 backdrop-blur-sm shadow-sm">
                                            <CheckCircle2 size={11} />
                                            {t('rateChart.import.valid', { count: rateImportData.filter(isValidRateRow).length })}
                                        </span>
                                        {rateImportData.filter(r => !isValidRateRow(r)).length > 0 && (
                                            <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-rose-50/80 text-rose-600 border border-rose-200/60 backdrop-blur-sm shadow-sm">
                                                <XCircle size={11} />
                                                {t('rateChart.import.invalid', { count: rateImportData.filter(r => !isValidRateRow(r)).length })}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {rateImportErrors.length > 0 && (
                                    <div className="mb-4 p-3 bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 rounded-xl text-sm text-rose-600 max-h-40 overflow-y-auto shadow-sm">
                                        {rateImportErrors.map((err, i) => <div key={i}>• {err}</div>)}
                                    </div>
                                )}

                                {rateImportData.length > 0 && (
                                    <div className="border border-gray-200/60 rounded-xl overflow-auto max-h-96 shadow-sm">
                                        <table className="w-full text-xs">
                                            <thead className="bg-gradient-to-r from-gray-50/50 to-white/50 sticky top-0">
                                                <tr>
                                                    {Object.keys(rateImportData[0]).filter(k => !k.startsWith('_')).map(key => (
                                                        <th key={key} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200/60">
                                                            {key}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-200/60">{t('rateChart.import.status')}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rateImportData.map((row, idx) => {
                                                    const valid = isValidRateRow(row);
                                                    return (
                                                        <tr key={idx} className={`border-b border-gray-200/60 ${valid ? 'hover:bg-emerald-50/30' : 'bg-rose-50/30'}`}>
                                                            {Object.keys(row).filter(k => !k.startsWith('_')).map(key => (
                                                                <td key={key} className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                                                                    {row[key] !== undefined && row[key] !== null ? String(row[key]) : ''}
                                                                </td>
                                                            ))}
                                                            <td className="px-3 py-2">
                                                                {valid
                                                                    ? <span className="flex items-center gap-1 text-emerald-600 font-semibold"><CheckCircle2 size={12} /> {t('rateChart.import.validLabel')}</span>
                                                                    : <span className="flex items-center gap-1 text-rose-500 font-semibold"><XCircle size={12} /> {t('rateChart.import.invalidLabel')}</span>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-200/60 shrink-0">
                                <button onClick={downloadRateTemplate}
                                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition">
                                    <Download size={12} /> {t('rateChart.import.downloadTemplate')}
                                </button>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => { setShowRateImportModal(false); resetRateImport(); }}
                                        className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                        {t('rateChart.import.cancel')}
                                    </button>
                                    <button onClick={handleRateImportSave}
                                        disabled={rateImportLoading || rateImportData.length === 0 || rateImportData.filter(isValidRateRow).length === 0}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50">
                                        {rateImportLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                        {t('rateChart.import.saveAll')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Import Result Popup ── */}
                {rateImportResult && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                            <div className="flex flex-col items-center gap-2 text-center">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center border shadow-sm
                                    ${rateImportResult.skipped === 0 ? "bg-emerald-50/80 border-emerald-200/60" : "bg-amber-50/80 border-amber-200/60"}`}>
                                    {rateImportResult.skipped === 0
                                        ? <BadgeCheck size={22} className="text-emerald-500" />
                                        : <AlertTriangle size={22} className="text-amber-500" />}
                                </div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('rateChart.import.complete')}</h2>
                                <p className="text-gray-500 text-sm leading-relaxed">
                                    {t('rateChart.import.resultAdded', { count: rateImportResult.added })}
                                    {rateImportResult.skipped > 0 && (
                                        <>, {t('rateChart.import.resultSkipped', { count: rateImportResult.skipped })}</>
                                    )}.
                                </p>
                            </div>
                            <button onClick={() => setRateImportResult(null)}
                                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 active:scale-95">
                                {t('rateChart.import.ok')}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('rateChart.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('rateChart.footerRates', { defaultValue: 'Total rates' })}: <strong className="text-gray-600">{rates.length}</strong></span>
                    <span>· {t('rateChart.footerActive', { defaultValue: 'Active' })}: <strong className="text-emerald-600">{activeCount}</strong></span>
                    <span>· {t('rateChart.footerView', { defaultValue: 'View' })}: <strong className="text-gray-600">{viewMode === 'matrix' ? 'Matrix' : 'List'}</strong></span>
                </div>

            </main>
        </div>
    );
}