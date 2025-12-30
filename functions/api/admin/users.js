import { createClerkClient, verifyToken } from '@clerk/backend';

export async function onRequestGet(context) {
    try {
        // 1. Basic Auth Check (Token Validity)
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        // Verify signature only (to get the User ID)
        const verifiedToken = await verifyToken(token, { secretKey: context.env.CLERK_SECRET_KEY });
        const userId = verifiedToken.sub;

        // 2. SECURITY: Fetch Fresh Profile from Clerk
        // We use the API to get the real metadata, bypassing token limitations.
        const clerk = createClerkClient({ secretKey: context.env.CLERK_SECRET_KEY });

        let currentUser;
        try {
            currentUser = await clerk.users.getUser(userId);
        } catch (e) {
            console.error("Clerk User Fetch Failed:", e);
            return new Response("Auth Error", { status: 500 });
        }

        // Check Role (Note: JS SDK uses camelCase 'publicMetadata')
        const role = currentUser.publicMetadata?.role;

        console.log(`[Admin Check] User: ${userId}, Role: ${role}`); // Debug Log

        if (role !== 'admin') {
            return new Response(`Forbidden. Your role is: ${role || 'none'}`, { status: 403 });
        }

        // 3. Fetch Data (Distinct Users from DB)
        const { results } = await context.env.DB.prepare(
            "SELECT DISTINCT user_id FROM shifts"
        ).all();

        const dbUserIds = results.map(r => r.user_id);
        if (dbUserIds.length === 0) return Response.json([]);

        // 4. Resolve Names for the List
        const clerkUsersList = await clerk.users.getUserList({
            userId: dbUserIds,
            limit: 100
        });
        const clerkUsers = Array.isArray(clerkUsersList) ? clerkUsersList : (clerkUsersList.data || []);

        const detailedUsers = dbUserIds.map(id => {
            const profile = clerkUsers.find(u => u.id === id);
            return {
                user_id: id,
                firstName: profile?.firstName || 'Unknown',
                lastName: profile?.lastName || 'User',
                email: profile?.emailAddresses?.[0]?.emailAddress || id
            };
        });

        detailedUsers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

        return Response.json(detailedUsers);

    } catch (err) {
        console.error("API Error:", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
