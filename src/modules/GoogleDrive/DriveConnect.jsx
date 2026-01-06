import React, { useState } from 'react';
import { Cloud, Loader2, FolderOpen, LogOut, UploadCloud, Edit2 } from 'lucide-react';

const DriveConnect = ({
    isApiReady,
    isConnected,
    folderName,
    pickFolder,
    disconnect,
    uploadFile
}) => {
    const [loading, setLoading] = useState(false);
    const [statusMsg, setStatusMsg] = useState('');

    const handleConnect = async () => {
        setLoading(true);
        try {
            await pickFolder();
            setStatusMsg('Connected successfully!');
        } catch (err) {
            console.error(err);
            setStatusMsg('Connection cancelled or failed.');
        } finally {
            setLoading(false);
            setTimeout(() => setStatusMsg(''), 3000);
        }
    };

    const handleTestUpload = async () => {
        setLoading(true);
        try {
            // Create a dummy Excel blob
            const content = "Test Content";
            const blob = new Blob([content], { type: 'text/plain' });
            await uploadFile(blob, `Test_Upload_${new Date().toISOString()}.txt`);
            setStatusMsg('Test upload successful!');
        } catch (err) {
            console.error(err);
            setStatusMsg('Upload failed: ' + err.message);
        } finally {
            setLoading(false);
            setTimeout(() => setStatusMsg(''), 3000);
        }
    };

    if (!isApiReady) {
        return <div className="text-xs text-gray-500 animate-pulse">Loading Drive API...</div>;
    }

    if (isConnected) {
        return (
            <div className="bg-green-900/10 border border-green-900/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-400 font-bold">
                        <Cloud size={20} />
                        <span>Google Drive Connected</span>
                    </div>
                    <button onClick={disconnect} className="text-gray-500 hover:text-red-400 transition" title="Disconnect">
                        <LogOut size={16} />
                    </button>
                </div>

                <div className="flex items-center justify-between bg-black/20 p-2 rounded-lg">
                    <div className="text-sm text-gray-400 flex items-center gap-2 truncate mr-2">
                        <FolderOpen size={14} className="flex-shrink-0" />
                        <span className="text-white font-mono truncate">{folderName}</span>
                    </div>
                    <button
                        onClick={handleConnect}
                        disabled={loading}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded flex items-center gap-1 transition"
                    >
                        <Edit2 size={10} /> Change
                    </button>
                </div>

                {/* Test Button - Only for verification, can be removed later */}
                <button
                    onClick={handleTestUpload}
                    disabled={loading}
                    className="mt-2 w-full py-2 bg-green-900/20 hover:bg-green-900/30 text-green-400 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                    Test Upload
                </button>

                {statusMsg && <div className="text-xs text-center text-green-300">{statusMsg}</div>}
            </div>
        );
    }

    return (
        <div className="bg-card border border-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
                <Cloud size={18} className="text-gray-400" />
                Google Drive Backup
            </h3>
            <p className="text-xs text-gray-500">
                Connect your Google Drive to automatically save exported reports to a specific folder.
            </p>
            <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2"
            >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/1/12/Google_Drive_icon_%282020%29.svg" className="w-4 h-4" alt="Drive" />}
                Select Folder
            </button>
            {statusMsg && <div className="text-xs text-center text-red-400">{statusMsg}</div>}
        </div>
    );
};

export default DriveConnect;
