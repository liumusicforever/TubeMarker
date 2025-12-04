const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000; // 我們將 API 伺服器運行在 3000 port

// --- 檔案路徑設定 ---
// 確保 DATA_FILE 指向我們剛剛建立的 videos.json
const DATA_FILE = path.join(__dirname, 'data', 'videos.json');

// --- 中介軟體 (Middleware) ---
// 允許所有來源 (Vue 前端) 呼叫這個 API
app.use(cors()); 
// 啟用 JSON 請求體解析
app.use(bodyParser.json()); 

// ----------------------------------------------------------------------
// 【API 路由】
// ----------------------------------------------------------------------

// 1. GET /api/videos: 讀取所有影片數據
app.get('/api/videos', (req, res) => {
    try {
        console.log(`[GET] 正在讀取數據: ${DATA_FILE}`);
        // 同步讀取檔案內容
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        // 將 JSON 字串解析成 JavaScript 物件並回傳給前端
        res.json(JSON.parse(data));
    } catch (error) {
        // 如果檔案讀取或解析出錯
        console.error('🚫 讀取數據失敗:', error.message);
        res.status(500).json({ message: '無法讀取伺服器數據' });
    }
});

// 2. PUT /api/videos: 覆寫整個影片列表 (用於保存所有更改)
app.put('/api/videos', (req, res) => {
    const newVideoList = req.body;
    
    if (!Array.isArray(newVideoList)) {
        return res.status(400).json({ message: '請求體必須是一個影片陣列 (Bad Request)' });
    }

    try {
        // 將接收到的 JavaScript 物件轉換回格式化的 JSON 字串
        // null, 2 讓 JSON 檔案有縮排，方便閱讀
        const dataToWrite = JSON.stringify(newVideoList, null, 2);
        
        // 同步寫入檔案，覆寫舊內容
        fs.writeFileSync(DATA_FILE, dataToWrite, 'utf8');
        
        console.log(`[PUT] 數據已成功保存到 ${DATA_FILE}`);
        res.status(200).json({ message: '數據保存成功' });
    } catch (error) {
        console.error('🚫 寫入數據失敗:', error.message);
        res.status(500).json({ message: '無法保存數據到伺服器' });
    }
});

// ----------------------------------------------------------------------

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`
============================================
🚀 API Server 運行於 http://localhost:${PORT}
============================================
    `);
});
