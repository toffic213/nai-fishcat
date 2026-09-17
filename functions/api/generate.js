const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function unzipFirstImage(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x04034b50) return null;
  const method = view.getUint16(8, true);
  const compressedSize = view.getUint32(18, true);
  const nameLength = view.getUint16(26, true);
  const extraLength = view.getUint16(28, true);
  const start = 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + compressedSize);
  if (method === 0) return compressed;
  if (method !== 8) throw new Error(`Unsupported ZIP compression method: ${method}`);
  return new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const token = body.token || env.NOVELAI_TOKEN;
  if (!token) return Response.json({ error: 'Missing NovelAI token' }, { status: 401, headers: corsHeaders });
  try {
    const response = await fetch('https://api.novelai.net/ai/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ input: body.input || body.prompt, model: body.model || 'nai-diffusion-4-5', action: 'generate', parameters: body.parameters || {} })
    });
    if (!response.ok) return Response.json({ error: await response.text() }, { status: response.status, headers: corsHeaders });
    const upstream = await response.arrayBuffer();
    const image = (response.headers.get('content-type') || '').includes('zip') ? await unzipFirstImage(upstream) : new Uint8Array(upstream);
    if (!image) throw new Error('NovelAI returned an unexpected image format');
    return new Response(image, { headers: { ...corsHeaders, 'Content-Type': 'image/png' } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
