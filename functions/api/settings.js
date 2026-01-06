import { verifyToken } from '../utils/clerk-verify';

export async function onRequest(context) {
    const { request, env } = context;

    // 1. Auth Check
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

    let userId;
    try {
        const token = authHeader.split(' ')[1];
        const payload = await verifyToken(token, env);
        userId = payload.sub;
    } catch (e) {
        return new Response('Invalid Token', { status: 401 });
    }

    // 2. Handle Methods
    try {
        if (request.method === 'GET') {
            const stmt = env.DB.prepare('SELECT * FROM user_settings WHERE user_id = ?').bind(userId);
            const settings = await stmt.first();

            // Return defaults if not found
            if (!settings) {
                return Response.json({
                    user_id: userId,
                    drive_folder_id: null,
                    drive_folder_name: null,
                    pref_download_copy: true // Default true
                });
            }

            return Response.json({
                ...settings,
                pref_download_copy: settings.pref_download_copy === 1
            });
        }

        if (request.method === 'PUT') {
            const body = await request.json();

            // Validate?
            const { drive_folder_id, drive_folder_name, pref_download_copy } = body;

            // Upsert
            const stmt = env.DB.prepare(`
                INSERT INTO user_settings (user_id, drive_folder_id, drive_folder_name, pref_download_copy, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    drive_folder_id = excluded.drive_folder_id,
                    drive_folder_name = excluded.drive_folder_name,
                    pref_download_copy = excluded.pref_download_copy,
                    updated_at = excluded.updated_at
            `).bind(
                userId,
                drive_folder_id,
                drive_folder_name,
                pref_download_copy ? 1 : 0,
                Date.now()
            );

            await stmt.run();

            return Response.json({ success: true });
        }

        return new Response('Method Not Allowed', { status: 405 });

    } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
