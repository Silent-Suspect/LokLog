import { useState } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FileDown, FileSpreadsheet, AlertTriangle } from 'lucide-react';

const ExcelDebug = () => {
    const [loading, setLoading] = useState(false);

    // 1. Download RAW Template via Proxy
    const downloadRaw = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/template');
            if (!res.ok) throw new Error(`Proxy Error: ${res.statusText}`);

            const blob = await res.blob();
            saveAs(blob, 'raw_template.xlsx');
            alert('✅ Raw template downloaded!');
        } catch (err) {
            console.error(err);
            alert(`❌ Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // 2. Load, Fill & Save via ExcelJS
    const fillAndDownload = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/template');
            if (!res.ok) throw new Error(`Proxy Error: ${res.statusText}`);

            const buffer = await res.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);

            const worksheet = workbook.getWorksheet(1); // First sheet

            // Write Test Data
            worksheet.getCell('H4').value = '24.12.2025';
            worksheet.getCell('E11').value = '12:00';
            worksheet.getCell('A13').value = 123456;
            worksheet.getCell('L15').value = 'Hallo aus dem Code!';

            // Generate Output
            const outBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([outBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            saveAs(blob, 'filled_test.xlsx');
            alert('✅ Filled Excel generated!');

        } catch (err) {
            console.error(err);
            alert(`❌ Excel Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-2xl mx-auto space-y-8 bg-card border border-gray-800 rounded-xl m-8">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <FileSpreadsheet className="text-green-500" />
                    Excel Proxy Debugging
                </h2>
                <p className="text-gray-400 mt-2">
                    Testet den Proxy-Endpoint und die ExcelJS-Verarbeitung im Browser.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                    onClick={downloadRaw}
                    disabled={loading}
                    className="flex flex-col items-center justify-center p-6 bg-gray-800 rounded-xl hover:bg-gray-700 transition border border-gray-700 disabled:opacity-50"
                >
                    <FileDown size={32} className="text-blue-400 mb-3" />
                    <span className="font-bold text-white">Download Raw</span>
                    <span className="text-xs text-gray-400 mt-1">via /api/template</span>
                </button>

                <button
                    onClick={fillAndDownload}
                    disabled={loading}
                    className="flex flex-col items-center justify-center p-6 bg-gray-800 rounded-xl hover:bg-gray-700 transition border border-gray-700 disabled:opacity-50"
                >
                    <FileSpreadsheet size={32} className="text-green-400 mb-3" />
                    <span className="font-bold text-white">Fill & Download</span>
                    <span className="text-xs text-gray-400 mt-1">ExcelJS Processing</span>
                </button>
            </div>

            {loading && <div className="text-center text-blue-400 animate-pulse">Processing...</div>}

            <div className="flex items-center gap-3 p-4 bg-yellow-900/10 border border-yellow-900/30 rounded-lg text-yellow-500 text-sm">
                <AlertTriangle size={16} />
                <span>Ensure <strong>TEMPLATE_URL</strong> is set in .env.local!</span>
            </div>
        </div>
    );
};

export default ExcelDebug;
