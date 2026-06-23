import { ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AccessDenied() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-10 py-12 flex flex-col items-center gap-4 max-w-sm w-full text-center">
                <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
                    <ShieldOff size={26} className="text-rose-400" />
                </div>
                <div>
                    <p className="text-lg font-bold text-gray-800">Access Denied</p>
                    <p className="text-sm text-gray-400 mt-1">
                        You don't have permission to view this page. Contact your admin.
                    </p>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="mt-2 px-5 py-2 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition">
                    Go Back
                </button>
            </div>
        </div>
    );
}