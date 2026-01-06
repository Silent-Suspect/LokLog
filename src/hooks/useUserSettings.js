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
            const token = await getToken();
            const res = await fetch('/api/settings', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data, loading: false }));
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
            // Merge with current state to ensure we don't lose other fields
            // But usually we pass partial updates?
            // The API expects full object or handles partial?
            // My SQL ON CONFLICT updates all fields I bind.
            // So I should send the COMPLETE state + changes.

            // Wait, state update is async. We should use the merged value.
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
