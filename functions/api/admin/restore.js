import { verifyClerkToken } from '../../utils/clerk-verify';

export async function onRequestPost(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const date = searchParams.get('date');
        const targetUserId = searchParams.get('userId');

        if (!date || !targetUserId) return new Response("Missing date or userId", { status: 400 });

        // 1. Auth Check (Token Signature)
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.replace('Bearer ', '');
        const requesterId = await verifyClerkToken(token, context.env);

        // 2. Admin Role Check (via Clerk API)
        // We use fetch directly to avoid @clerk/backend dependency issues in Workers
        const clerkRes = await fetch(`https://api.clerk.com/v1/users/${requesterId}`, {
            headers: {
                'Authorization': `Bearer ${context.env.CLERK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!clerkRes.ok) {
            console.error("Clerk API Error:", await clerkRes.text());
            return new Response("Auth Verification Failed", { status: 500 });
        }

        const requesterProfile = await clerkRes.json();
        const role = requesterProfile.public_metadata?.role;

        if (role !== 'admin') {
            return new Response("Forbidden: Admins only", { status: 403 });
        }

        // 3. Restore Logic
        // Find latest valid history for TARGET user
        const history = await context.env.DB.prepare(`
            SELECT * FROM shifts_history
            WHERE user_id = ? AND date = ?
            ORDER BY archived_at DESC
        `).bind(targetUserId, date).all();

        if (!history.results || history.results.length === 0) {
            return new Response("No history found for this user/date", { status: 404 });
        }

        // Find first entry with segments
        let targetEntry = null;
        let parsedData = null;

        for (const entry of history.results) {
            try {
                const data = JSON.parse(entry.backup_json);
                if (data.segments && data.segments.length > 0) {
                    targetEntry = entry;
                    parsedData = data;
                    break;
                }
            } catch (e) { console.warn("Invalid JSON in history", e); }
        }

        if (!targetEntry) {
            return new Response("No history with segments found", { status: 404 });
        }

        // Restore
        const { shift, segments } = parsedData;
        const batch = [];

        // 3a. Restore Shift
        // Important: Use targetUserId, not requesterId!
        // We keep the original shift ID to maintain continuity?
        // Or if we replace, we should ensure the ID matches what's in the backup.
        // The backup `shift` object has `id` and `user_id`.
        // We should respect the backup's ID.

        batch.push(context.env.DB.prepare(`
            INSERT OR REPLACE INTO shifts (
                id, user_id, date, start_time, end_time,
                km_start, km_end,
                energy_18_start, energy_18_end,
                energy_28_start, energy_28_end,
                status_json, comments,
                guest_rides, waiting_times, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            shift.id, targetUserId, shift.date, shift.start_time, shift.end_time,
            shift.km_start, shift.km_end,
            shift.energy_18_start, shift.energy_18_end,
            shift.energy_28_start, shift.energy_28_end,
            shift.status_json, shift.comments,
            shift.guest_rides, shift.waiting_times,
            Date.now() // Update timestamp to trigger sync down
        ));

        // 3b. Restore Segments
        batch.push(context.env.DB.prepare("DELETE FROM segments WHERE shift_id = ?").bind(shift.id));

        if (segments && segments.length > 0) {
            segments.forEach((seg, index) => {
                batch.push(context.env.DB.prepare(`
                    INSERT INTO segments (
                        shift_id, order_index,
                        train_nr, loco_nr, from_station, to_station,
                        departure, arrival, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).bind(
                    shift.id, index,
                    seg.train_nr, seg.loco_nr, seg.from_station, seg.to_station,
                    seg.departure, seg.arrival, seg.notes
                ));
            });
        }

        await context.env.DB.batch(batch);

        return Response.json({
            success: true,
            restored_for: targetUserId,
            restored_from: targetEntry.archived_at,
            segments_count: segments.length
        });

    } catch (err) {
        console.error("Restore Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
