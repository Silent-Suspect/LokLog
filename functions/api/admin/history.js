import { verifyClerkToken } from '../../utils/clerk-verify';

export async function onRequestGet(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const targetUserId = searchParams.get('userId');

        if (!targetUserId) return new Response("Missing userId", { status: 400 });

        // 1. Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.replace('Bearer ', '');
        const requesterId = await verifyClerkToken(token, context.env);

        // 2. Admin Role Check
        const clerkRes = await fetch(`https://api.clerk.com/v1/users/${requesterId}`, {
            headers: {
                'Authorization': `Bearer ${context.env.CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!clerkRes.ok) return new Response("Auth Verification Failed", { status: 500 });
        const requesterProfile = await clerkRes.json();
        if (requesterProfile.public_metadata?.role !== 'admin') {
            return new Response("Forbidden", { status: 403 });
        }

        // 3. Query History Summary
        // Group by date to show which days have backups
        const { results } = await context.env.DB.prepare(`
            SELECT
                date,
                COUNT(*) as count,
                MAX(archived_at) as latest_ts
            FROM shifts_history
            WHERE user_id = ?
            GROUP BY date
            ORDER BY date DESC
        `).bind(targetUserId).all();

        return Response.json({ history: results });

    } catch (err) {
        console.error("History API Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
