import { createClerkClient, verifyToken } from '@clerk/backend';

export async function onRequestGet(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const targetUserId = searchParams.get('userId');
        const month = searchParams.get('month'); // "YYYY-MM"

        if (!targetUserId || !month) return new Response("Missing params", { status: 400 });

        // 1. Basic Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        // Verify Token for signature and requester ID
        const verifiedToken = await verifyToken(token, { secretKey: context.env.CLERK_SECRET_KEY });
        const requesterId = verifiedToken.sub;

        // 2. SECURITY: Fetch Fresh Profile from Clerk
        const clerk = createClerkClient({ secretKey: context.env.CLERK_SECRET_KEY });

        let currentUser;
        try {
            currentUser = await clerk.users.getUser(requesterId);
        } catch (e) {
            console.error("Clerk User Fetch Failed:", e);
            return new Response("Auth Error", { status: 500 });
        }

        // Check Role
        const role = currentUser.publicMetadata?.role;

        if (role !== 'admin') {
            return new Response("Forbidden: Admin Access Only", { status: 403 });
        }

        // 3. Fetch Shifts
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE user_id = ? AND date LIKE ? ORDER BY date ASC"
        ).bind(targetUserId, `${month}%`).all();

        return Response.json({ shifts: results });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
