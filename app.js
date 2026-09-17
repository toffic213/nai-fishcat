const STORAGE_KEY_PRESETS = 'nai_presets';
const STORAGE_KEY_GALLERY = 'nai_gallery';
const STORAGE_KEY_QUEUE = 'nai_queue';
const STORAGE_KEY_TOKEN = 'nai_token';
const STORAGE_KEY_API_ENDPOINT = 'nai_api_endpoint';

let state = {
  presets: [],
  gallery: [],
  queue: [],
  currentArtist: null,
  processing: false
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  renderPresets();
  renderArtistSelect();
  renderGallery();
  renderQueue();
  loadSettings();

  // 快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      generate();
    }
  });
});

// ===== 设置管理 =====
function openSettings() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
  const endpoint = localStorage.getItem(STORAGE_KEY_API_ENDPOINT) || '/api/generate';

  document.getElementById('tokenInput').value = token;
  document.getElementById('apiEndpoint').value = endpoint;

  document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
  const token = document.getElementById('tokenInput').value.trim();
  const endpoint = document.getElementById('apiEndpoint').value.trim();

  if (false && !token) {
    show('请输入 API Token');
    return;
  }

  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  localStorage.setItem(STORAGE_KEY_API_ENDPOINT, endpoint);

  closeSettings();
  show('设置已保存');
}

function loadSettings() {
  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  if (!token) {
    setTimeout(() => {
      show('⚙ 请先点击右上角设置添加 API Token');
    }, 500);
  }
}

function getApiEndpoint() {
  return '/api/generate';
}

function getApiToken() {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

// ===== 预设管理 =====
function loadFromStorage() {
  const presets = localStorage.getItem(STORAGE_KEY_PRESETS);
  const gallery = localStorage.getItem(STORAGE_KEY_GALLERY);
  const queue = localStorage.getItem(STORAGE_KEY_QUEUE);

  if (presets) state.presets = JSON.parse(presets);
  if (gallery) state.gallery = JSON.parse(gallery);
  if (queue) state.queue = JSON.parse(queue);
  state.gallery.forEach(item => { if (!item.imageUrl && item.imageData) item.imageUrl = item.imageData; });
  state.presets.forEach(preset => {
    if (preset.model === 'nai-diffusion-4' || preset.model === 'nai-diffusion-4-5') preset.model = 'nai-diffusion-5';
    preset.results = preset.results || [];
  });
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(state.presets));
  localStorage.setItem(STORAGE_KEY_GALLERY, JSON.stringify(state.gallery));
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(state.queue));
}

function showPresetForm() {
  const name = prompt('画师名称 (例如: 水彩风格)');
  if (!name) return;

  const prompt = prompt('提示词 (核心描述)');
  if (!prompt) return;

  const seed = prompt('种子 (留空为随机)') || '';

  const preset = {
    id: Date.now(),
    name,
    prompt,
    seed,
    negativePrompt: 'lowres, bad quality, blurry, low quality, worst quality, text, watermark',
    model: 'nai-diffusion-5',
    resolution: '640x960',
    steps: 28,
    guidance: 7,
    sampler: 'k_euler',
    schedule: 'native',
    qualityToggle: 'true'
  };

  state.presets.push(preset);
  saveToStorage();
  renderPresets();
  renderArtistSelect();
  show('预设已保存');
}

function deletePreset(id) {
  if (confirm('确定删除预设?')) {
    state.presets = state.presets.filter(p => p.id !== id);
    saveToStorage();
    renderPresets();
    renderArtistSelect();
    show('预设已删除');
  }
}

function renderPresets() {
  const list = document.getElementById('presetList');
  list.innerHTML = state.presets.map(p => `
    <div class="preset-item" onclick="loadPreset(${p.id})">
      <strong>${p.name}</strong>
      <small>${p.prompt.substring(0, 30)}... · ${(p.results || []).length} 张效果图</small>
      <div style="margin-top: 6px; font-size: 11px; color: #666;">
        ${p.model} · ${p.steps}步
      </div>
      <button onclick="event.stopPropagation(); deletePreset(${p.id})" style="
        float: right;
        background: none;
        border: none;
        color: #f44;
        cursor: pointer;
        padding: 0;
        font-size: 16px;
      ">×</button>
    </div>
  `).join('');
}

function renderArtistSelect() {
  const select = document.getElementById('artistSelect');
  select.innerHTML = '<option value="">选择预设...</option>' +
    state.presets.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
}

function loadPreset(id) {
  const preset = state.presets.find(p => p.id === id);
  if (!preset) return;

  document.getElementById('prompt').value = preset.prompt;
  document.getElementById('negativePrompt').value = preset.negativePrompt;
  document.getElementById('model').value = preset.model;
  document.getElementById('resolution').value = preset.resolution;
  document.getElementById('steps').value = preset.steps;
  document.getElementById('guidance').value = preset.guidance;
  document.getElementById('sampler').value = preset.sampler;
  document.getElementById('schedule').value = preset.schedule;
  document.getElementById('qualityToggle').value = preset.qualityToggle;
  if (preset.seed) document.getElementById('seed').value = preset.seed;

  state.currentArtist = preset;
}

function applyPreset() {
  const select = document.getElementById('artistSelect');
  const id = parseInt(select.value);
  if (id) loadPreset(id);
}

