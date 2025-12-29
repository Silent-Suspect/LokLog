// Helper: Standard Response Headers (CORS + JSON)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
};

// Handle OPTIONS
export async function onRequestOptions() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
        }
    });
}

// GET Proxy
export async function onRequestGet(context) {
    const linkA = context.env.TEMPLATE_A;
    const linkB = context.env.TEMPLATE_B;

    if (!linkA || !linkB) {
        return new Response(JSON.stringify({ error: "Configuration Error: TEMPLATE_A or TEMPLATE_B missing." }), {
            status: 500,
            headers: corsHeaders
        });
    }

    try {
        // Fetch both templates in parallel
        const [respA, respB] = await Promise.all([
            fetch(linkA),
            fetch(linkB)
        ]);

        if (!respA.ok || !respB.ok) {
            return new Response(JSON.stringify({ error: `Upstream Error. A: ${respA.status}, B: ${respB.status}` }), {
                status: 502,
                headers: corsHeaders
            });
        }

        // Get buffers
        const bufA = await respA.arrayBuffer();
        const bufB = await respB.arrayBuffer();

        // Convert to Base64
        // Platform agnostic way for CF Workers (Node 'Buffer' might not be available directly in all runtimes, but btoa/Uint8Array is standard)
        const base64A = btoa(String.fromCharCode(...new Uint8Array(bufA)));
        const base64B = btoa(String.fromCharCode(...new Uint8Array(bufB)));

        // Return JSON
        return new Response(JSON.stringify({
            templateA: base64A,
            templateB: base64B
        }), {
            status: 200,
            headers: corsHeaders
        });

    } catch (err) {
        console.error("Proxy Logic Error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: corsHeaders
        });
    }
}
