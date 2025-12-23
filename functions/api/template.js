// Helper: Standard Response Headers (CORS)
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
    const templateLink = context.env.TEMPLATE_URL;

    if (!templateLink) {
        return new Response("Error: TEMPLATE_URL not configured in environment.", { status: 500 });
    }

    try {
        console.log("Fetching template from:", templateLink);
        const remoteResp = await fetch(templateLink);

        if (!remoteResp.ok) {
            console.error("Upstream Error:", remoteResp.status, remoteResp.statusText);
            return new Response(`Upstream Error: ${remoteResp.statusText}`, { status: remoteResp.status });
        }

        // Return stream directly to keep binary data intact
        return new Response(remoteResp.body, { headers: corsHeaders });

    } catch (err) {
        console.error("Proxy Error:", err);
        return new Response(`Proxy Error: ${err.message}`, { status: 500 });
    }
}
