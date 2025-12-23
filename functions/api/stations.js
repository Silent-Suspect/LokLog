import { createClerkClient, verifyToken } from '@clerk/backend';

// Helper: Standard Response Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

// GET: Suche & Route (Bleibt Public)
export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const searchTerm = searchParams.get('q');
    const codesParam = searchParams.get('codes');

    try {
        let results = [];

        if (codesParam) {
            const codes = codesParam.split(/[\s,]+/).filter(c => c).slice(0, 50);
            if (codes.length > 0) {
                const placeholders = codes.map(() => '?').join(',');
                const query = `SELECT * FROM stations WHERE code IN (${placeholders})`;
                const stmt = context.env.DB.prepare(query).bind(...codes);
                const { results: rows } = await stmt.all();
                results = rows;
            }
        } else if (searchTerm && searchTerm.length > 1) {
            const term = `%${searchTerm}%`;
            const query = `
        SELECT * FROM stations 
        WHERE code LIKE ? OR name LIKE ? OR short_name LIKE ? 
        ORDER BY 
          CASE WHEN code = ? THEN 1 ELSE 2 END, 
          code ASC
        LIMIT 20
      `;
            const { results: rows } = await context.env.DB.prepare(query)
                .bind(term, term, term, searchTerm)
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
        // 0. Environment Check
        if (!context.env.CLERK_SECRET_KEY) {
            throw new Error("Missing CLERK_SECRET_KEY");
        }

        // 1. Auth Header prüfen
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized: Missing Token', { status: 401, headers: corsHeaders });
        }

        const token = authHeader.split(' ')[1];

        // 2. Token verifizieren (Standalone Funktion)
        // Hier lag der Fehler: verifyToken muss direkt aufgerufen werden
        const verifiedToken = await verifyToken(token, {
            secretKey: context.env.CLERK_SECRET_KEY
        });

        // 3. User nachladen für Rollen-Check
        // Dafür brauchen wir den Client
        const clerk = createClerkClient({
            secretKey: context.env.CLERK_SECRET_KEY,
            publishableKey: context.env.VITE_CLERK_PUBLISHABLE_KEY
        });

        // verifiedToken.sub ist die User ID
        const user = await clerk.users.getUser(verifiedToken.sub);

        // 4. Admin Rolle prüfen
        const isAdmin = user.publicMetadata?.role === 'admin';

        if (!isAdmin) {
            return new Response('Forbidden: Admin access only', { status: 403, headers: corsHeaders });
        }

        // 5. Update durchführen
        const { code, lat, lng } = await context.request.json();

        if (!code) return Response.json({ error: "Code missing" }, { status: 400, headers: corsHeaders });

        await context.env.DB.prepare(
            "UPDATE stations SET lat = ?, lng = ? WHERE code = ?"
        ).bind(lat, lng, code).run();

        return Response.json({ success: true, code }, { headers: corsHeaders });

    } catch (err) {
        console.error("Auth Error:", err);

        // Unterscheidung: Auth Fehler vs Server Fehler
        const status = err.message.includes('token') ? 401 : 500;

        return Response.json({
            error: "Request Failed",
            details: err.message
        }, { status: status, headers: corsHeaders });
    }
}