// ===== 生成 =====
async function generate() {
  const prompt = document.getElementById('prompt').value.trim();
  if (!prompt) {
    show('请输入提示词');
    return;
  }

  const token = getApiToken() || '';
  if (false && !token) {
    show('⚙ 请先设置 API Token');
    openSettings();
    return;
  }

  const jobId = Date.now().toString();
  const job = {
    id: jobId,
    prompt,
    negativePrompt: document.getElementById('negativePrompt').value,
    model: document.getElementById('model').value,
    resolution: document.getElementById('resolution').value,
    steps: parseInt(document.getElementById('steps').value),
    guidance: parseFloat(document.getElementById('guidance').value),
    seed: document.getElementById('seed').value || null,
    batchSize: parseInt(document.getElementById('batchSize').value),
    sampler: document.getElementById('sampler').value,
    schedule: document.getElementById('schedule').value,
    qualityToggle: document.getElementById('qualityToggle').value === 'true',
    status: 'queued',
    timestamp: new Date().toLocaleString(),
    result: null
  };

  state.queue.push(job);
  saveToStorage();
  renderQueue();
  show('已加入队列');

  // 处理第一个任务
  processQueue();
}

async function processQueue() {
  if (state.processing || state.queue.length === 0) return;

  const job = state.queue.find(j => j.status === 'queued');
  if (!job) return;

  state.processing = true;
  job.status = 'processing';
  renderQueue();

  try {
    const token = getApiToken() || undefined;
    const [width, height] = job.resolution.split('x').map(Number);
    const seed = job.seed ? parseInt(job.seed) : Math.floor(Math.random() * 1000000000);

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        token,
        input: job.prompt,
        model: job.model,
        action: 'generate',
        parameters: {
          width,
          height,
          scale: job.guidance,
          steps: job.steps,
          seed,
          n_samples: job.batchSize,
          negative_prompt: job.negativePrompt,
          sampler: job.sampler,
          qualityToggle: job.qualityToggle
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const imageData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    job.status = 'done';
    job.result = {
      imageUrl: url,
      imageData,
      seed,
      artist: state.currentArtist ? state.currentArtist.name : '自定义'
    };

    // 加入画廊
    state.gallery.unshift({
      id: Date.now(),
      prompt: job.prompt,
      imageUrl: imageData,
      timestamp: job.timestamp,
      artist: job.result.artist,
      seed,
      model: job.model
    });
    if (state.currentArtist) {
      state.currentArtist.results = state.currentArtist.results || [];
      state.currentArtist.results.unshift({ imageData, prompt: job.prompt, seed, model: job.model, timestamp: job.timestamp });
    }

    saveToStorage();
    renderQueue();
    renderGallery();

    // 显示预览
    const preview = document.getElementById('preview');
    preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">`;

    show('✓ 生成完成');
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    show('✗ ' + error.message);
  } finally {
    state.processing = false;
    saveToStorage();
    renderQueue();

    // 继续处理队列
    setTimeout(processQueue, 500);
  }
}

// ===== 队列 =====
function renderQueue() {
  const list = document.getElementById('queueList');
  if (state.queue.length === 0) {
    list.innerHTML = '<div style="color: #666; font-size: 13px;">队列为空</div>';
    return;
  }

  list.innerHTML = state.queue.map((job, idx) => {
    let statusText = '等待中';
    let statusClass = '';
    if (job.status === 'processing') {
      statusText = '处理中...';
      statusClass = 'processing';
    } else if (job.status === 'done') {
      statusText = '完成 ✓';
      statusClass = 'done';
    } else if (job.status === 'error') {
      statusText = '失败 ✗';
    }

    return `
      <div class="queue-item ${statusClass}">
        <div>
          <div>${job.prompt.substring(0, 50)}...</div>
          <div class="queue-status">${job.resolution} · ${job.steps}步 · ${job.sampler} · ${statusText}</div>
        </div>
        <button onclick="removeQueueJob('${job.id}')" style="
          background: none;
          border: none;
          color: #f44;
          cursor: pointer;
          flex-shrink: 0;
        ">×</button>
      </div>
    `;
  }).join('');
}

function removeQueueJob(id) {
  state.queue = state.queue.filter(j => j.id !== id);
  saveToStorage();
  renderQueue();
}

// ===== 画廊 =====
function renderGallery() {
  const grid = document.getElementById('galleryGrid');
  if (state.gallery.length === 0) {
    grid.innerHTML = '<div style="color: #666; font-size: 13px; grid-column: 1/-1;">还没有生成过图像</div>';
    return;
  }

  grid.innerHTML = state.gallery.map(item => `
    <div class="gallery-item" onclick="downloadImage('${item.imageUrl}', '${item.seed}')">
      <img src="${item.imageUrl}" alt="${item.prompt}">
      <div class="gallery-item-info">
        <strong>${item.artist}</strong><br>
        <small>${item.model}</small><br>
        Seed: ${item.seed}
      </div>
    </div>
  `).join('');
}

function downloadImage(url, seed) {
  const a = document.createElement('a');
  a.href = url;
  a.download = `nai-${seed}.png`;
  a.click();
}

// ===== UI 辅助 =====
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  document.getElementById(`tab-${tab}`).classList.add('active');
  event.target.classList.add('active');
}

function show(msg) {
  const div = document.createElement('div');
  div.className = 'message';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
