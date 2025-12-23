export async function onRequestGet(context) {
    try {
        const { results } = await context.env.DB.prepare(
            "SELECT * FROM loklog_entries ORDER BY timestamp DESC"
        ).all();

        return new Response(JSON.stringify(results), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}

export async function onRequestPost(context) {
    try {
        const { user, content } = await context.request.json();
        const timestamp = Date.now();

        const info = await context.env.DB.prepare(
            "INSERT INTO loklog_entries (user, content, timestamp) VALUES (?, ?, ?)"
        )
            .bind(user, content, timestamp)
            .run();

        return new Response(JSON.stringify({ success: true, info }), {
            headers: { "Content-Type": "application/json" },
            status: 201,
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
