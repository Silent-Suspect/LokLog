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

        // --- SAFETY NET ---
        // If "Normal Service" is checked, but no segments are provided, reject the update.
        // This prevents accidental wiping of the schedule.
        const flags = shift.flags || {};
        if (flags['Normaldienst'] && (!segments || segments.length === 0)) {
            return new Response("Safety Block: Cannot clear segments while 'Normaldienst' is active.", {
                status: 400,
                headers: corsHeaders
            });
        }

        const shiftId = shift.id || crypto.randomUUID();

        const batch = [];

        // --- HISTORY BACKUP ---
        // Fetch existing state before overwriting
        const existingShift = await context.env.DB.prepare(
            "SELECT * FROM shifts WHERE user_id = ? AND date = ?"
        ).bind(userId, shift.date).first();

        if (existingShift) {
            const { results: existingSegments } = await context.env.DB.prepare(
                "SELECT * FROM segments WHERE shift_id = ?"
            ).bind(existingShift.id).all();

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
            shiftId, userId, shift.date, shift.start_time, shift.end_time,
            shift.km_start, shift.km_end,
            shift.energy_18_start, shift.energy_18_end,
            shift.energy_28_start, shift.energy_28_end,
            JSON.stringify(shift.flags), shift.notes,
            JSON.stringify(shift.guest_rides || []),
            JSON.stringify(shift.waiting_times || [])
        ));

        // 2. Delete old segments
        batch.push(context.env.DB.prepare("DELETE FROM segments WHERE shift_id = ?").bind(shiftId));

        // 3. Insert new segments
        segments.forEach((seg, index) => {
            batch.push(context.env.DB.prepare(`
                INSERT INTO segments (
                    shift_id, order_index, 
                    train_nr, loco_nr, from_station, to_station, 
                    departure, arrival, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                shiftId, index,
                seg.train_nr, seg.tfz, seg.from_code, seg.to_code,
                seg.departure, seg.arrival, seg.notes
            ));
        });

        await context.env.DB.batch(batch);

        return Response.json({ success: true, id: shiftId }, { headers: corsHeaders });

    } catch (err) {
        console.error("Save Error:", err);
        return Response.json({ error: err.message }, { status: 500, headers: corsHeaders });
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
