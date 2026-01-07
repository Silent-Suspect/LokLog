import { verifyClerkToken } from '../../utils/clerk-verify';

export async function onRequestPost(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const date = searchParams.get('date');

        if (!date) return new Response("Missing date", { status: 400 });

        // Auth
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader) return new Response("Unauthorized", { status: 401 });
        const token = authHeader.replace('Bearer ', '');
        const userId = await verifyClerkToken(token, context.env);

        // Find latest valid history
        const history = await context.env.DB.prepare(`
            SELECT * FROM shifts_history
            WHERE user_id = ? AND date = ?
            ORDER BY archived_at DESC
        `).bind(userId, date).all();

        if (!history.results || history.results.length === 0) {
            return new Response("No history found", { status: 404 });
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

        // 1. Restore Shift
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
            shift.id, userId, shift.date, shift.start_time, shift.end_time,
            shift.km_start, shift.km_end,
            shift.energy_18_start, shift.energy_18_end,
            shift.energy_28_start, shift.energy_28_end,
            shift.status_json, shift.comments,
            shift.guest_rides, shift.waiting_times,
            Date.now() // Update timestamp to trigger sync down
        ));

        // 2. Restore Segments
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
            restored_from: targetEntry.archived_at,
            segments_count: segments.length
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
