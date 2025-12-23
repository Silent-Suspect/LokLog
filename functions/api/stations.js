import { createClerkClient } from '@clerk/backend';

// Helper: Standard Response Headers (CORS etc.)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS (Preflight Requests für CORS)
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

// GET: Suche & Route (Public Access OK)
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const searchTerm = searchParams.get('q'); // Live-Suche
    const codesParam = searchParams.get('codes'); // Routen-Modus

    try {
        let results = [];

        if (codesParam) {
            // 1. ROUTEN MODUS (Batch)
            // Sicherheits-Check: Max 50 Codes um Missbrauch zu verhindern
            const codes = codesParam.split(/[\s,]+/).filter(c => c).slice(0, 50);

            if (codes.length > 0) {
                // Dynamisches SQL bauen: SELECT * FROM stations WHERE code IN (?, ?, ?)
                const placeholders = codes.map(() => '?').join(',');
                const query = `SELECT * FROM stations WHERE code IN (${placeholders})`;
                const stmt = context.env.DB.prepare(query).bind(...codes);
                const { results: rows } = await stmt.all();
                results = rows;
            }

        } else if (searchTerm && searchTerm.length > 1) {
            // 2. SUCH MODUS (Live)
            const term = `%${searchTerm}%`;
            const query = `
        SELECT * FROM stations 
        WHERE code LIKE ? OR name LIKE ? OR short_name LIKE ? 
        LIMIT 20
      `;
            const { results: rows } = await context.env.DB.prepare(query)
                .bind(term, term, term)
                .all();
            results = rows;
        }

        return Response.json({ results }, { headers: corsHeaders });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}

// PUT: Update GPS (ADMIN ONLY) 🔒
export async function onRequestPut(context) {
    try {
        // 0. DEBUG CHECK: Ist der Schlüssel da?
        if (!context.env.CLERK_SECRET_KEY) {
            throw new Error("CRITICAL: CLERK_SECRET_KEY fehlt in den Environment Variables!");
        }

        // 1. Auth Header prüfen
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized: Missing Token', { status: 401, headers: corsHeaders });
        }

        const token = authHeader.split(' ')[1];

        // 2. Clerk Initialisieren
        const clerk = createClerkClient({
            secretKey: context.env.CLERK_SECRET_KEY,
            publishableKey: context.env.VITE_CLERK_PUBLISHABLE_KEY
        });

        // 3. Token verifizieren
        const tokenState = await clerk.verifyToken(token);

        // User laden
        const user = await clerk.users.getUser(tokenState.sub);

        // 4. Admin Rolle prüfen
        const isAdmin = user.publicMetadata?.role === 'admin';

        if (!isAdmin) {
            return new Response('Forbidden: Admin access only', { status: 403, headers: corsHeaders });
        }

        // 5. Update
        const { code, lat, lng } = await context.request.json();
        if (!code) return Response.json({ error: "Code missing" }, { status: 400, headers: corsHeaders });

        await context.env.DB.prepare(
            "UPDATE stations SET lat = ?, lng = ? WHERE code = ?"
        ).bind(lat, lng, code).run();

        return Response.json({ success: true, code }, { headers: corsHeaders });

    } catch (err) {
        console.error("Auth Error:", err);
        // WICHTIG: Wir geben den echten Fehlertext zurück zum Debuggen!
        return Response.json({
            error: "Internal Server Error",
            details: err.message,
            stack: err.stack
        }, { status: 500, headers: corsHeaders });
    }
}
