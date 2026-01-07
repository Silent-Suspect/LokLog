import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { Mail, Clock, MapPin, User, Save, Send, Settings, CheckCircle, X, RotateCcw } from 'lucide-react';

const EmailTemplates = () => {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState('templates'); // 'templates' | 'settings'

    // Defaults
    const DEFAULT_TEMPLATES = {
        header: `[Vorname] [Nachname]\n[Strasse]\n[PLZ] [Ort]\n[Festnetz]\n[Mobil]\n[Email]`,
        start: `[Briefkopf]\n\n[Begrüßung],\n\nhier mein heutiger Dienstbeginn:\n[ZEIT] Uhr in [ORT].\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        end: `[Briefkopf]\n\n[Begrüßung],\n\nhier mein heutiges Dienstende:\n[ZEIT] Uhr in [ORT].\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        times: `[Briefkopf]\n\n[Begrüßung],\n\nhier meine heutigen Dienstzeiten:\n\nDienstbeginn Plan: [PLAN_START] Uhr\nDienstbeginn Ist: [IST_START] Uhr\n\nAbfahrt: [ABFAHRT] Uhr\nAnkunft: [ANKUNFT] Uhr\n\nDienstende Plan: [PLAN_ENDE] Uhr\nDienstende Ist: [IST_ENDE] Uhr\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        roster: `[Briefkopf]\n\n[Begrüßung],\n\nhiermit bestätige ich den aktuellen Dienstplan.\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        timesheet: `[Briefkopf]\n\n[Begrüßung],\n\n[INTRO_TEXT] [DATUM_BERICHT][EXTRA_TEXT].\n\n[TRAVEL_BLOCK]\n\nMit freundlichen Grüßen\n[Vorname] [Nachname]`,
        travel: `[Datum_AnAbreise]\n[AnAbreise]\nvon [START_ORT] nach [ZIEL_ORT]\n[START_ZEIT] Uhr - [END_ZEIT]`
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

    const handleClearTimesheet = () => {
        setTemplateData(prev => ({
            ...prev,
            dateRequired: new Date().toISOString().split('T')[0],
            dateOptional: '',
            travelAnreise: false,
            travelAbreise: false,
            anreiseDate: '',
            anreiseStart: '',
            anreiseEnd: '',
            anreiseStartTime: '',
            anreiseEndTime: '',
            abreiseDate: '',
            abreiseStart: '',
            abreiseEnd: '',
            abreiseStartTime: '',
            abreiseEndTime: ''
        }));
    };

    // Template Modal Logic
    const [selectedTemplate, setSelectedTemplate] = useState(null); // 'start', 'end', 'times', 'roster', 'timesheet'
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
        actualEnd: '',
        // Stundenzettel
        dateRequired: new Date().toISOString().split('T')[0],
        dateOptional: '',
        travelAnreise: false,
        travelAbreise: false,
        // Anreise
        anreiseDate: '',
        anreiseStart: '',
        anreiseEnd: '',
        anreiseStartTime: '',
        anreiseEndTime: '',
        // Abreise
        abreiseDate: '',
        abreiseStart: '',
        abreiseEnd: '',
        abreiseStartTime: '',
        abreiseEndTime: '',
        // Roster
        rosterName: ''
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

        // Header Logic (New: Template Based)
        let headerBlock = '';
        if (includeHeader) {
            const rawHeader = profile.templates?.header || DEFAULT_TEMPLATES.header;
            headerBlock = rawHeader
                .replaceAll('[Vorname]', profile.firstName)
                .replaceAll('[Nachname]', profile.lastName)
                .replaceAll('[Strasse]', profile.street)
                .replaceAll('[PLZ]', profile.zip)
                .replaceAll('[Ort]', profile.city)
                .replaceAll('[Festnetz]', profile.landline)
                .replaceAll('[Mobil]', profile.mobile)
                .replaceAll('[Email]', profile.senderEmail);

            // Clean up empty lines if variables are missing
            // headerBlock = headerBlock.replace(/\n\s*\n/g, '\n');
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
        let recipient = 'operations@dispotf.de';
        if (selectedTemplate === 'times') recipient = 'dienstzeiten@dispotf.de';
        if (selectedTemplate === 'roster') recipient = 'personalplanung-dtf@dispotf.de';
        if (selectedTemplate === 'timesheet') recipient = 'stundenzettel@dispotf.de';

        // 2. Format Helper
        const fmt = (t) => t ? t.replace(':', '.') : '--.--';

        // 3. Subject
        let subject = '';
        if (selectedTemplate === 'start') subject = 'Dienstbeginn';
        else if (selectedTemplate === 'end') subject = 'Dienstende';
        else if (selectedTemplate === 'times') subject = 'Dienstzeiten';
        else if (selectedTemplate === 'roster') subject = 'Re: aktueller Dienstplan - BITTE BESTÄTIGEN!';
        else if (selectedTemplate === 'timesheet') {
            // Dynamic Subject for Stundenzettel
            const isSingleDay = !templateData.dateOptional || templateData.dateRequired === templateData.dateOptional;
            const prefix = isSingleDay ? 'Fahrtbericht' : 'Fahrtberichte';

            const datePart = !isSingleDay
                ? `${new Date(templateData.dateRequired).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${new Date(templateData.dateOptional).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
                : new Date(templateData.dateRequired).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

            let suffix = '';
            if (templateData.travelAnreise && templateData.travelAbreise) suffix = ', An- und Abreise';
            else if (templateData.travelAnreise) suffix = ', Anreise';
            else if (templateData.travelAbreise) suffix = ', Abreise';

            subject = `${prefix} ${datePart}${suffix}`;
        }

        // 4. Dynamic Greeting (Strict Range)
        const h = new Date().getHours();
        let timeGreeting = 'Guten Tag';
        if (h >= 3 && h < 11) timeGreeting = 'Guten Morgen';
        else if (h >= 18 || h < 3) timeGreeting = 'Guten Abend';

        if (selectedTemplate === 'roster' && templateData.rosterName) {
            timeGreeting = `Hallo ${templateData.rosterName}`;
        }

        // 5. Header (New: Template Based)
        let header = '';
        if (includeHeader) {
            const rawHeader = profile.templates?.header || DEFAULT_TEMPLATES.header;
            header = rawHeader
                .replaceAll('[Vorname]', profile.firstName)
                .replaceAll('[Nachname]', profile.lastName)
                .replaceAll('[Strasse]', profile.street)
                .replaceAll('[PLZ]', profile.zip)
                .replaceAll('[Ort]', profile.city)
                .replaceAll('[Festnetz]', profile.landline)
                .replaceAll('[Mobil]', profile.mobile)
                .replaceAll('[Email]', profile.senderEmail);
        }

        // 6. Build Body Text
        let rawBody = profile.templates?.[selectedTemplate] || DEFAULT_TEMPLATES[selectedTemplate];

        // --- SPECIAL LOGIC FOR STUNDENZETTEL ---
        let stundenzettelReplacements = {};
        if (selectedTemplate === 'timesheet') {
            // A. Intro Grammar (Singular/Plural) & Date Range
            const isSingleDay = !templateData.dateOptional || templateData.dateRequired === templateData.dateOptional;
            stundenzettelReplacements.INTRO_TEXT = isSingleDay
                ? "anbei mein Fahrtbericht für den"
                : "anbei meine Fahrtberichte für den";

            const dateStr = !isSingleDay
                ? `${new Date(templateData.dateRequired).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} - ${new Date(templateData.dateOptional).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
                : new Date(templateData.dateRequired).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
            stundenzettelReplacements.DATUM_BERICHT = dateStr;

            // B. Optional Intro Text ("sowie...")
            // If any travel is selected, we add the text.
            let extraText = '';
            if (templateData.travelAnreise && templateData.travelAbreise) {
                extraText = ' (sowie die Angaben zu meiner An- und Abreise)';
            } else if (templateData.travelAnreise) {
                extraText = ' (sowie die Angaben zu meiner Anreise)';
            } else if (templateData.travelAbreise) {
                extraText = ' (sowie die Angaben zu meiner Abreise)';
            }
            stundenzettelReplacements.EXTRA_TEXT = extraText;

            // C. Travel Blocks
            let travelBlocks = [];
            const travelTemplate = profile.templates?.travel || DEFAULT_TEMPLATES.travel;

            // Helper to process a travel block
            const processTravel = (type, date, start, end, sTime, eTime) => {
                let block = travelTemplate;
                // Basic
                block = block.replaceAll('[Datum_AnAbreise]', date ? new Date(date).toLocaleDateString('de-DE') : 'DD.MM.YYYY');
                block = block.replaceAll('[AnAbreise]', type);
                block = block.replaceAll('[START_ORT]', start || 'START');
                block = block.replaceAll('[ZIEL_ORT]', end || 'ZIEL');

                // Time Logic with +1 Tag
                // Note: The template now does NOT include "Uhr" for the end time, so we must add it here.
                let timeStrEnd = fmt(eTime) + ' Uhr';
                if (sTime && eTime) {
                    const [sh, sm] = sTime.split(':').map(Number);
                    const [eh, em] = eTime.split(':').map(Number);
                    if (eh < sh || (eh === sh && em < sm)) {
                        timeStrEnd += ' (+1 Tag)';
                    }
                }

                block = block.replaceAll('[START_ZEIT]', fmt(sTime));
                block = block.replaceAll('[END_ZEIT]', timeStrEnd);
                return block;
            };

            if (templateData.travelAnreise) {
                travelBlocks.push(processTravel('Anreise', templateData.anreiseDate, templateData.anreiseStart, templateData.anreiseEnd, templateData.anreiseStartTime, templateData.anreiseEndTime));
            }
            if (templateData.travelAbreise) {
                travelBlocks.push(processTravel('Abreise', templateData.abreiseDate, templateData.abreiseStart, templateData.abreiseEnd, templateData.abreiseStartTime, templateData.abreiseEndTime));
            }

            stundenzettelReplacements.TRAVEL_BLOCK = travelBlocks.join('\n\n');
        }

        let finalBody = rawBody
            .replaceAll('[Briefkopf]', header)
            .replaceAll('[Begrüßung]', timeGreeting)
            .replaceAll('[Vorname]', profile.firstName)
            .replaceAll('[Nachname]', profile.lastName)
            // Legacy
            .replaceAll('[ZEIT]', fmt(templateData.time))
            .replaceAll('[ORT]', templateData.location || '')
            // Detailed Fields
            .replaceAll('[PLAN_START]', fmt(templateData.planStart))
            .replaceAll('[IST_START]', fmt(templateData.actualStart))
            .replaceAll('[ABFAHRT]', fmt(templateData.departure))
            .replaceAll('[ANKUNFT]', fmt(templateData.arrival))
            .replaceAll('[PLAN_ENDE]', fmt(templateData.planEnd))
            .replaceAll('[IST_ENDE]', fmt(templateData.actualEnd));

        // Apply Stundenzettel Specifics
        if (selectedTemplate === 'timesheet') {
            finalBody = finalBody
                .replaceAll('[INTRO_TEXT]', stundenzettelReplacements.INTRO_TEXT)
                .replaceAll('[DATUM_BERICHT]', stundenzettelReplacements.DATUM_BERICHT)
                .replaceAll('[EXTRA_TEXT]', stundenzettelReplacements.EXTRA_TEXT)
                .replaceAll('[TRAVEL_BLOCK]', stundenzettelReplacements.TRAVEL_BLOCK);

            // Clean up double periods (e.g. "06.01.." -> "06.01.")
            finalBody = finalBody.replace(/\.\./g, '.');
        }

        // 7. SAFETY NET: Copy to Clipboard
        // (Disabled per request)
        /*
        try {
            // Copy the CLEAN text (with normal newlines) to clipboard
            navigator.clipboard.writeText(finalBody);
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
        } catch (err) {
            console.warn("Clipboard failed", err);
        }
        */

        // 8. ENCODING: Manual Split + %0D%0A Join
        // We split by JS newline and rejoin with the explicit hex code for CRLF
        const bodyEncoded = finalBody.split('\n')
            .map(line => encodeURIComponent(line))
            .join('%0D%0A');

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

                    {/* Card 4: Dienstplan */}
                    <div onClick={() => setSelectedTemplate('roster')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-purple-500/50 cursor-pointer transition group">
                        <div className="w-12 h-12 rounded-full bg-purple-900/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition">
                            <CheckCircle size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Dienstplan</h3>
                        <p className="text-gray-400 text-sm mt-2">Bestätigung des aktuellen Dienstplans.</p>
                    </div>

                    {/* Card 5: Stundenzettel */}
                    <div onClick={() => setSelectedTemplate('timesheet')} className="bg-card p-6 rounded-2xl border border-gray-800 hover:border-orange-500/50 cursor-pointer transition group">
                        <div className="w-12 h-12 rounded-full bg-orange-900/20 flex items-center justify-center text-orange-400 mb-4 group-hover:scale-110 transition">
                            <Mail size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-white">Stundenzettel</h3>
                        <p className="text-gray-400 text-sm mt-2">Fahrtberichte & Anreise/Abreise.</p>
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
                        <div className="text-[10px] text-gray-500 bg-black/20 p-2 rounded border border-gray-800 space-y-1">
                            <div><b>Allgemein:</b> [Briefkopf], [Begrüßung], [Vorname], [Nachname]</div>
                            <div><b>Briefkopf:</b> [Strasse], [PLZ], [Ort], [Festnetz], [Mobil], [Email]</div>
                            <div><b>Dienste:</b> [ZEIT], [ORT], [ENDE], [PAUSE], [PLAN_START/ENDE], [IST_START/ENDE]</div>
                            <div><b>Stundenzettel:</b> [INTRO_TEXT], [DATUM_BERICHT], [TRAVEL_BLOCK], [EXTRA_TEXT]</div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-white font-bold block mb-1">Briefkopf (Global)</label>
                                <textarea
                                    rows={4}
                                    value={profile.templates?.header || ''}
                                    onChange={e => setProfile({ ...profile, templates: { ...profile.templates, header: e.target.value } })}
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-blue-400 font-bold block mb-1">Dienstzeiten</label>
                                    <textarea
                                        rows={4}
                                        value={profile.templates?.times || ''}
                                        onChange={e => setProfile({ ...profile, templates: { ...profile.templates, times: e.target.value } })}
                                        className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-purple-400 font-bold block mb-1">Dienstplan bestätigen</label>
                                    <textarea
                                        rows={4}
                                        value={profile.templates?.roster || ''}
                                        onChange={e => setProfile({ ...profile, templates: { ...profile.templates, roster: e.target.value } })}
                                        className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-orange-400 font-bold block mb-1">Stundenzettel (Email Body)</label>
                                <textarea
                                    rows={4}
                                    value={profile.templates?.timesheet || ''}
                                    onChange={e => setProfile({ ...profile, templates: { ...profile.templates, timesheet: e.target.value } })}
                                    className="w-full bg-dark border border-gray-700 rounded p-2 text-white text-xs font-mono"
                                />
                            </div>

                            <div>
                                <label className="text-xs text-orange-300 font-bold block mb-1">Stundenzettel (Anreise/Abreise Block)</label>
                                <div className="text-[10px] text-gray-500 mb-1">Platzhalter: [Datum_AnAbreise], [AnAbreise], [START_ORT], [ZIEL_ORT], [START_ZEIT], [END_ZEIT]</div>
                                <textarea
                                    rows={4}
                                    value={profile.templates?.travel || ''}
                                    onChange={e => setProfile({ ...profile, templates: { ...profile.templates, travel: e.target.value } })}
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
                            {selectedTemplate === 'roster' && 'Dienstplan bestätigen'}
                            {selectedTemplate === 'timesheet' && 'Stundenzettel'}
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
                            {['start', 'end'].includes(selectedTemplate) && (
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

                            {/* ROSTER CONFIRMATION (Simple Message) */}
                            {selectedTemplate === 'roster' && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl text-center text-green-400 text-sm">
                                        <CheckCircle className="mx-auto mb-2" size={20} />
                                        Bestätigung wird gesendet.
                                    </div>
                                    <div>
                                        <label className="text-xs text-purple-400 uppercase font-bold">Vorname des Empfängers</label>
                                        <input type="text" placeholder="z.B. Andre" value={templateData.rosterName} onChange={e => setTemplateData({ ...templateData, rosterName: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                    </div>
                                </div>
                            )}

                            {/* TIMESHEET / STUNDENZETTEL INPUTS */}
                            {selectedTemplate === 'timesheet' && (
                                <div className="space-y-4 animate-in fade-in">
                                    <div className="flex justify-end">
                                        <button onClick={handleClearTimesheet} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 border border-red-500/30 px-2 py-1 rounded">
                                            <RotateCcw size={10} /> Clear Entries
                                        </button>
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Datum Pflicht</label>
                                            <input type="date" value={templateData.dateRequired} onChange={e => setTemplateData({ ...templateData, dateRequired: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-gray-500 uppercase font-bold">Datum Optional</label>
                                            <input type="date" value={templateData.dateOptional} onChange={e => setTemplateData({ ...templateData, dateOptional: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                        </div>
                                    </div>

                                    {/* Travel Toggles */}
                                    <div className="flex gap-4 p-3 bg-dark/50 rounded-xl border border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={templateData.travelAnreise} onChange={e => setTemplateData({ ...templateData, travelAnreise: e.target.checked })} className="rounded bg-dark border-gray-500" />
                                            <span className="text-sm text-white">Anreise</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input type="checkbox" checked={templateData.travelAbreise} onChange={e => setTemplateData({ ...templateData, travelAbreise: e.target.checked })} className="rounded bg-dark border-gray-500" />
                                            <span className="text-sm text-white">Abreise</span>
                                        </div>
                                    </div>

                                    {/* ANREISE BLOCK */}
                                    {templateData.travelAnreise && (
                                        <div className="p-3 bg-blue-900/10 rounded-xl border border-blue-500/30 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-blue-400 uppercase">Anreise Daten</h4>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase font-bold">Datum</label>
                                                <input type="date" value={templateData.anreiseDate} onChange={e => setTemplateData({ ...templateData, anreiseDate: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Start (Ort)</label>
                                                    <input type="text" placeholder="FFU" value={templateData.anreiseStart} onChange={e => setTemplateData({ ...templateData, anreiseStart: e.target.value.toUpperCase() })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Ziel (Ort)</label>
                                                    <input type="text" placeholder="EWAN" value={templateData.anreiseEnd} onChange={e => setTemplateData({ ...templateData, anreiseEnd: e.target.value.toUpperCase() })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Startzeit</label>
                                                    <input type="time" value={templateData.anreiseStartTime} onChange={e => setTemplateData({ ...templateData, anreiseStartTime: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Endzeit</label>
                                                    <input type="time" value={templateData.anreiseEndTime} onChange={e => setTemplateData({ ...templateData, anreiseEndTime: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ABREISE BLOCK */}
                                    {templateData.travelAbreise && (
                                        <div className="p-3 bg-orange-900/10 rounded-xl border border-orange-500/30 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-orange-400 uppercase">Abreise Daten</h4>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500 uppercase font-bold">Datum</label>
                                                <input type="date" value={templateData.abreiseDate} onChange={e => setTemplateData({ ...templateData, abreiseDate: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Start (Ort)</label>
                                                    <input type="text" placeholder="EWAN" value={templateData.abreiseStart} onChange={e => setTemplateData({ ...templateData, abreiseStart: e.target.value.toUpperCase() })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Ziel (Ort)</label>
                                                    <input type="text" placeholder="FFU" value={templateData.abreiseEnd} onChange={e => setTemplateData({ ...templateData, abreiseEnd: e.target.value.toUpperCase() })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Startzeit</label>
                                                    <input type="time" value={templateData.abreiseStartTime} onChange={e => setTemplateData({ ...templateData, abreiseStartTime: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Endzeit</label>
                                                    <input type="time" value={templateData.abreiseEndTime} onChange={e => setTemplateData({ ...templateData, abreiseEndTime: e.target.value })} className="w-full bg-dark border border-gray-700 rounded p-2 text-white" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2">
                                <input type="checkbox" checked={includeHeader} onChange={e => setIncludeHeader(e.target.checked)} className="rounded bg-dark border-gray-600" />
                                <span className="text-sm text-gray-300">Briefkopf mitsenden?</span>
                            </div>
                        </div>

                        {/* Feedback Message */}
                        {copied && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 absolute bottom-24 left-0 right-0 mx-auto w-max bg-green-500/90 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 z-50">
                                <CheckCircle size={14} /> Text kopiert! (Einfügen falls nötig)
                            </div>
                        )}

                        <button onClick={generateMailto} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-500 flex items-center justify-center gap-2 mt-4 relative">
                            <Send size={18} /> Email App öffnen
                        </button>

                        {/* DEBUG VERSION */}
                        <div className="text-[10px] text-gray-600 text-center mt-6 font-mono border-t border-gray-800/50 pt-2">
                            v2.3 (Clipboard + %0D%0A)
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmailTemplates;
