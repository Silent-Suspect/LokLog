// Helper: Verify Clerk Session
async function getUserId(request, env) {
    try {
        if (!env.CLERK_SECRET_KEY) throw new Error("Missing CLERK_SECRET_KEY in env");

        // Dynamic Import to catch initialization errors
        const { createClerkClient } = await import('@clerk/backend');

        const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
        const { isSignedIn, toAuth } = await clerk.authenticateRequest(request);
        if (!isSignedIn) return null;
        const auth = toAuth();
        return auth.userId;
    } catch (e) {
        console.error("Clerk Auth Error:", e);
        throw e;
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const userId = await getUserId(request, env);
        if (!userId) return new Response('Unauthorized - Clerk verification failed', { status: 401 });

        const { code } = await request.json();

        // Exchange Code for Tokens
        const tokenParams = new URLSearchParams({
            code: code,
            client_id: env.VITE_GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: new URL(request.url).origin, // Dynamically use current origin (Production/Preview)
            grant_type: 'authorization_code'
        });

        const googleRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        const tokens = await googleRes.json();

        if (!googleRes.ok) {
            return new Response(JSON.stringify(tokens), { status: googleRes.status });
        }

        // Store Refresh Token if present (only on first consent)
        if (tokens.refresh_token) {
            await env.DB.prepare(
                `INSERT INTO google_tokens (user_id, refresh_token, updated_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                 refresh_token = excluded.refresh_token,
                 updated_at = excluded.updated_at`
            ).bind(userId, tokens.refresh_token, Date.now()).run();
        }

        return new Response(JSON.stringify({ access_token: tokens.access_token }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error("POST Error:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestGet({ request, env }) {
    try {
        const userId = await getUserId(request, env);
        if (!userId) return new Response('Unauthorized - Clerk verification failed', { status: 401 });

        // Retrieve Refresh Token
        const record = await env.DB.prepare(
            'SELECT refresh_token FROM google_tokens WHERE user_id = ?'
        ).bind(userId).first();

        if (!record || !record.refresh_token) {
            return new Response('No connection found', { status: 404 });
        }

        // Refresh Access Token
        const tokenParams = new URLSearchParams({
            client_id: env.VITE_GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            refresh_token: record.refresh_token,
            grant_type: 'refresh_token'
        });

        const googleRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenParams
        });

        const tokens = await googleRes.json();

        if (!googleRes.ok) {
            // If refresh fails (e.g., revoked), delete from DB
            if (tokens.error === 'invalid_grant') {
                await env.DB.prepare('DELETE FROM google_tokens WHERE user_id = ?').bind(userId).run();
                return new Response('Connection revoked', { status: 410 });
            }
            return new Response(JSON.stringify(tokens), { status: googleRes.status });
        }

        return new Response(JSON.stringify({ access_token: tokens.access_token }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err) {
        console.error("GET Error:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
