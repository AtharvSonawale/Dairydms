import { ShieldOff, Home, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AccessDenied() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center px-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-10 py-12 flex flex-col items-center gap-4 max-w-sm w-full text-center relative overflow-hidden">
                {/* Decorative blur elements */}
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-rose-400/5 blur-3xl" />
                <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-amber-400/5 blur-3xl" />

                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100/80 border border-rose-200/60 flex items-center justify-center shadow-lg shadow-rose-500/20">
                        <ShieldOff size={28} className="text-rose-500" />
                    </div>
                    <div>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <AlertTriangle size={18} className="text-amber-500" />
                            <p className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                Access Denied
                            </p>
                        </div>
                        <p className="text-sm text-gray-500 mt-1 max-w-xs">
                            You don't have permission to view this page. Please contact your administrator for access.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex-1 px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-br from-gray-900 to-gray-700 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Home size={15} />
                            Go Back
                        </button>
                    </div>

                    <p className="text-[10px] text-gray-400 mt-2">
                        If you believe this is a mistake, please contact your system administrator.
                    </p>
                </div>
            </div>
        </div>
    );
}