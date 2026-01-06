import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import googleConfig from '../config/google';
import { useUserSettings } from './useUserSettings';

// Global state
let gapiLoaded = false;
let gisLoaded = false;

export const useGoogleDrive = () => {
  const { getToken } = useAuth();
  const { settings, updateSettings } = useUserSettings(); // Use Server Settings

  const [isApiReady, setIsApiReady] = useState(false);
  const [codeClient, setCodeClient] = useState(null);

  // Use settings from hook instead of localStorage
  const connectedFolderId = settings.drive_folder_id;
  const connectedFolderName = settings.drive_folder_name;

  // Initialize Scripts
  useEffect(() => {
    const loadScripts = async () => {
      if (gapiLoaded && gisLoaded) {
        setIsApiReady(true);
        return;
      }
      if (!window.gapi) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://apis.google.com/js/api.js';
          script.onload = () => {
            window.gapi.load('client:picker', async () => {
              await window.gapi.client.init({
                apiKey: googleConfig.apiKey,
                discoveryDocs: googleConfig.discoveryDocs,
              });
              gapiLoaded = true;
              resolve();
            });
          };
          document.body.appendChild(script);
        });
      }
      if (!window.google?.accounts) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.onload = () => {
            gisLoaded = true;
            resolve();
          };
          document.body.appendChild(script);
        });
      }
      setIsApiReady(true);
    };
    loadScripts().catch(err => console.error("Failed to load Google Scripts", err));
  }, []);

  // Initialize Code Client
  useEffect(() => {
    if (isApiReady && window.google?.accounts?.oauth2 && !codeClient) {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: googleConfig.clientId,
        scope: googleConfig.scopes,
        ux_mode: 'popup',
        callback: async (response) => {
          if (response.code) {
            try {
                const token = await getToken();
                const res = await fetch('/api/auth/google', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ code: response.code })
                });
                if (!res.ok) throw new Error('Code exchange failed');
                const data = await res.json();
                if (window.gapi) window.gapi.client.setToken({ access_token: data.access_token });
            } catch (e) {
                console.error("Backend Auth Error", e);
            }
          }
        },
      });
      setTimeout(() => setCodeClient(client), 0);
    }
  }, [isApiReady, codeClient, getToken]);

  const login = useCallback(() => {
    if (!codeClient) return;
    codeClient.requestCode();
  }, [codeClient]);

  const getValidToken = useCallback(async () => {
      try {
          const token = await getToken();
          const res = await fetch('/api/auth/google', {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.status === 404 || res.status === 410) {
              login();
              throw new Error("Login required");
          }
          if (!res.ok) throw new Error("Auth check failed");
          const data = await res.json();
          if (window.gapi) window.gapi.client.setToken({ access_token: data.access_token });
          return data.access_token;
      } catch (e) {
          if (e.message === "Login required") throw e;
          console.warn("Silent refresh failed", e);
          throw e;
      }
  }, [getToken, login]);

  const pickFolder = useCallback(async () => {
    try { await getValidToken(); } catch (e) { return; }

    return new Promise((resolve, reject) => {
      const showPicker = () => {
        const view = new window.google.picker.DocsView(window.google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setMimeTypes('application/vnd.google-apps.folder');

        const picker = new window.google.picker.PickerBuilder()
          .setDeveloperKey(googleConfig.apiKey)
          .setAppId(googleConfig.clientId)
          .setOAuthToken(window.gapi.client.getToken().access_token)
          .addView(view)
          .setCallback((data) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const doc = data.docs[0];
              const folderId = doc.id;
              const folderName = doc.name;

              // Save to Server via Hook
              updateSettings({
                  drive_folder_id: folderId,
                  drive_folder_name: folderName
              });

              resolve({ id: folderId, name: folderName });
            } else if (data.action === window.google.picker.Action.CANCEL) {
              reject("Selection cancelled");
            }
          })
          .build();
        picker.setVisible(true);
      };
      showPicker();
    });
  }, [getValidToken, updateSettings]);

  const uploadFile = useCallback(async (fileBlob, fileName) => {
    // Check settings directly from hook logic (passed via hook return if needed, but we use the closured values)
    // NOTE: `connectedFolderId` comes from `settings` state which might be stale if updated recently?
    // `useUserSettings` updates state optimistically, so it should be fine.

    if (!connectedFolderId) throw new Error("No folder selected");

    let accessToken;
    try { accessToken = await getValidToken(); } catch (authErr) { throw new Error("Authentication failed"); }

    const performUpload = async (token) => {
        // Search
        let existingFileId = null;
        try {
            const q = `name = '${fileName}' and '${connectedFolderId}' in parents and trashed = false`;
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (searchRes.status === 401) throw new Error("401");
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.files && searchData.files.length > 0) existingFileId = searchData.files[0].id;
            }
        } catch (e) { if (e.message === "401") throw e; console.warn("Search failed", e); }

        // Upload
        const metadata = { name: fileName, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
        if (!existingFileId) metadata.parents = [connectedFolderId];

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileBlob);

        const url = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const method = existingFileId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: form
        });

        if (res.status === 401) throw new Error("401");
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Upload failed");
        }
        return await res.json();
    };

    try { return await performUpload(accessToken); }
    catch (e) {
        if (e.message === "401") {
            login();
            throw new Error("Please check popup to re-authenticate.");
        }
        throw e;
    }
  }, [connectedFolderId, getValidToken, login]);

  const disconnect = () => {
      updateSettings({
          drive_folder_id: null,
          drive_folder_name: null
      });
  };

  return {
    isApiReady,
    isConnected: !!connectedFolderId,
    folderName: connectedFolderName,
    login,
    pickFolder,
    uploadFile,
    disconnect
  };
};
