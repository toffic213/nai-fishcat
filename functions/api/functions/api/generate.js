export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const endpoint = env.IMAGE_API_URL;
  const key = env.IMAGE_API_KEY;
  if (!endpoint || !key) return Response.json({ error: '未配置 IMAGE_API_URL / IMAGE_API_KEY，当前使用本地预览模式。' }, { status: 501 });
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  return new Response(response.body, { status: response.status, headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' } });
}
