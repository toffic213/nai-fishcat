const API_URL = 'https://api.novelai.net/ai/generate-image';
const STORAGE_KEY_PRESETS = 'nai_presets';
const STORAGE_KEY_GALLERY = 'nai_gallery';
const STORAGE_KEY_QUEUE = 'nai_queue';
const STORAGE_KEY_TOKEN = 'nai_token';

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
  renderGallery();
  renderQueue();

  // 快捷键
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      generate();
    }
  });
});

// ===== 预设管理 =====
function loadFromStorage() {
  const presets = localStorage.getItem(STORAGE_KEY_PRESETS);
  const gallery = localStorage.getItem(STORAGE_KEY_GALLERY);
  const queue = localStorage.getItem(STORAGE_KEY_QUEUE);

  if (presets) state.presets = JSON.parse(presets);
  if (gallery) state.gallery = JSON.parse(gallery);
  if (queue) state.queue = JSON.parse(queue);
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(state.presets));
  localStorage.setItem(STORAGE_KEY_GALLERY, JSON.stringify(state.gallery));
  localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(state.queue));
}

function showPresetForm() {
  const name = prompt('输入画师名称:');
  if (!name) return;

  const prompt = prompt('输入提示词:');
  if (!prompt) return;

  const seed = prompt('输入种子 (留空为随机):') || '';

  const preset = {
    id: Date.now(),
    name,
    prompt,
    seed,
    negativePrompt: 'lowres, bad quality, low quality',
    model: 'nai-diffusion-4',
    resolution: '640x960',
    steps: 28,
    guidance: 7
  };

  state.presets.push(preset);
  saveToStorage();
  renderPresets();
  show('预设已保存');
}

function deletePreset(id) {
  if (confirm('确定删除?')) {
    state.presets = state.presets.filter(p => p.id !== id);
    saveToStorage();
    renderPresets();
    show('预设已删除');
  }
}

function renderPresets() {
  const list = document.getElementById('presetList');
  list.innerHTML = state.presets.map(p => `
    <div class="preset-item" onclick="loadPreset(${p.id})">
      <strong>${p.name}</strong>
      <small>${p.prompt.substring(0, 30)}...</small>
      <button onclick="event.stopPropagation(); deletePreset(${p.id})" style="
        float: right;
        background: none;
        border: none;
        color: #f44;
        cursor: pointer;
        padding: 0;
      ">×</button>
    </div>
  `).join('');
}

function loadPreset(id) {
  const preset = state.presets.find(p => p.id === id);
  if (!preset) return;

  document.getElementById('artistSelect').value = id;
  document.getElementById('prompt').value = preset.prompt;
  document.getElementById('negativePrompt').value = preset.negativePrompt;
  document.getElementById('model').value = preset.model;
  document.getElementById('resolution').value = preset.resolution;
  document.getElementById('steps').value = preset.steps;
  document.getElementById('guidance').value = preset.guidance;
  if (preset.seed) document.getElementById('seed').value = preset.seed;

  state.currentArtist = preset;
  show('已加载预设: ' + preset.name);
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

  const token = localStorage.getItem(STORAGE_KEY_TOKEN);
  if (!token) {
    const newToken = prompt('输入 Novel AI API Token (从 https://novelai.net 获取):');
    if (!newToken) return;
    localStorage.setItem(STORAGE_KEY_TOKEN, newToken);
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
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    const [width, height] = job.resolution.split('x').map(Number);
    const seed = job.seed ? parseInt(job.seed) : Math.floor(Math.random() * 1000000000);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
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
          sampler: 'k_euler',
          schedule: 'native'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    job.status = 'done';
    job.result = {
      imageUrl: url,
      seed,
      artist: state.currentArtist ? state.currentArtist.name : 'Custom'
    };

    // 加入画廊
    state.gallery.unshift({
      id: Date.now(),
      prompt: job.prompt,
      imageUrl: url,
      timestamp: job.timestamp,
      artist: job.result.artist,
      seed
    });

    saveToStorage();
    renderQueue();
    renderGallery();

    // 显示预览
    const preview = document.getElementById('preview');
    preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">`;

    show('生成完成!');
  } catch (error) {
    job.status = 'error';
    job.error = error.message;
    show('生成失败: ' + error.message);
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
          <div class="queue-status">${job.resolution} · ${job.steps} steps · ${statusText}</div>
        </div>
        <button onclick="removeQueueJob('${job.id}')" style="
          background: none;
          border: none;
          color: #f44;
          cursor: pointer;
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
        ${item.timestamp}
      </div>
    </div>
  `).join('');
}

function downloadImage(url, seed) {
  const a = document.createElement('a');
  a.href = url;
  a.download = `novel-${seed}.png`;
  a.click();
}

// ===== UI 辅助 =====
function switchTab(tab) {
  // 隐藏所有标签页
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

  // 显示选中标签页
  document.getElementById(`tab-${tab}`).classList.add('active');
  event.target.classList.add('active');
}

function show(msg) {
  const div = document.createElement('div');
  div.className = 'message';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2500);
}
