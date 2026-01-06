const googleConfig = {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  apiKey: import.meta.env.VITE_GOOGLE_API_KEY,
  scopes: 'https://www.googleapis.com/auth/drive',
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
};

// Simple check to warn dev if keys are missing
if (!googleConfig.clientId || !googleConfig.apiKey) {
  console.warn('⚠️ Google Drive Config: Missing Client ID or API Key in environment variables.');
}

export default googleConfig;
