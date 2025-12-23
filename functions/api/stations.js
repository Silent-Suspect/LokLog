export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const search = searchParams.get('search'); // standard search (renaming 'q' to 'search' for clarity, but supporting 'q' for backward compatibility if needed, though plan said 'search')
    const q = searchParams.get('q');
    const codes = searchParams.get('codes');

    // MODE 1: Route/Batch Mode
    if (codes) {
        const codeList = codes.split(',').map(c => c.trim()).filter(c => c);

        if (codeList.length === 0) {
            return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
        }

        // Dynamically build placeholders for IN clause
        const placeholders = codeList.map(() => '?').join(',');
        const query = `SELECT * FROM stations WHERE code IN (${placeholders})`;

        try {
            const { results } = await context.env.DB.prepare(query)
                .bind(...codeList)
                .all();

            return new Response(JSON.stringify(results), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: err.message }), { status: 500 });
        }
    }

    // MODE 2: Search Mode (Legacy 'q' or 'search')
    const queryStr = search || q;

    if (!queryStr || queryStr.length < 2) {
        return new Response(JSON.stringify([]), {
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const { results } = await context.env.DB.prepare(
            `SELECT * FROM stations 
       WHERE code LIKE ? OR name LIKE ? OR short_name LIKE ? 
       ORDER BY CASE 
         WHEN code LIKE ? THEN 1 
         WHEN name LIKE ? THEN 2 
         ELSE 3 
       END 
       LIMIT 15`
        )
            .bind(`%${queryStr}%`, `%${queryStr}%`, `%${queryStr}%`, `${queryStr}%`, `${queryStr}%`)
            .all();

        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function onRequestPut(context) {
    try {
        const { code, lat, lng } = await context.request.json();

        if (!code) {
            return new Response(JSON.stringify({ error: "Code is required" }), { status: 400 });
        }

        // Validate lat/lng if necessary
        // Ensure we handle empty strings as null
        const newLat = (lat === '' || lat === undefined) ? null : lat;
        const newLng = (lng === '' || lng === undefined) ? null : lng;

        const result = await context.env.DB.prepare(
            `UPDATE stations SET lat = ?, lng = ? WHERE code = ?`
        )
            .bind(newLat, newLng, code)
            .run();

        if (result.success) {
            return new Response(JSON.stringify({ success: true, code, lat: newLat, lng: newLng }), {
                headers: { "Content-Type": "application/json" },
            });
        } else {
            return new Response(JSON.stringify({ error: "Update failed" }), { status: 500 });
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
