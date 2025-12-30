import { verifyToken } from '@clerk/backend';

export async function onRequestGet(context) {
    try {
        // Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        await verifyToken(token, { secretKey: context.env.CLERK_SECRET_KEY });

        // Fetch Distinct Users
        const { results } = await context.env.DB.prepare(
            "SELECT DISTINCT user_id FROM shifts"
        ).all();

        return Response.json(results);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
