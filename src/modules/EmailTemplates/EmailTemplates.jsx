import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Mail, Clock, MapPin, User, Save, Send, Settings, CheckCircle, X, RotateCcw } from 'lucide-react';

const EmailTemplates = () => {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'settings'

    // Defaults
    const DEFAULT_TEMPLATES = {
        start: `[Briefkopf]\n\n[Begrüßung],\n\nhier mein heutiger Dienstbeginn:\n[ZEIT] Uhr in [ORT].\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        end: `[Briefkopf]\n\n[Begrüßung],\n\nhier mein heutiges Dienstende:\n[ZEIT] Uhr in [ORT].\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        times: `[Briefkopf]\n\n[Begrüßung],\n\nhier meine heutigen Dienstzeiten:\n\nDienstbeginn Plan: [PLAN_START] Uhr\nDienstbeginn Ist: [IST_START] Uhr\n\nAbfahrt: [ABFAHRT] Uhr\nAnkunft: [ANKUNFT] Uhr\n\nDienstende Plan: [PLAN_ENDE] Uhr\nDienstende Ist: [IST_ENDE] Uhr\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`
    };

    // User Profile & Templates State
    const [profile, setProfile] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        street: '',
        zip: '',
        city: '',
        landline: '',
        mobile: '',
        senderEmail: user?.primaryEmailAddress?.emailAddress || '',
        templates: DEFAULT_TEMPLATES
    });

    // Load Profile (Hybrid: Cloud -> Local)
    useEffect(() => {
        const cloudData = user?.unsafeMetadata?.loklog_profile;
        const localData = localStorage.getItem('loklog_email_config');

        if (cloudData) {
            // Merge defaults in case templates are missing in cloud data
            setProfile(prev => ({
                ...prev,
                ...cloudData,
                street: cloudData.street || '',
                zip: cloudData.zip || '',
                city: cloudData.city || '',
                templates: { ...DEFAULT_TEMPLATES, ...(cloudData.templates || {}) }
            }));
        } else if (localData) {
            const parsed = JSON.parse(localData);
            setProfile(prev => ({
                ...prev,
                ...parsed,
                street: parsed.street || '',
                zip: parsed.zip || '',
                city: parsed.city || '',
                templates: { ...DEFAULT_TEMPLATES, ...(parsed.templates || {}) }
            }));
        } else {
            // Initial load with defaults
            setProfile(prev => ({ ...prev, templates: DEFAULT_TEMPLATES }));
        }
    }, [user]);

    // Save Profile
    const handleSaveProfile = async () => {
        // 1. Save Local
        localStorage.setItem('loklog_email_config', JSON.stringify(profile));
        // 2. Save Cloud
        if (user) {
            try {
                await user.update({
                    unsafeMetadata: { ...user.unsafeMetadata, loklog_profile: profile }
                });
                alert("Einstellungen gespeichert (Lokal & Cloud)!");
            } catch (e) {
                console.warn("Cloud sync failed", e);
                alert("Gespeichert (Lokal) - Offline Modus");
            }
        }
    };

    const handleResetTemplates = () => {
        if (window.confirm("Möchtest du wirklich alle Vorlagen auf den Standard zurücksetzen?")) {
            setProfile(prev => ({ ...prev, templates: DEFAULT_TEMPLATES }));
        }
    };

    // Template Modal Logic
    const [selectedTemplate, setSelectedTemplate] = useState(null); // 'start', 'end', 'times'
    const [templateData, setTemplateData] = useState({
        time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        location: 'MKP',
        endTime: '',
        pause: '0',
        planStart: '',
        actualStart: '',
        departure: '',
        arrival: '',
        planEnd: '',
        actualEnd: ''
    });
    const [includeHeader, setIncludeHeader] = useState(true);
    const [copied, setCopied] = useState(false);

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 11) return "Guten Morgen";
        if (h < 18) return "Guten Tag";
        return "Guten Abend";
    };

    const parseTemplate = (rawText) => {
        let text = rawText || '';
        const greeting = getGreeting();
        // Time Formatter: HH:MM -> HH.MM
        const fmt = (t) => t ? t.replace(':', '.') : '--.--';

        // Header Logic
        let headerBlock = '';
        if (includeHeader) {
            headerBlock = `${profile.firstName} ${profile.lastName}`;
            if (profile.street) headerBlock += `\n${profile.street}`;
            if (profile.zip || profile.city) headerBlock += `\n${profile.zip} ${profile.city}`;
            if (profile.landline) headerBlock += `\n${profile.landline}`;
            if (profile.mobile) headerBlock += `\n${profile.mobile}`;
            if (profile.senderEmail) headerBlock += `\n${profile.senderEmail}`;
        }

        // Replacements
        text = text.replaceAll('[Briefkopf]', headerBlock);
        text = text.replaceAll('[Begrüßung]', greeting);
        text = text.replaceAll('[Vorname]', profile.firstName);
        text = text.replaceAll('[Nachname]', profile.lastName);

        // Data Replacements
        text = text.replaceAll('[ZEIT]', fmt(templateData.time));
        text = text.replaceAll('[ORT]', templateData.location);
        text = text.replaceAll('[ENDE]', fmt(templateData.endTime));
        text = text.replaceAll('[PAUSE]', templateData.pause || '0');

        text = text.replaceAll('[PLAN_START]', fmt(templateData.planStart));
        text = text.replaceAll('[IST_START]', fmt(templateData.actualStart));
        text = text.replaceAll('[ABFAHRT]', fmt(templateData.departure));
        text = text.replaceAll('[ANKUNFT]', fmt(templateData.arrival));
        text = text.replaceAll('[PLAN_ENDE]', fmt(templateData.planEnd));
        text = text.replaceAll('[IST_ENDE]', fmt(templateData.actualEnd));

        return text;
    };

    const generateMailto = () => {
        // 1. Recipient
        const recipient = selectedTemplate === 'times' ? 'dienstzeiten@dispotf.de' : 'operations@dispotf.de';

        // 2. Format Helper
        const fmt = (t) => t ? t.replace(':', '.') : '--.--';

        // 3. Subject
        const subject = selectedTemplate === 'start' ? 'Dienstbeginn' :
            selectedTemplate === 'end' ? 'Dienstende' :
                'Dienstzeiten';

        // 4. Dynamic Greeting (Strict Range)
        const h = new Date().getHours();
        let timeGreeting = 'Guten Tag';
        if (h >= 3 && h < 11) timeGreeting = 'Guten Morgen';
        else if (h >= 18 || h < 3) timeGreeting = 'Guten Abend';

        // 5. Header (Corrected Variables & Labels)
        let header = '';
        if (includeHeader) {
            header = `${profile.firstName} ${profile.lastName}`;
            if (profile.street) header += `\n${profile.street}`;
            if (profile.zip || profile.city) header += `\n${profile.zip} ${profile.city}`;
            // Note: using landline from state, labeled as Tel
            if (profile.landline) header += `\nTel: ${profile.landline}`;
            if (profile.mobile) header += `\nMobil: ${profile.mobile}`;
            if (profile.senderEmail) header += `\nEmail: ${profile.senderEmail}`;
        }

        // 6. Build Body Text
        let finalBody = (profile.templates[selectedTemplate] || DEFAULT_TEMPLATES[selectedTemplate])
            .replace('[Briefkopf]', header)
            .replace('[Begrüßung]', timeGreeting)
            .replace('[Vorname]', profile.firstName)
            .replace('[Nachname]', profile.lastName)
            // Legacy
            .replace('[ZEIT]', fmt(templateData.time))
            .replace('[ORT]', templateData.location || '')
            // Detailed Fields
            .replace('[PLAN_START]', fmt(templateData.planStart))
            .replace('[IST_START]', fmt(templateData.actualStart))
            .replace('[ABFAHRT]', fmt(templateData.departure))
            .replace('[ANKUNFT]', fmt(templateData.arrival))
            .replace('[IST_ENDE]', fmt(templateData.actualEnd));

        // 7. FALLBACK: Copy to Clipboard (Plan B)
        try {
            navigator.clipboard.writeText(finalBody);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000); // Reset after 3s
        } catch (err) {
            console.warn("Clipboard access failed", err);
        }

        // 8. ENCODING STRATEGY: MANUAL SPLIT & JOIN (%0A)
        // Split by JS newline, encode parts, join with explicit %0A
        const bodyEncoded = finalBody.split('\n')
            .map(line => encodeURIComponent(line))
            .join('%0A');

        window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${bodyEncoded}`;
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8 pb-24">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Mail className="text-accent-blue" /> Email Vorlagen
            </h1>

            {/* TABS */}
            <div className="flex gap-4 border-b border-gray-800 pb-1">
                <button onClick={() => setActiveTab('templates')} className={`pb-3 px-4 flex items-center gap-2 ${activeTab === 'templates' ? 'border-b-2 border-accent-blue text-accent-blue font-bold' : 'text-gray-400'}`}>
                    <Mail size={18} /> Vorlagen
                </button>
                <button onClick={() => setActiveTab('settings')} className={`pb-3 px-4 flex items-center gap-2 ${activeTab === 'settings' ? 'border-b-2 border-accent-blue text-accent-blue font-bold' : 'text-gray-400'}`}>
                    <Settings size={18} /> Einstellungen
                </button>
            </div>

            {activeTab === 'templates' ? (
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Card 1: Dienstbeginn */}
                    <div onClick={() => setSelectedTemplate('start')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-green-500/50 cursor-pointer transition group">
                        <div className="w-12 h-12 rounded-full bg-green-900/20 flex items-center justify-center text-green-400 mb-4 group-hover:scale-110 transition">
                            <CheckCircle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Dienstbeginn</h3>
                        <p className="text-gray-400 text-sm mt-2">Meldung über Startzeit und Ort.</p>
                    </div>

                    {/* Card 2: Dienstende */}
                    <div onClick={() => setSelectedTemplate('end')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-red-500/50 cursor-pointer transition group">
                        <div className="w-12 h-12 rounded-full bg-red-900/20 flex items-center justify-center text-red-400 mb-4 group-hover:scale-110 transition">
                            <X size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Dienstende</h3>
                        <p className="text-gray-400 text-sm mt-2">Meldung über Feierabend und Ort.</p>
                    </div>

                    {/* Card 3: Dienstzeiten */}
                    <div onClick={() => setSelectedTemplate('times')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-blue-500/50 cursor-pointer transition group">
                        <div className="w-12 h-12 rounded-full bg-blue-900/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
                            <Clock size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Dienstzeiten</h3>
                        <p className="text-gray-400 text-sm mt-2">Zusammenfassung von Start, Ende & Pause.</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT: Contact Data */}
                    <div className="bg-card p-6 rounded-2xl border border-gray-800 space-y-4">
                        <h2 className="text-xl font-bold text-white mb-4">Briefkopf & Kontaktdaten</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500">Vorname</label>
                                <input value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Nachname</label>
                                <input value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>

                            <div className="col-span-2">
                                <label className="text-xs text-gray-500">Straße & Hausnummer</label>
                                <input value={profile.street} onChange={e => setProfile({ ...profile, street: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>

                            <div className="col-span-1">
                                <label className="text-xs text-gray-500">PLZ</label>
                                <input value={profile.zip} onChange={e => setProfile({ ...profile, zip: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>
                            <div className="col-span-1">
                                <label className="text-xs text-gray-500">Ort</label>
                                <input value={profile.city} onChange={e => setProfile({ ...profile, city: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>

                            <div>
                                <label className="text-xs text-gray-500">Festnetz</label>
                                <input value={profile.landline} onChange={e => setProfile({ ...profile, landline: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500">Mobil</label>
                                <input value={profile.mobile} onChange={e => setProfile({ ...profile, mobile: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>

                            <div className="col-span-2">
                                <label className="text-xs text-gray-500">Email (Absender)</label>
                                <input value={profile.senderEmail} onChange={e => setProfile({ ...profile, senderEmail: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Template Editors */}
                    <div className="bg-card p-6 rounded-2xl border border-gray-800 space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Vorlagen bearbeiten</h2>
                            <button onClick={handleResetTemplates} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                <RotateCcw size={12} /> Reset
                            </button>
                        </div>

                        {/* Legend */}
                        <div className="text-[10px] text-gray-500 bg-black/20 p-2 rounded border border-gray-800">
                            <b>Platzhalter:</b> [Briefkopf], [Begrüßung], [Vorname], [Nachname], [ZEIT], [ORT], [ENDE], [PAUSE]
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-green-400 font-bold block mb-1">Dienstbeginn</label>
                                <textarea
                                    rows={4}
                                    value={profile.templates?.start || ''}
                                    onChange={e => setProfile({ ...profile, templates: { ...profile.templates, start: e.target.value } })}
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-red-400 font-bold block mb-1">Dienstende</label>
                                <textarea
                                    rows={4}
                                    value={profile.templates?.end || ''}
                                    onChange={e => setProfile({ ...profile, templates: { ...profile.templates, end: e.target.value } })}
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-blue-400 font-bold block mb-1">Dienstzeiten</label>
                                <textarea
                                    rows={4}
                                    value={profile.templates?.times || ''}
                                    onChange={e => setProfile({ ...profile, templates: { ...profile.templates, times: e.target.value } })}
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                />
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSaveProfile} className="mt-4 bg-accent-blue text-white px-6 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2">
                        <Save size={18} /> Einstellungen Speichern
                    </button>
                </div>
            )}

            {/* MODAL FOR COMPOSER */}
            {selectedTemplate && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-card p-6 rounded-2xl border border-gray-700 w-full max-w-md space-y-4 relative">
                        <button onClick={() => setSelectedTemplate(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>

                        <h2 className="text-xl font-bold text-white">
                            {selectedTemplate === 'start' && 'Dienstbeginn melden'}
                            {selectedTemplate === 'end' && 'Dienstende melden'}
                            {selectedTemplate === 'times' && 'Dienstzeiten melden'}
                        </h2>

                        <div className="space-y-3">

                            {/* TIMES TEMPLATE INPUTS (Detailed Grid) */}
                            {selectedTemplate === 'times' && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 gap-4 p-3 bg-dark/50 rounded-xl border border-gray-700">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Dienstbeginn Plan</label>
                                            <input type="time" value={templateData.planStart} onChange={e => setTemplateData({ ...templateData, planStart: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-accent-blue uppercase font-bold">Dienstbeginn Ist</label>
                                            <input type="time" value={templateData.actualStart} onChange={e => setTemplateData({ ...templateData, actualStart: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-accent-blue" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 p-3 bg-dark/50 rounded-xl border border-gray-700">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Abfahrt</label>
                                            <input type="time" value={templateData.departure} onChange={e => setTemplateData({ ...templateData, departure: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Ankunft</label>
                                            <input type="time" value={templateData.arrival} onChange={e => setTemplateData({ ...templateData, arrival: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 p-3 bg-dark/50 rounded-xl border border-gray-700">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Dienstende Plan</label>
                                            <input type="time" value={templateData.planEnd} onChange={e => setTemplateData({ ...templateData, planEnd: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-accent-blue uppercase font-bold">Dienstende Ist</label>
                                            <input type="time" value={templateData.actualEnd} onChange={e => setTemplateData({ ...templateData, actualEnd: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white focus:border-accent-blue" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STANDARD INPUTS (Start/End only) */}
                            {selectedTemplate !== 'times' && (
                                <>
                                    <div>
                                        <label className="text-xs text-gray-500">Uhrzeit</label>
                                        <input type="time" value={templateData.time} onChange={e => setTemplateData({ ...templateData, time: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Ort / Kürzel</label>
                                        <input type="text" value={templateData.location} onChange={e => setTemplateData({ ...templateData, location: e.target.value.toUpperCase() })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                    </div>
                                </>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" checked={includeHeader} onChange={e => setIncludeHeader(e.target.checked)} className="rounded bg-dark border-gray-600" />
                                <span className="text-sm text-gray-300">Briefkopf mitsenden?</span>
                            </div>
                        </div>

                        {/* Feedback Message */}
                        {copied && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-20 left-0 right-0 mx-auto w-max bg-green-500/90 text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2">
                                <CheckCircle size={12} /> Text in Zwischenablage kopiert!
                            </div>
                        )}

                        <button onClick={generateMailto} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 flex items-center justify-center gap-2 mt-4 relative">
                            <Send size={18} /> Email App öffnen
                        </button>

                        {/* DEBUG VERSION INDICATOR */}
                        <div className="text-[10px] text-gray-600 text-center mt-6 font-mono border-t border-gray-800/50 pt-2">
                            v2.2 (Auto-Copy Fallback)
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailTemplates;
