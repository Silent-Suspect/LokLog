import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export const useUserSettings = () => {
    const { getToken, isSignedIn } = useAuth();
    const [settings, setSettings] = useState({
        drive_folder_id: null,
        drive_folder_name: null,
        pref_download_copy: true,
        loading: true
    });

    // Fetch Settings
    const fetchSettings = useCallback(async () => {
        if (!isSignedIn) return;
        try {
            let token = await getToken();
            let res = await fetch('/api/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // RETRY LOGIC (Similar to sync)
            if (res.status === 401 || !res.ok) {
                 // Clone response to check body without consuming
                 const clone = res.clone();
                 let needsRetry = res.status === 401;

                 // Check if it's the "Token Expired" 500 error or similar
                 if (!needsRetry && res.status === 500) {
                     try {
                         const errText = await clone.text();
                         if (errText.includes("Token Expired")) needsRetry = true;
                     } catch(e) {}
                 }

                 if (needsRetry) {
                     console.log("Settings fetch token expired, retrying...");
                     token = await getToken({ skipCache: true });
                     res = await fetch('/api/settings', {
                        headers: { 'Authorization': `Bearer ${token}` }
                     });
                 }
            }

            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data, loading: false }));
            } else {
                 console.warn("Settings fetch failed after retry", res.status);
                 setSettings(prev => ({ ...prev, loading: false }));
            }
        } catch (e) {
            console.error("Failed to load settings", e);
            setSettings(prev => ({ ...prev, loading: false }));
        }
    }, [isSignedIn, getToken]);

    // Update Settings
    const updateSettings = async (newSettings) => {
        // Optimistic Update
        setSettings(prev => ({ ...prev, ...newSettings }));

        try {
            const token = await getToken();
            const merged = { ...settings, ...newSettings };

            await fetch('/api/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(merged)
            });
        } catch (e) {
            console.error("Failed to save settings", e);
            // Revert?
        }
    };

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    return {
        settings,
        updateSettings,
        reload: fetchSettings
    };
};
