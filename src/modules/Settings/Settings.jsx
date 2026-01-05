import React, { useState } from 'react';
import { useGoogleDrive } from '../../hooks/useGoogleDrive';
import DriveConnect from '../GoogleDrive/DriveConnect';
import { Settings as SettingsIcon, Download, Save } from 'lucide-react';

const Settings = () => {
    // We instantiate the hook here to pass it to DriveConnect
    // Note: In a real app with Redux/Context, this would be global state.
    // For now, since settings is a separate page, it's fine.
    const drive = useGoogleDrive();

    // Preference State
    const [downloadCopy, setDownloadCopy] = useState(
        localStorage.getItem('loklog_pref_download_copy') !== 'false' // Default true
    );

    const toggleDownload = () => {
        const newValue = !downloadCopy;
        setDownloadCopy(newValue);
        localStorage.setItem('loklog_pref_download_copy', newValue);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-20 p-6">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-8">
                <SettingsIcon className="text-gray-400" />
                Einstellungen
            </h1>

            {/* Google Drive Section */}
            <div className="bg-card border border-gray-800 rounded-2xl p-6 space-y-6">
                <div className="border-b border-gray-800 pb-4">
                    <h2 className="text-xl font-bold text-white">Google Drive Backup</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Verbinde dein Google Konto, um Fahrtenbücher automatisch in einem Ordner deiner Wahl zu speichern.
                    </p>
                </div>

                {/* Connection Component */}
                <DriveConnect {...drive} />

                {/* Preferences */}
                {drive.isConnected && (
                    <div className="bg-dark p-4 rounded-xl border border-gray-700 flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="text-white font-medium flex items-center gap-2">
                                <Download size={16} className="text-blue-400"/>
                                Lokale Kopie
                            </div>
                            <p className="text-xs text-gray-500">
                                Datei zusätzlich auf diesem Gerät herunterladen?
                            </p>
                        </div>

                        {/* Toggle Switch */}
                        <button
                            onClick={toggleDownload}
                            className={`w-12 h-6 rounded-full transition relative ${downloadCopy ? 'bg-green-600' : 'bg-gray-700'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${downloadCopy ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
