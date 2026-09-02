// FulfillmentScanner.jsx
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import jsQR from "jsqr";
import api from "../api/axios";
import {
    CheckCircle2, XCircle, Camera, Loader2, PackageCheck,
    Home, AlertTriangle, ArrowLeft
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

const TYPE_META = {
    feed: {
        label: "Feed Pickup Scanner",
        crumb: "Feed Pickup Scanner",
        qrPathSegment: "feed-scan",
    },
    product: {
        label: "Product Pickup Scanner",
        crumb: "Product Pickup Scanner",
        qrPathSegment: "product-scan",
    },
};

export default function FulfillmentScanner({ type: fixedType }) {
    const params = useParams(); // { type, token } — shape depends on which route matched
    const type = fixedType || params.type; // "feed" | "product"
    const meta = TYPE_META[type] || TYPE_META.feed;
    const tokenFromUrl = params.token;

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);

    const [scanning, setScanning] = useState(false);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [preview, setPreview] = useState(null);
    const [confirming, setConfirming] = useState(false);
    const [result, setResult] = useState(null);
    const [cameraError, setCameraError] = useState(null);
    const [manualToken, setManualToken] = useState("");

    // Accept either a full URL (…/feed-scan/<token> or …/product-scan/<token>)
    // or a bare token. Falls back to the raw text if no path match.
    const extractToken = useCallback((decodedText) => {
        const trimmed = decodedText.trim();
        const re = new RegExp(`(?:feed-scan|product-scan)\\/([a-zA-Z0-9_-]+)`, "i");
        const match = trimmed.match(re);
        const raw = match ? match[1] : trimmed;
        return raw.split("?")[0].split("#")[0].replace(/\/+$/, "");
    }, []);

    const stopCamera = useCallback(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setScanning(false);
    }, []);

    const fetchPreview = useCallback(async (token) => {
        setLoadingPreview(true);
        setResult(null);
        try {
            const { data } = await api.get(`/fulfillments/${type}/${token}`);
            setPreview({ ...data, token });
        } catch (err) {
            setResult({ ok: false, message: err.response?.data?.error || "Invalid QR code." });
            setPreview(null);
        } finally {
            setLoadingPreview(false);
        }
    }, [type]);

    // If we arrived via a direct QR link (…/feed-scan/<token> or
    // …/product-scan/<token>), skip camera scanning entirely and go
    // straight to the preview.
    useEffect(() => {
        if (tokenFromUrl) {
            fetchPreview(tokenFromUrl);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenFromUrl]);

    const tick = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            rafRef.current = requestAnimationFrame(tick);
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code?.data) {
            stopCamera();
            fetchPreview(extractToken(code.data));
            return;
        }
        rafRef.current = requestAnimationFrame(tick);
    }, [stopCamera, fetchPreview, extractToken]);

    const startCamera = async () => {
        setCameraError(null);
        setPreview(null);
        setResult(null);

        if (!navigator.mediaDevices?.getUserMedia) {
            setCameraError("Camera API unavailable. Make sure you're on http://localhost or https://.");
            return;
        }

        try {
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } },
                });
            } catch (innerErr) {
                console.warn("Rear camera unavailable, falling back to default camera:", innerErr);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setScanning(true);
            rafRef.current = requestAnimationFrame(tick);
        } catch (err) {
            console.error("getUserMedia failed:", err);
            setCameraError(
                err?.name === "NotAllowedError"
                    ? "Camera permission denied. Check the site permissions (padlock icon) in your browser and allow camera access."
                    : err?.name === "NotFoundError"
                        ? "No camera found on this device."
                        : err?.name === "NotReadableError"
                            ? "Camera is already in use by another app or browser tab."
                            : `Camera error: ${err?.name || "unknown"}. Use manual entry below.`
            );
        }
    };

    useEffect(() => () => stopCamera(), [stopCamera]);

    const handleConfirm = async () => {
        if (!preview?.token) return;
        setConfirming(true);
        try {
            const { data } = await api.post(`/fulfillments/${type}/${preview.token}/confirm`);
            setResult({ ok: true, message: data.message, items: data.items });
            setPreview(null);
        } catch (err) {
            setResult({ ok: false, message: err.response?.data?.error || "Could not confirm collection." });
        } finally {
            setConfirming(false);
        }
    };

    const reset = () => {
        setPreview(null);
        setResult(null);
        setManualToken("");
    };

    const dateLabel = useMemo(
        () => new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }),
        []
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex flex-col items-center px-4 py-6">
            <div className="w-full max-w-md flex flex-col gap-5">

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-0.5">
                            <Home size={16} className="text-gray-400" />
                            <Link to="/operator/dashboard" className="hover:text-gray-800 transition">
                                <ArrowLeft size={15} /> Back
                            </Link>
                            <span className="text-gray-300">/</span>
                            <span className="font-medium">{meta.crumb}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/30">
                                <PackageCheck size={12} /> Scanner
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {meta.label}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">Scan a receipt QR to verify and confirm collection</p>
                    </div>
                    <Link
                        to="/operator/dashboard"
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 text-xs font-bold hover:bg-gray-50/80 transition shadow-sm self-start sm:self-auto"
                    >
                        <ArrowLeft size={15} /> Back
                    </Link>
                </div>

                {!scanning && !preview && !result && (
                    <>
                        <button
                            onClick={startCamera}
                            className="flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all duration-200 active:scale-95"
                        >
                            <Camera size={20} /> Start Scanning
                        </button>
                        {cameraError && (
                            <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-600 text-sm font-medium backdrop-blur-sm shadow-sm">
                                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                                <span>{cameraError}</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-2 border-t border-gray-200/60">
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider">
                                Or enter token manually
                            </label>
                            <div className="flex gap-2">
                                <input
                                    value={manualToken}
                                    onChange={(e) => setManualToken(e.target.value)}
                                    placeholder="Paste receipt token…"
                                    className="flex-1 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition"
                                />
                                <button
                                    onClick={() => manualToken.trim() && fetchPreview(extractToken(manualToken))}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white text-sm font-bold shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200"
                                >
                                    Check
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <div className={`relative rounded-2xl overflow-hidden border-2 ${scanning ? "border-emerald-500/60 shadow-lg shadow-emerald-500/20" : "border-gray-200/60"}`}>
                    <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline autoPlay />
                    <canvas ref={canvasRef} className="hidden" />
                    {scanning && (
                        <>
                            <div className="absolute inset-0 pointer-events-none">
                                <div className="absolute inset-0 border-4 border-emerald-400/60 rounded-2xl m-6 animate-pulse" />
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-400/40 animate-ping" />
                            </div>
                            <button
                                onClick={stopCamera}
                                className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full p-2.5 hover:bg-black/80 transition border border-white/10 shadow-lg"
                            >
                                <XCircle size={18} className="text-white" />
                            </button>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-white font-medium border border-white/10">
                                Scanning for QR code…
                            </div>
                        </>
                    )}
                </div>

                {loadingPreview && (
                    <div className="flex items-center justify-center gap-3 py-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50">
                        <Loader2 size={20} className="animate-spin text-emerald-600" />
                        <span className="text-sm font-medium text-gray-600">Checking receipt…</span>
                    </div>
                )}

                {preview && (
                    <div className="bg-white/95 backdrop-blur-sm border border-gray-200/60 rounded-2xl shadow-lg shadow-gray-200/50 p-5 flex flex-col gap-4 relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <div className="flex items-center justify-between pb-2 border-b border-gray-200/60">
                                <span className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider">Transaction</span>
                                <span className="font-mono text-sm font-bold text-gray-900">{preview.transaction_id}</span>
                            </div>

                            {preview.status === "fulfilled" ? (
                                <div className="flex items-center gap-2 text-rose-600 text-sm font-medium bg-rose-50/80 border border-rose-200/60 rounded-xl px-4 py-3 mt-3">
                                    <XCircle size={18} className="shrink-0" />
                                    Already collected {preview.fulfilled_at ? `at ${new Date(preview.fulfilled_at).toLocaleString()}` : ""}
                                </div>
                            ) : preview.status === "cancelled" ? (
                                <div className="flex items-center gap-2 text-rose-600 text-sm font-medium bg-rose-50/80 border border-rose-200/60 rounded-xl px-4 py-3 mt-3">
                                    <XCircle size={18} className="shrink-0" />
                                    This receipt was cancelled and cannot be redeemed.
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2 mt-3">
                                        <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider">Items to collect</p>
                                        {preview.items.map((item) => (
                                            <div key={item.sale_id} className="flex items-center justify-between bg-gray-50/80 border border-gray-200/60 rounded-xl px-4 py-3 shadow-sm">
                                                <span className="text-sm font-semibold text-gray-800">{item.item_name}</span>
                                                <span className="text-sm font-mono font-bold text-emerald-600">{parseFloat(item.quantity).toFixed(2)} {item.unit}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleConfirm}
                                        disabled={confirming}
                                        className="flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 text-white font-bold shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-50 active:scale-95"
                                    >
                                        {confirming ? <Loader2 size={18} className="animate-spin" /> : <PackageCheck size={18} />}
                                        Confirm Collection
                                    </button>
                                </>
                            )}
                            <button onClick={reset} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition mt-2">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {result && (
                    <div className={`flex flex-col gap-3 rounded-2xl p-5 border shadow-lg ${result.ok
                        ? "bg-emerald-50/80 border-emerald-200/60 shadow-emerald-200/50"
                        : "bg-rose-50/80 border-rose-200/60 shadow-rose-200/50"}`}>
                        <div className={`flex items-center gap-2.5 font-bold ${result.ok ? "text-emerald-700" : "text-rose-600"}`}>
                            {result.ok ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                            {result.message}
                        </div>
                        {result.items && (
                            <div className="flex flex-col gap-1 pl-7">
                                {result.items.map((item, i) => (
                                    <span key={i} className="text-xs text-gray-600">
                                        {item.item_name}: {parseFloat(item.quantity).toFixed(2)} {item.unit}
                                    </span>
                                ))}
                            </div>
                        )}
                        <button onClick={reset} className="text-sm font-bold py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200">
                            Scan Next
                        </button>
                    </div>
                )}

                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {meta.crumb}</span>
                    <span>· {dateLabel}</span>
                </div>

            </div>
        </div>
    );
}