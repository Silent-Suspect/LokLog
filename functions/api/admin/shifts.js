import { verifyToken } from '@clerk/backend';

export async function onRequestGet(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const userId = searchParams.get('userId');
        const month = searchParams.get('month'); // "YYYY-MM"

        if (!userId || !month) return new Response("Missing params", { status: 400 });

        // Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        // Verify Token
        const verifiedToken = await verifyToken(token, { secretKey: context.env.CLERK_SECRET_KEY });

        // SECURITY CHECK: ADMIN ROLE
        const role = verifiedToken.public_metadata?.role;

        if (role !== 'admin') {
            return new Response("Forbidden: Admin Access Only", { status: 403 });
        }

        // Fetch Shifts
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE user_id = ? AND date LIKE ? ORDER BY date ASC"
        ).bind(userId, `${month}%`).all();

        return Response.json({ shifts: results });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
