import { AlertTriangle } from "lucide-react";

/**
 * Shareable confirm dialog — replaces window.confirm() across the app.
 *
 * Controlled component: the parent owns the open/closed state and the
 * pending action, this component only renders and fires callbacks.
 *
 * @param {boolean}  open          - whether the dialog is visible
 * @param {string}   title         - dialog heading
 * @param {ReactNode} message      - body text (string or JSX, e.g. to bold a name)
 * @param {string}   confirmLabel  - text on the confirm button (default "Delete")
 * @param {string}   cancelLabel   - text on the cancel button (default "Cancel")
 * @param {'danger'|'default'} variant - danger = rose confirm button (default), default = dark
 * @param {boolean}  loading       - shows a spinner on the confirm button and disables both buttons
 * @param {Function} onConfirm     - called when the user confirms
 * @param {Function} onCancel      - called when the user cancels or closes
 */
export default function ConfirmDialog({
    open,
    title = "Are you sure?",
    message,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    variant = "danger",
    loading = false,
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    const confirmClasses =
        variant === "danger"
            ? "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40"
            : "bg-gradient-to-br from-gray-900 to-gray-800 shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40";

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onMouseDown={(e) => {
                // click on the backdrop (not the card) cancels, same as pressing Cancel
                if (e.target === e.currentTarget && !loading) onCancel?.();
            }}
        >
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                <div className="flex flex-col items-center gap-2 text-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center border border-rose-200/60 bg-rose-50/80 shadow-sm">
                        <AlertTriangle size={22} className="text-rose-500" />
                    </div>
                    <h2 className="text-gray-800 font-semibold text-base">{title}</h2>
                    {message && (
                        <p className="text-gray-500 text-sm leading-relaxed">{message}</p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm disabled:opacity-50"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all duration-200 disabled:opacity-50 ${confirmClasses}`}
                    >
                        {loading && (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}