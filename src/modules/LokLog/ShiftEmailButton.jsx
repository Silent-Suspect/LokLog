import { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Mail, X, Send } from 'lucide-react';

const ShiftEmailButton = () => {
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);

    // Profile Data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        address: '',
        landline: '',
        mobile: '',
        senderEmail: '',
        recipientEmail: ''
    });

    // Shift Data
    const [shiftData, setShiftData] = useState({
        time: '',
        location: 'MKP'
    });

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            // Load from LocalStorage first (faster/offline)
            const local = localStorage.getItem('loklog_email_config');
            let initialData = {};

            if (local) {
                initialData = JSON.parse(local);
            }

            // If available, Clerk metadata overrides (or merges)
            // Note: We prioritize local storage for speed, but Clerk for sync. 
            // Better strategy: Merge them, preferring Clerk if available? 
            // Or typically if Clerk has data, it wins.
            if (user?.unsafeMetadata?.loklog_profile) {
                initialData = { ...initialData, ...user.unsafeMetadata.loklog_profile };
            }

            // Defaults from Clerk User Object if fields are missing in both
            if (!initialData.firstName && user?.firstName) initialData.firstName = user.firstName;
            if (!initialData.lastName && user?.lastName) initialData.lastName = user.lastName;
            if (!initialData.senderEmail && user?.primaryEmailAddress?.emailAddress) initialData.senderEmail = user.primaryEmailAddress.emailAddress;

            setFormData(prev => ({ ...prev, ...initialData }));

            // Set current time
            const now = new Date();
            const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            setShiftData(prev => ({ ...prev, time: timeString }));
        }
    }, [isOpen, user]);

    const handleSaveAndSend = async () => {
        // 1. Save Locally (Offline Safe)
        const profileToSave = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            address: formData.address,
            landline: formData.landline,
            mobile: formData.mobile,
            senderEmail: formData.senderEmail,
            recipientEmail: formData.recipientEmail
        };
        localStorage.setItem('loklog_email_config', JSON.stringify(profileToSave));

        // 2. Sync to Clerk (if online)
        if (user && navigator.onLine) {
            user.update({
                unsafeMetadata: { ...user.unsafeMetadata, loklog_profile: profileToSave }
            }).catch(err => console.warn("Cloud sync failed", err));
        }

        // 3. Generate Mail Content
        // Greeting Logic
        const hour = parseInt(shiftData.time.split(':')[0], 10);
        let greeting = "Guten Abend";
        if (hour >= 5 && hour < 11) greeting = "Guten Morgen";
        else if (hour >= 11 && hour < 18) greeting = "Guten Tag";

        const subject = `Dienstbeginn ${shiftData.location}`;

        const body = `${formData.firstName} ${formData.lastName}
${formData.address}
${formData.landline}
${formData.mobile}
${formData.senderEmail}

${greeting},

hier mein heutiger Dienstbeginn:
${shiftData.time} Uhr in ${shiftData.location}.

Mit freundlichen Grüßen
${formData.firstName} ${formData.lastName}`;

        // 4. Open Mail Client
        const mailtoLink = `mailto:${formData.recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;

        setIsOpen(false);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-bold transition border border-gray-700"
            >
                <Mail size={14} />
                Dienstbeginn
            </button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-dark border border-gray-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-gray-800 bg-gray-900/50">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Mail size={18} className="text-accent-blue" />
                                Dienstbeginn melden
                            </h3>
                            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-white transition">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                            {/* Personal Details Section */}
                            <div className="space-y-3">
                                <h4 className="text-xs uppercase text-gray-500 font-bold tracking-wider">Persönliche Daten (Sender)</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        placeholder="Vorname"
                                        value={formData.firstName}
                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                        className="bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                    />
                                    <input
                                        placeholder="Nachname"
                                        value={formData.lastName}
                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                        className="bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                    />
                                </div>
                                <input
                                    placeholder="Adresse (Straße, Ort)"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <input
                                        placeholder="Festnetz"
                                        value={formData.landline}
                                        onChange={e => setFormData({ ...formData, landline: e.target.value })}
                                        className="bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                    />
                                    <input
                                        placeholder="Mobilnummer"
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                        className="bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                    />
                                </div>
                                <input
                                    placeholder="Absender Email"
                                    value={formData.senderEmail}
                                    onChange={e => setFormData({ ...formData, senderEmail: e.target.value })}
                                    className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                />
                            </div>

                            {/* Recipient Section */}
                            <div className="space-y-3 pt-2 border-t border-gray-800">
                                <h4 className="text-xs uppercase text-gray-500 font-bold tracking-wider">Empfänger</h4>
                                <input
                                    placeholder="Empfänger Email (z.B. Dispo)"
                                    value={formData.recipientEmail}
                                    onChange={e => setFormData({ ...formData, recipientEmail: e.target.value })}
                                    className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:border-accent-blue focus:outline-none"
                                />
                            </div>

                            {/* Shift Data Section */}
                            <div className="space-y-3 pt-2 border-t border-gray-800">
                                <h4 className="text-xs uppercase text-gray-500 font-bold tracking-wider">Dienst Details</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-gray-400 block mb-1">Uhrzeit</label>
                                        <input
                                            type="time"
                                            value={shiftData.time}
                                            onChange={e => setShiftData({ ...shiftData, time: e.target.value })}
                                            className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-400 block mb-1">Ort (Meldestelle)</label>
                                        <input
                                            type="text"
                                            value={shiftData.location}
                                            onChange={e => setShiftData({ ...shiftData, location: e.target.value })}
                                            className="w-full bg-card border border-gray-700 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-accent-blue"
                                        />
                                    </div>
                                </div>
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-gray-900/50 border-t border-gray-800 flex justify-end gap-3">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-2 hover:bg-white/10 text-gray-400 rounded-lg font-bold text-sm transition"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleSaveAndSend}
                                className="px-4 py-2 bg-accent-blue hover:bg-blue-600 text-white rounded-lg font-bold text-sm transition flex items-center gap-2"
                            >
                                <Send size={16} />
                                Speichern & Senden
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ShiftEmailButton;
