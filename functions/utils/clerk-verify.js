// Lightweight JWT Verification for Cloudflare Workers (No Heavy Dependencies)

// In-memory cache for JWKS (persists across hot invocations)
let cachedJWKS = null;

async function getJWKS(issuerUrl) {
    if (cachedJWKS) return cachedJWKS;

    const res = await fetch(`${issuerUrl}/.well-known/jwks.json`);
    if (!res.ok) throw new Error("Failed to fetch JWKS");

    cachedJWKS = await res.json();
    return cachedJWKS;
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
}

function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

async function importKey(jwk) {
    return await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
    );
}

export async function verifyClerkToken(token, env) {
    if (!env.VITE_CLERK_PUBLISHABLE_KEY) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

    // 1. Decode Token Header
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error("Invalid Token Format");

    const header = JSON.parse(base64UrlDecode(parts[0]));
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const signature = str2ab(base64UrlDecode(parts[2]));
    const data = str2ab(parts[0] + "." + parts[1]);

    // 2. Fetch JWKS from Clerk
    // Construct Issuer URL from Publishable Key or Env
    // Example PK: pk_test_... or pk_live_...
    // The issuer is usually https://clerk.your-domain.com or https://api.clerk.com/v1/ ...
    // Actually, checking the JWT payload 'iss' field is better.

    const issuer = payload.iss;
    const jwks = await getJWKS(issuer);

    // 3. Find Matching Key
    const keyData = jwks.keys.find(k => k.kid === header.kid);
    if (!keyData) throw new Error("Matching Key Not Found");

    // 4. Verify Signature
    const key = await importKey(keyData);
    const isValid = await crypto.subtle.verify(
        "RSASSA-PKCS1-v1_5",
        key,
        signature,
        data
    );

    if (!isValid) throw new Error("Invalid Signature");

    // 5. Expiration Check
    if (payload.exp < Date.now() / 1000) throw new Error("Token Expired");

    return payload.sub; // User ID
}
