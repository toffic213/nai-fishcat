export async function onRequestPost({ request, env }) {
  const body = await request.json();

  const token = body.token || env.NOVELAI_TOKEN;
  if (!token) {
    return Response.json({
      error: '缺少 Novel AI Token，请在前端输入或设置环境变量 NOVELAI_TOKEN'
    }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.novelai.net/ai/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        input: body.prompt,
        model: body.model || 'nai-diffusion-4',
        action: 'generate',
        parameters: body.parameters || {
          width: 640,
          height: 960,
          scale: 7,
          steps: 28,
          n_samples: 1,
          sampler: 'k_euler',
          schedule: 'native'
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: error || '生图 API 失败' }, { status: response.status });
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
