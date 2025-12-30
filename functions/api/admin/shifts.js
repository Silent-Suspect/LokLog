import { verifyToken } from '@clerk/backend';

export async function onRequestGet(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const userId = searchParams.get('userId');
        const month = searchParams.get('month'); // Format "YYYY-MM"

        if (!userId || !month) return new Response("Missing params", { status: 400 });

        // Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        await verifyToken(token, { secretKey: context.env.CLERK_SECRET_KEY });

        // Fetch Shifts for User & Month
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE user_id = ? AND date LIKE ? ORDER BY date ASC"
        ).bind(userId, `${month}%`).all();

        return Response.json({ shifts: results });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
