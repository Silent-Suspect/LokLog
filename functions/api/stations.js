export async function onRequestGet(context) {
    const { searchParams } = new URL(context.request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
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
       LIMIT 20`
        )
            .bind(`%${query}%`, `%${query}%`, `%${query}%`, `${query}%`, `${query}%`)
            .all();

        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
