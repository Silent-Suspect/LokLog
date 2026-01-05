import { useState, useEffect, useCallback } from 'react';
import googleConfig from '../config/google';

// Global state to track script loading status
let gapiLoaded = false;
let gisLoaded = false;

export const useGoogleDrive = () => {
  const [isApiReady, setIsApiReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tokenClient, setTokenClient] = useState(null);
  const [connectedFolderId, setConnectedFolderId] = useState(localStorage.getItem('loklog_drive_folder_id'));
  const [connectedFolderName, setConnectedFolderName] = useState(localStorage.getItem('loklog_drive_folder_name'));

  // Initialize Google Scripts
  useEffect(() => {
    const loadScripts = async () => {
      if (gapiLoaded && gisLoaded) {
        setIsApiReady(true);
        return;
      }

      // Load GAPI
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

      // Load GIS
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

  // Initialize Token Client once GIS is ready
  useEffect(() => {
    if (isApiReady && window.google?.accounts?.oauth2 && !tokenClient) {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: googleConfig.clientId,
        scope: googleConfig.scopes,
        callback: (response) => {
          if (response.error !== undefined) {
            console.error(response);
            throw (response);
          }
          setIsAuthenticated(true);
        },
      });
      // Defer state update to avoid synchronous update warning
      setTimeout(() => setTokenClient(client), 0);
    }
  }, [isApiReady, tokenClient]);

  // Login Function
  const login = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!tokenClient) return reject("Token Client not ready");

      // Override callback for this specific request to handle the promise
      tokenClient.callback = (resp) => {
        if (resp.error) reject(resp);

        // Important: Bridge the token to gapi for Picker/Drive API
        if (window.gapi) window.gapi.client.setToken(resp);

        // Cache Token
        const expiresAt = Date.now() + (resp.expires_in * 1000) - 60000; // Buffer 60s
        localStorage.setItem('loklog_drive_token', resp.access_token);
        localStorage.setItem('loklog_drive_token_expiry', expiresAt);

        setIsAuthenticated(true);
        resolve(resp.access_token);
      };

      // Trigger flow
      tokenClient.requestAccessToken({});
    });
  }, [tokenClient]);

  const getValidToken = useCallback(async () => {
      const storedToken = localStorage.getItem('loklog_drive_token');
      const expiry = localStorage.getItem('loklog_drive_token_expiry');

      if (storedToken && expiry && Date.now() < parseInt(expiry)) {
          // Token is valid, ensure GAPI has it
          if (window.gapi && !window.gapi.client.getToken()) {
              window.gapi.client.setToken({ access_token: storedToken });
          }
          setIsAuthenticated(true);
          return storedToken;
      }

      // Token expired or missing, force login
      return await login();
  }, [login]);

  // Pick Folder Function
  const pickFolder = useCallback(async () => {
    await getValidToken();

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

              // Save
              setConnectedFolderId(folderId);
              setConnectedFolderName(folderName);
              localStorage.setItem('loklog_drive_folder_id', folderId);
              localStorage.setItem('loklog_drive_folder_name', folderName);

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
  }, [isAuthenticated, login]);

  // Upload File Function (Overwrite logic)
  const uploadFile = useCallback(async (fileBlob, fileName) => {
    if (!connectedFolderId) throw new Error("No folder selected");

    let accessToken;
    try {
        accessToken = await getValidToken();
    } catch (authErr) {
        throw new Error("Authentication failed");
    }

    const performUpload = async (token) => {
        // 1. Search for existing file
        let existingFileId = null;
        try {
            const q = `name = '${fileName}' and '${connectedFolderId}' in parents and trashed = false`;
            const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (searchRes.status === 401) throw new Error("401"); // Token revoked
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.files && searchData.files.length > 0) {
                    existingFileId = searchData.files[0].id;
                }
            }
        } catch (e) {
            if (e.message === "401") throw e;
            console.warn("Search failed, falling back to create", e);
        }

        // 2. Prepare Upload
        const metadata = {
            name: fileName,
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        if (!existingFileId) {
            metadata.parents = [connectedFolderId];
        }

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileBlob);

        // 3. Update (PATCH) or Create (POST)
        const url = existingFileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const method = existingFileId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: form
        });

        if (res.status === 401) throw new Error("401");

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error?.message || "Upload failed");
        }

        return await res.json();
    };

    // Attempt Upload, Retry once on 401
    try {
        return await performUpload(accessToken);
    } catch (e) {
        if (e.message === "401") {
            // Token was invalid (revoked?), try fresh login
            console.log("Token expired/revoked during upload, refreshing...");
            localStorage.removeItem('loklog_drive_token');
            localStorage.removeItem('loklog_drive_token_expiry');
            const newToken = await login();
            return await performUpload(newToken);
        }
        throw e;
    }
  }, [connectedFolderId, getValidToken, login]);

  const disconnect = () => {
      setConnectedFolderId(null);
      setConnectedFolderName(null);
      localStorage.removeItem('loklog_drive_folder_id');
      localStorage.removeItem('loklog_drive_folder_name');
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
