import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'storage.json');

// Middleware
app.use(cors());
app.use(express.json());

// 確保 data 目錄存在
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// 讀取資料
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    // 如果檔案不存在，返回初始資料
    return {
      videos: [],
      markers: [],
      types: []
    };
  }
}

// 寫入資料
async function writeData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing data:', error);
    throw error;
  }
}

// 初始化資料（如果檔案不存在）
async function initializeData() {
  const data = await readData();
  if (data.videos.length === 0 && data.markers.length === 0 && data.types.length === 0) {
    // 初始化預設資料
    data.types = [
      { id: 'question', name: 'Question', color: 'bg-blue-500', textColor: 'text-white' },
      { id: 'summary', name: 'Summary', color: 'bg-yellow-400', textColor: 'text-yellow-900' },
      { id: 'action', name: 'Action', color: 'bg-red-500', textColor: 'text-white' },
      { id: 'reference', name: 'Reference', color: 'bg-green-500', textColor: 'text-white' },
    ];
    data.videos = [
      {
        id: 'v1',
        title: 'Vue.js 3 Fundamentals',
        customName: 'Exam Prep',
        thumbnailUrl: 'https://picsum.photos/400/225?random=1',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        duration: 596,
        bpm: 0,
      },
      {
        id: 'v2',
        title: 'Advanced React Patterns',
        thumbnailUrl: 'https://picsum.photos/400/225?random=2',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        duration: 653,
        bpm: 0,
      },
      {
        id: 'v3',
        title: 'Lo-Fi Hip Hop Beats',
        thumbnailUrl: 'https://picsum.photos/400/225?random=3',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
        duration: 734,
        bpm: 85,
      }
    ];
    data.markers = [
      { id: 'm1', videoId: 'v1', typeId: 'summary', start: 60, end: 125, label: 'Intro to Reactivity', createdAt: Date.now() },
      { id: 'm2', videoId: 'v1', typeId: 'question', start: 350, end: 355, label: 'Why use refs here?', createdAt: Date.now() - 1000 },
    ];
    await writeData(data);
  }
}

// --- Videos API ---
app.get('/api/videos', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.videos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/videos', async (req, res) => {
  try {
    const data = await readData();
    data.videos.push(req.body);
    await writeData(data);
    res.status(201).json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/videos/:id', async (req, res) => {
  try {
    const data = await readData();
    const index = data.videos.findIndex(v => v.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Video not found' });
    }
    data.videos[index] = req.body;
    await writeData(data);
    res.json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/videos/:id', async (req, res) => {
  try {
    const data = await readData();
    const videoId = req.params.id;
    
    // 刪除影片
    data.videos = data.videos.filter(v => v.id !== videoId);
    
    // 同時刪除該影片的所有 markers
    data.markers = data.markers.filter(m => m.videoId !== videoId);
    
    await writeData(data);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Markers API ---
app.get('/api/markers', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.markers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/markers', async (req, res) => {
  try {
    const data = await readData();
    data.markers.push(req.body);
    await writeData(data);
    res.status(201).json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/markers/:id', async (req, res) => {
  try {
    const data = await readData();
    data.markers = data.markers.filter(m => m.id !== req.params.id);
    await writeData(data);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Marker Types API ---
app.get('/api/marker-types', async (req, res) => {
  try {
    const data = await readData();
    res.json(data.types);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/marker-types', async (req, res) => {
  try {
    const data = await readData();
    data.types.push(req.body);
    await writeData(data);
    res.status(201).json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 啟動伺服器
async function startServer() {
  await ensureDataDir();
  await initializeData();
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);

