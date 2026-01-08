import { verifyClerkToken } from '../utils/clerk-verify';

// Helper: Standard Response Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Handle OPTIONS
export async function onRequestOptions() {
    return new Response(null, { headers: corsHeaders });
}

// GET: Load Shift for Date
export async function onRequestGet(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const date = searchParams.get('date');

        if (!date) return new Response("Missing date parameter", { status: 400, headers: corsHeaders });

        // Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }
        const token = authHeader.replace('Bearer ', '');
        const userId = await verifyClerkToken(token, context.env);

        // Fetch Shift
        const shift = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE user_id = ? AND date = ?"
        ).bind(userId, date).first();

        let segments = [];
        if (shift) {
            const { results } = await context.env.DB.prepare(
                "SELECT * FROM segments WHERE shift_id = ? ORDER BY order_index ASC"
            ).bind(shift.id).all();
            segments = results;
        }

        return Response.json({ shift, segments }, { headers: corsHeaders });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}

// PUT: Save Shift
export async function onRequestPut(context) {
    try {
        // Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }
        const token = authHeader.replace('Bearer ', '');
        const userId = await verifyClerkToken(token, context.env);

        const data = await context.request.json();
        const { shift, segments } = data; // shift object, segments array

        if (!shift || !shift.date) return new Response("Invalid data", { status: 400, headers: corsHeaders });

        // --- SAFETY NET (V2) ---
        // If we are wiping segments (segments = empty), we MUST ensure it's intentional.
        // We check for a special `force_clear` flag in the payload.
        // Exception: If the DB has no segments anyway, wiping is fine (idempotent).

        // 1. Fetch Existing State
        const existingShift = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE user_id = ? AND date = ?"
        ).bind(userId, shift.date).first();

        let existingSegments = [];
        if (existingShift) {
            const { results } = await context.env.DB.prepare(
                "SELECT * FROM segments WHERE shift_id = ?"
            ).bind(existingShift.id).all();
            existingSegments = results;
        }

        const isWipingData = existingSegments.length > 0 && (!segments || segments.length === 0);
        const isForceClear = data.force_clear === true;

        if (isWipingData && !isForceClear) {
            return new Response("Safety Block: Cannot wipe existing segments without force_clear flag.", {
                status: 400,
                headers: corsHeaders
            });
        }

        const shiftId = shift.id || crypto.randomUUID();
        const batch = [];

        // --- HISTORY BACKUP ---
        // Archive only if we are overwriting actual data (segments > 0 or shift exists)
        if (existingShift && (existingSegments.length > 0 || isWipingData)) {
            const backupData = JSON.stringify({
                shift: existingShift,
                segments: existingSegments
            });

            batch.push(context.env.DB.prepare(`
                INSERT INTO shifts_history (shift_id, user_id, date, backup_json, archived_at)
                VALUES (?, ?, ?, ?, ?)
            `).bind(existingShift.id, userId, shift.date, backupData, Date.now()));
        }

        // 1. Insert/Replace Shift
        batch.push(context.env.DB.prepare(`
            INSERT OR REPLACE INTO shifts (
                id, user_id, date, start_time, end_time,
                km_start, km_end, 
                energy_18_start, energy_18_end, 
                energy_28_start, energy_28_end,
                status_json, comments,
                guest_rides, waiting_times
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            shiftId, userId, shift.date,
            shift.start_time || null,
            shift.end_time || null,
            shift.km_start || null,
            shift.km_end || null,
            shift.energy_18_start || null,
            shift.energy_18_end || null,
            shift.energy_28_start || null,
            shift.energy_28_end || null,
            JSON.stringify(shift.flags || {}),
            shift.notes || null,
            JSON.stringify(shift.guest_rides || []),
            JSON.stringify(shift.waiting_times || [])
        ));

        // 2. Delete old segments
        batch.push(context.env.DB.prepare("DELETE FROM segments WHERE shift_id = ?").bind(shiftId));

        // 3. Insert new segments
        const safeSegments = Array.isArray(segments) ? segments : [];
        safeSegments.forEach((seg, index) => {
            batch.push(context.env.DB.prepare(`
                INSERT INTO segments (
                    shift_id, order_index, 
                    train_nr, loco_nr, from_station, to_station, 
                    departure, arrival, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                shiftId, index,
                seg.train_nr || null,
                seg.tfz || null,
                seg.from_code || null,
                seg.to_code || null,
                seg.departure || null,
                seg.arrival || null,
                seg.notes || null
            ));
        });

        await context.env.DB.batch(batch);

        return Response.json({ success: true, id: shiftId }, { headers: corsHeaders });

    } catch (err) {
        console.error("Save Error:", err);
        return Response.json({ error: err.message, stack: err.stack }, { status: 500, headers: corsHeaders });
    }
}

// DELETE: Remove Shift for Date
export async function onRequestDelete(context) {
    try {
        const { searchParams } = new URL(context.request.url);
        const date = searchParams.get('date');

        if (!date) return new Response("Missing date parameter", { status: 400, headers: corsHeaders });

        // Auth Check
        const authHeader = context.request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response('Unauthorized', { status: 401, headers: corsHeaders });
        }
        const token = authHeader.replace('Bearer ', '');
        const userId = await verifyClerkToken(token, context.env);

        // 1. Find Shift ID
        const shift = await context.env.DB.prepare(
            "SELECT id FROM shifts WHERE user_id = ? AND date = ?"
        ).bind(userId, date).first();

        if (!shift) {
            return Response.json({ message: "Nothing to delete" }, { headers: corsHeaders });
        }

        // 2. Delete Segments & Shift
        const batch = [
            context.env.DB.prepare("DELETE FROM segments WHERE shift_id = ?").bind(shift.id),
            context.env.DB.prepare("DELETE FROM shifts WHERE id = ?").bind(shift.id)
        ];

        await context.env.DB.batch(batch);

        return Response.json({ success: true, deleted: true }, { headers: corsHeaders });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
    }
}
