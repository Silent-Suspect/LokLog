import { createClerkClient, verifyToken } from '@clerk/backend';

export async function onRequestGet(context) {
    try {
        // 1. Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const verifiedToken = await verifyToken(token, { secretKey: context.env.CLERK_SECRET_KEY });

        // Admin Role Check
        const role = verifiedToken.public_metadata?.role;
        if (role !== 'admin') {
            return new Response("Forbidden", { status: 403 });
        }

        // 2. Fetch User IDs from DB
        const { results } = await context.env.DB.prepare(
            "SELECT DISTINCT user_id FROM shifts"
        ).all();

        const dbUserIds = results.map(r => r.user_id);
        if (dbUserIds.length === 0) return Response.json([]);

        // 3. Fetch User Details from Clerk
        const clerk = createClerkClient({ secretKey: context.env.CLERK_SECRET_KEY });

        // Fetch users matching our IDs
        const clerkUsersList = await clerk.users.getUserList({
            userId: dbUserIds,
            limit: 100
        });

        // Safe Access (Handle direct array or paginated object)
        const clerkUsers = Array.isArray(clerkUsersList) ? clerkUsersList : (clerkUsersList.data || []);

        // 4. Map & Sort
        const detailedUsers = dbUserIds.map(id => {
            const profile = clerkUsers.find(u => u.id === id);
            return {
                user_id: id,
                firstName: profile?.firstName || 'Unknown',
                lastName: profile?.lastName || 'User',
                email: profile?.emailAddresses?.[0]?.emailAddress || id,
                raw_id: id
            };
        });

        // Sort by Last Name
        detailedUsers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

        return Response.json(detailedUsers);

    } catch (err) {
        console.error("Admin Users Fetch Error:", err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}
