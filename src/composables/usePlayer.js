import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';

// --- 常量定義 (與原 script 相同) ---
const MARKER_TYPE_MAP = {
    'question': { class: 'type-question', hex: '#fdcb6e', displayName: '疑問點 (Question)' },
    'summary': { class: 'type-summary', hex: '#0984e3', displayName: '重點摘要 (Summary)' },
    'action': { class: 'type-action', hex: '#d63031', displayName: '待辦/行動 (Action)' },
    'reference': { class: 'type-reference', hex: '#00b894', displayName: '參考資料 (Reference)' },
    'default': { class: 'type-default', hex: '#b2bec3', displayName: '其他標記 (Other)' }
};

const FALLBACK_VIDEO_DATA = [
    {
        id: 1,
        name: "Vue 3 核心概念與 Composition API",
        videoId: "acvIVA9-FMQ",
        duration: 0,
        timeLabels: [{ start: 5, end: 10, label: "Vue 核心差異 (FALLBACK)", type: 'summary' }],
        bpm: 120
    },
    {
        id: 2,
        name: "TypeScript 完整教學：從基礎到實戰",
        videoId: "K544Q2kHhW8",
        duration: 0,
        timeLabels: [{ start: 10, end: 25, label: "型別系統介紹 (FALLBACK)", type: 'summary' }],
        bpm: null
    }
];

const API_ENDPOINT = 'http://localhost:3000/api/videos';

// --- Server API (從原 script 複製) ---
const ServerAPIManager_Full = {
    async loadData() {
        console.log(`[ServerAPIManager] 嘗試從 ${API_ENDPOINT} 載入數據...`);
        try {
            const response = await fetch(API_ENDPOINT);
            if (!response.ok) {
                throw new Error(`伺服器回應錯誤: ${response.status} ${response.statusText}`);
            }
            const loadedData = await response.json();
            console.log(`[ServerAPIManager] 成功載入 ${loadedData.length} 筆數據。`);
            return loadedData.map(video => ({
                ...video,
                timeLabels: video.timeLabels.map(label => {
                    if (label.time !== undefined && label.start === undefined) {
                        const end = label.end !== undefined ? label.end : label.time + 1;
                        return { start: label.time, end: end, label: label.label, type: label.type };
                    }
                    return label;
                }),
                currentTime: 0, isPlaying: false, duration: video.duration || 0,
            }));

        } catch (e) {
            console.error("🚫 [ServerAPIManager] 載入數據失敗，退回使用本地備用數據。請檢查 Node.js 伺服器是否運行在 3000 port。", e);
            return FALLBACK_VIDEO_DATA.map(v => ({ ...v, currentTime: 0, isPlaying: false }));
        }
    },
    async saveData(videoList) {
        const persistentData = videoList.map(v => ({
            id: v.id, name: v.name, videoId: v.videoId, timeLabels: v.timeLabels, bpm: v.bpm, duration: v.duration || 0,
        }));
        if (persistentData.length === 0) { console.warn('[ServerAPIManager] 無數據可儲存，跳過 PUT 請求。'); return; }
        console.log(`[ServerAPIManager] 嘗試儲存 ${persistentData.length} 筆數據到伺服器...`);
        try {
            const response = await fetch(API_ENDPOINT, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(persistentData) });
            if (!response.ok) {
                const errorBody = await response.json();
                throw new Error(`伺服器儲存失敗: ${response.statusText}. 詳情: ${errorBody.message}`);
            }
        } catch (e) {
            console.error("🚫 [ServerAPIManager] 儲存數據失敗。請檢查 Node.js 伺服器是否運行在 3000 port。", e);
        }
    }
};

// --- 輔助工具函數 (Utility Functions) ---
// 移出到這裡，讓所有組件和 usePlayer 都能使用
const formatTime = (seconds) => {
    const sec = Math.floor(seconds);
    const min = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${min}:${remainingSec < 10 ? '0' : ''}${remainingSec}`;
};
const getMarkerColorHex = (type) => {
    const typeInfo = MARKER_TYPE_MAP[type] || MARKER_TYPE_MAP.default;
    return typeInfo.hex;
};
const getTimelineTimeFromEvent = (event, videoDuration) => {
    if (videoDuration === 0) return 0;
    const timeline = event.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.min(1, Math.max(0, clickX / width));
    return Math.floor(percentage * videoDuration);
};

// --- 核心組合式函數 ---
export function usePlayer() {
    // --- 響應式狀態 (原 data) ---
    const selectedVideoId = ref(null);
    const videoList = ref([]);
    const isLoading = ref(true);
    const loadedPlayers = new Map(); // YT Players
    const intervalIds = new Map(); // 播放器計時器

    // Tap Tempo 狀態
    const tapTempoData = ref({
        tapTimes: [],
        displayBPM: null,
        maxTapInterval: 2000,
    });

    // 範圍選取狀態
    const rangeData = ref({
        isSelecting: false,
        selectionStart: 0,
        selectionEnd: 0,
        selectedDuration: 0,
    });

    // 標記類型狀態
    const selectedMarkerType = ref(null);
    const markerTypes = MARKER_TYPE_MAP;

    // --- Computed 屬性 (原 computed) ---
    const currentVideo = computed(() => {
        if (!selectedVideoId.value) return null;
        return videoList.value.find(v => v.id === selectedVideoId.value);
    });

    // 計算選取區間的視覺化樣式
    const selectionRangeStyle = computed(() => {
        const video = currentVideo.value;
        if (!video || video.duration === 0) return { display: 'none' };

        if (!rangeData.value.isSelecting && rangeData.value.selectedDuration === 0) {
            return { display: 'none' };
        }

        const start = Math.min(rangeData.value.selectionStart, rangeData.value.selectionEnd);
        const end = Math.max(rangeData.value.selectionStart, rangeData.value.selectionEnd);

        const startPercent = (start / video.duration) * 100;
        const endPercent = (end / video.duration) * 100;

        const typeKey = selectedMarkerType.value || 'default';
        const color = MARKER_TYPE_MAP[typeKey].hex;

        return {
            left: `${startPercent}%`,
            width: `${Math.min(endPercent - startPercent, 100)}%`,
            backgroundColor: `${color}40` // 40 代表 25% 透明度
        };
    });

    // 分組標記點
    const groupedMarkers = computed(() => {
        if (!currentVideo.value) return {};

        const groups = {};
        const types = Object.keys(MARKER_TYPE_MAP);

        types.forEach(type => {
            groups[type] = {
                displayName: MARKER_TYPE_MAP[type].displayName,
                colorHex: MARKER_TYPE_MAP[type].hex,
                markers: []
            };
        });

        currentVideo.value.timeLabels.forEach(label => {
            const type = label.type in MARKER_TYPE_MAP ? label.type : 'default';
            if (typeof label.start === 'number' && typeof label.end === 'number') {
                groups[type].markers.push(label);
            }
        });

        const orderedGroups = {};
        types.forEach(type => {
            if (groups[type].markers.length > 0) {
                groups[type].markers.sort((a, b) => a.start - b.start);
                orderedGroups[type] = groups[type];
            }
        });

        return orderedGroups;
    });

    // --- 核心方法 (原 methods) ---

    // --- YT 播放器相關 (原 methods) ---
    const getVidoeIndex = (videoId) => videoList.value.findIndex(v => v.id === videoId);

    const updateTime = (videoId) => {
        const player = loadedPlayers.get(videoId);
        const index = getVidoeIndex(videoId);
        if (player && index !== -1 && typeof player.getCurrentTime === 'function') {
            videoList.value[index].currentTime = Math.floor(player.getCurrentTime());
        }
    };
    const stopTimer = (videoId) => {
        const id = intervalIds.get(videoId);
        if (id) {
            clearInterval(id);
            intervalIds.delete(videoId);
        }
    };
    const startTimer = (videoId) => {
        if (!intervalIds.has(videoId)) {
            const id = setInterval(() => updateTime(videoId), 500);
            intervalIds.set(videoId, id);
        }
    };
    const onPlayerStateChangeWithId = (event, videoId) => {
        const index = getVidoeIndex(videoId);
        if (index === -1) return;
        const PlayerState = window.YT.PlayerState;
        const newState = event.data;

        if (newState === PlayerState.PLAYING) {
            videoList.value[index].isPlaying = true;
            startTimer(videoId);
        } else if (newState === PlayerState.PAUSED || newState === PlayerState.ENDED || newState === PlayerState.BUFFERING) {
            videoList.value[index].isPlaying = false;
            stopTimer(videoId);
            if (newState === PlayerState.ENDED) { videoList.value[index].currentTime = 0; }
        }
    };
    // --- 追蹤後的 onPlayerReadyWithId ---
    const onPlayerReadyWithId = (event, videoId) => {
        const index = getVidoeIndex(videoId);
        if (index === -1) return;

        // **新增追蹤**：如果看到這個訊息，表示播放器已成功初始化並可用！
        console.log(`✅ [YT Player Ready] ID: ${videoId}, 標題: ${event.target.getVideoData().title}`);

        const duration = Math.floor(event.target.getDuration());
        const title = event.target.getVideoData().title;

        if (videoList.value[index].duration !== duration || videoList.value[index].name === videoList.value[index].videoId) {
            videoList.value[index].duration = duration;
            if (videoList.value[index].name === videoList.value[index].videoId) {
                videoList.value[index].name = title;
            }
            ServerAPIManager_Full.saveData(videoList.value);
        }
    };
    // --- 追蹤後的 createPlayer ---
    // 新：接收兩個參數，並將 YT 的 videoId 傳入
    const createPlayer = (videoId, ytVideoId) => {
        const domId = `player-preview-${videoId}`; // 直接使用正確的 DOM ID
        const playerDom = document.getElementById(domId);

        if (loadedPlayers.has(videoId)) {
            // 如果已經載入，就不需重複初始化 (這應該不會發生，但以防萬一)
            return;
        }

        if (playerDom) {
            console.log(`➡️ [Create Player] 嘗試初始化 ID: ${videoId}, YT ID: ${ytVideoId} 到 DOM: ${domId}`);
            const player = new window.YT.Player(domId, { // 傳入 DOM ID
                // ✅ 關鍵修正：將 YouTube 影片 ID 傳入
                videoId: ytVideoId,
                playerVars: {
                    controls: 1, // 顯示播放控制項
                    rel: 0,
                    fs: 1,
                },
                events: {
                    'onReady': (event) => onPlayerReadyWithId(event, videoId),
                    'onStateChange': (event) => onPlayerStateChangeWithId(event, videoId)
                }
            });
            loadedPlayers.set(videoId, player);
        } else {
            console.warn(`❌ [Create Player] 找不到 DOM 元素來初始化 ID: ${videoId}。跳過。`);
        }
    };
    const initAllPlayers = () => {
        videoList.value.forEach(video => {
            // ✅ 新呼叫：傳入 自訂ID (video.id) 和 YouTube ID (video.videoId)
            createPlayer(video.id, video.videoId);
        });
    };

    // --- BPM 相關 (原 methods) ---
    const calculateBPM = (times) => {
        if (times.length < 3) return;
        let intervals = [];
        for (let i = 1; i < times.length; i++) {
            intervals.push(times[i] - times[i - 1]);
        }
        const sumIntervals = intervals.reduce((a, b) => a + b, 0);
        const averageInterval = sumIntervals / intervals.length;
        const calculatedBPM = 60000 / averageInterval;
        tapTempoData.value.displayBPM = calculatedBPM.toFixed(1);
    };
    const resetTapTempo = () => {
        tapTempoData.value.tapTimes = [];
        tapTempoData.value.displayBPM = null;
        console.log("Tap Tempo 已重設。");
    };
    const handleTapTempo = () => {
        const now = performance.now();
        const currentTimes = tapTempoData.value.tapTimes;

        if (currentTimes.length > 0 && (now - currentTimes[currentTimes.length - 1]) > tapTempoData.value.maxTapInterval) {
            resetTapTempo();
            tapTempoData.value.tapTimes.push(now);
            return;
        }

        currentTimes.push(now);

        if (currentTimes.length > 10) {
            currentTimes.shift();
        }

        if (currentTimes.length >= 3) {
            calculateBPM(currentTimes);
        }
    };
    const saveBPM = () => {
        if (!currentVideo.value || !tapTempoData.value.displayBPM) return;

        const newBPM = Math.round(parseFloat(tapTempoData.value.displayBPM));

        const videoIndex = getVidoeIndex(currentVideo.value.id);
        if (videoIndex !== -1) {
            videoList.value[videoIndex].bpm = newBPM;
            ServerAPIManager_Full.saveData(videoList.value);
            console.log(`影片 ID ${currentVideo.value.id} 的 BPM 已儲存為 ${newBPM} (Server 儲存)`);
        }
        resetTapTempo();
    };

    // --- 播放器/導航控制 (原 methods) ---
    const togglePlay = (videoId) => {
        const player = loadedPlayers.get(videoId);

        // 1. 檢查播放器實例是否存在
        if (!player) {
            console.warn(`[togglePlay] 影片 ID ${videoId} 的播放器實例不存在。`);
            return;
        }

        // 2. 檢查關鍵方法是否存在，確保播放器已準備好
        // 如果 player.getPlayerState 不是一個函數，則播放器尚未準備就緒，直接返回或等待。
        if (typeof player.getPlayerState !== 'function') {
            console.warn(`[togglePlay] 影片 ID ${videoId} 的播放器尚未準備就緒 (getPlayerState 不可用)。`);
            // 可選：如果你希望它在準備好後自動播放，則需要更複雜的狀態管理。
            // 對於簡單的切換，這裡直接返回是最安全的。
            return;
        }

        const PlayerState = window.YT.PlayerState;
        const state = player.getPlayerState();

        if (state === PlayerState.PLAYING) {
            player.pauseVideo();
        } else {
            videoList.value.forEach(v => {
                if (v.id !== videoId && v.isPlaying) {
                    const otherPlayer = loadedPlayers.get(v.id);
                    // 同樣的，在暫停其他播放器時也應檢查方法是否存在
                    if (otherPlayer && typeof otherPlayer.pauseVideo === 'function') {
                        otherPlayer.pauseVideo();
                    }
                }
            });
            player.playVideo();
        }
    };
    // --- 修正後的 jumpToTime ---
    const jumpToTime = (videoId, time) => {
        const player = loadedPlayers.get(videoId);
        const index = getVidoeIndex(videoId);

        // **關鍵檢查點**：確認 seekTo 方法和 getPlayerState 方法均已掛載
        if (player && index !== -1 && typeof player.seekTo === 'function') {
            player.seekTo(time, true);
            videoList.value[index].currentTime = time;

            // 確保可以檢查播放狀態
            if (typeof player.getPlayerState === 'function' && player.getPlayerState() !== window.YT.PlayerState.PLAYING) {
                togglePlay(videoId);
            }
        } else {
            console.warn(`[jumpToTime] 影片 ID ${videoId} 的播放器尚未準備好 (seekTo 不可用)。`);
        }
    };
    const selectVideo = (videoId) => {
        videoList.value.forEach(v => {
            if (v.id !== videoId && v.isPlaying) {
                const otherPlayer = loadedPlayers.get(v.id);
                if (otherPlayer) otherPlayer.pauseVideo();
            }
        });
        resetTapTempo();
        selectedVideoId.value = videoId;
        selectedMarkerType.value = null;

        nextTick(() => {
            const tapTempoSection = document.querySelector('.tap-tempo-section');
            if (tapTempoSection) {
                tapTempoSection.focus();
            }

            // 修正：移除對 YT 播放器內部結構的存取 (例如 .h.className)。
            // 直接檢查是否有影片，然後呼叫 createPlayer，讓它處理初始化/重新連接 DOM 的邏輯。
            // const video = currentVideo.value;
            // if (video) {
            //     createPlayer(video.id, video.videoId); // 確保詳情頁的播放器已初始化或重新綁定
            // }
        });
    };

    const goBackToList = () => {
        if (currentVideo.value) {
            const player = loadedPlayers.get(currentVideo.value.id);
            if (player) player.pauseVideo();
        }
        handleRangeCancel();
        selectedMarkerType.value = null;
        selectedVideoId.value = null;
    };

    // --- 時間軸互動/標記相關 (原 methods) ---
    const setSelectedMarkerType = (type) => {
        if (selectedMarkerType.value === type) {
            selectedMarkerType.value = null;
            console.log(`標記模式已取消。`);
        } else {
            selectedMarkerType.value = type;
            console.log(`已選擇標記屬性: ${MARKER_TYPE_MAP[type].displayName}。現在拖曳即可新增標記。`);
        }
    };
    const handleRangeCancel = () => {
        rangeData.value.isSelecting = false;
        rangeData.value.selectionStart = 0;
        rangeData.value.selectionEnd = 0;
        rangeData.value.selectedDuration = 0;
        // 注意: 這裡不應該清除 selectedMarkerType，因為用戶可能想在單點擊失敗後重試
        // selectedMarkerType.value = null;
    };

    const promptForLabel = (videoId, start, end, type) => {
        const typeInfo = MARKER_TYPE_MAP[type];
        const defaultLabel = `${typeInfo.displayName} 於 ${formatTime(start)}`;
        const label = prompt(`請輸入標記內容 (類型: ${typeInfo.displayName}, 時間: ${formatTime(start)} ~ ${formatTime(end)}):`, defaultLabel);

        if (label && label.trim().length > 0) {
            addMarkerWithLabel(videoId, start, end, type, label.trim());
        } else if (label !== null) {
            // 注意: 這裡使用 alert()，雖然在 Canvas 環境中應盡量避免，但這裡是從您提供的原始碼複製過來的。
            // 建議將其替換為自定義的 modal/toast 通知。
            alert("標記內容不能為空，已取消新增。");
        } else {
            console.log("使用者取消新增標記。");
        }

        // 無論新增或取消，都清除選區和選中的類型
        handleRangeCancel();
        selectedMarkerType.value = null;
    };

    const addMarkerWithLabel = (videoId, start, end, type, label) => {
        const index = getVidoeIndex(videoId);
        if (index === -1) return;

        const newMarker = { start: start, end: end, label: label, type: type };

        const updatedLabels = [...videoList.value[index].timeLabels, newMarker].sort((a, b) => a.start - b.start);
        videoList.value[index].timeLabels = updatedLabels;

        ServerAPIManager_Full.saveData(videoList.value);
        console.log(`新增標記 (ID: ${videoId}): "${label}" [${type}] 在 ${start}~${end} 秒 (Server 儲存)`);
    };

    const handleRangeStart = (event) => {
        if (event.button !== 0 || event.target.closest('.timeline-range-marker')) return;

        const time = getTimelineTimeFromEvent(event, currentVideo.value.duration);

        rangeData.value.isSelecting = true;
        rangeData.value.selectionStart = time;
        rangeData.value.selectionEnd = time;
        rangeData.value.selectedDuration = 0;

        if (currentVideo.value && currentVideo.value.isPlaying) {
            const player = loadedPlayers.get(currentVideo.value.id);
            if (player) player.pauseVideo();
        }
    };

    const handleRangeMove = (event) => {
        if (!rangeData.value.isSelecting) return;
        if (!currentVideo.value) return;

        const time = getTimelineTimeFromEvent(event, currentVideo.value.duration);
        rangeData.value.selectionEnd = time;

        rangeData.value.selectedDuration = Math.abs(rangeData.value.selectionEnd - rangeData.value.selectionStart);

        currentVideo.value.currentTime = time;
        const player = loadedPlayers.get(currentVideo.value.id);
        if (player && typeof player.seekTo === 'function') {
            player.seekTo(time, false);
        }
    };

    const handleRangeEnd = () => {
        if (!rangeData.value.isSelecting) return;
        if (!currentVideo.value) return;

        const minTime = Math.min(rangeData.value.selectionStart, rangeData.value.selectionEnd);
        const maxTime = Math.max(rangeData.value.selectionStart, rangeData.value.selectionEnd);

        rangeData.value.selectionStart = minTime;
        rangeData.value.selectionEnd = maxTime;

        const videoId = currentVideo.value.id;

        if (rangeData.value.selectedDuration < 1) {
            // 情況 1: 單點點擊
            if (selectedMarkerType.value) {
                promptForLabel(videoId, minTime, minTime + 1, selectedMarkerType.value);
            } else {
                jumpToTime(videoId, minTime);
                handleRangeCancel(); // 跳轉後清空選區視覺化
            }
        } else {
            // 情況 2: 有效拖曳區間
            if (selectedMarkerType.value) {
                promptForLabel(videoId, minTime, maxTime, selectedMarkerType.value);
            } else {
                jumpToTime(videoId, minTime);
                handleRangeCancel(); // 跳轉後清空選區視覺化
            }
            // 如果成功新增標記，promptForLabel 會調用 handleRangeCancel
        }
        rangeData.value.isSelecting = false;
    };

    const handleClickTimeline = (event) => {
        // 如果是在進行拖曳 (rangeData.isSelecting 已經被 handleRangeEnd 設為 false)，則忽略
        // 這裡主要用於處理單點擊的場景 (在 handleRangeEnd 中處理)
        if (rangeData.value.selectedDuration < 1 && !rangeData.value.isSelecting) {
            const time = getTimelineTimeFromEvent(event, currentVideo.value.duration);

            if (selectedMarkerType.value) {
                // 如果有選中標記類型，則新增單點標記
                promptForLabel(currentVideo.value.id, time, time + 1, selectedMarkerType.value);
            } else {
                // 否則，執行跳轉
                jumpToTime(currentVideo.value.id, time);
            }
        }
    };

    // --- 視覺化計算 (原 methods) ---
    const calculateProgressBarWidth = (video) => {
        if (video.duration === 0) return '0%';
        const percentage = (video.currentTime / video.duration) * 100;
        return `${Math.min(percentage, 100)}%`;
    };
    const calculateMarkerPosition = (start, duration) => {
        if (duration === 0) return '0%';
        const position = (start / duration) * 100;
        return `${position}%`;
    };
    const calculateMarkerWidth = (start, end, duration) => {
        if (duration === 0) return '0%';
        const width = ((end - start) / duration) * 100;
        return `${width}%`;
    };

    // --- 生命周期 (原 mounted & beforeUnmount) ---
    const loadVideoData = async () => {
        isLoading.value = true;
        videoList.value = await ServerAPIManager_Full.loadData();
        isLoading.value = false;
    };

    onMounted(async () => {
        await loadVideoData();

        // **新增追蹤**
        console.log(`[Lifecycle] 數據已載入。`);

        const vm = { initAllPlayers };
        if (window.YT) {
            console.log(`[YT API] window.YT 已存在，立即初始化所有播放器。`);
            vm.initAllPlayers();
        } else {
            console.log(`[YT API] window.YT 不存在，設置 onYouTubeIframeAPIReady 監聽。`);
            window.onYouTubeIframeAPIReady = () => {
                console.log(`[YT API] onYouTubeIframeAPIReady 事件觸發！`);
                vm.initAllPlayers();
            };
        }
    });

    onBeforeUnmount(() => {
        videoList.value.forEach(video => {
            stopTimer(video.id);
            const player = loadedPlayers.get(video.id);
            if (player) {
                player.destroy();
            }
        });
    });

    // --- 導出 ---
    return {
        // 狀態
        selectedVideoId, videoList, isLoading, markerTypes,
        tapTempoData, rangeData, selectedMarkerType,

        // Computed
        currentVideo, selectionRangeStyle, groupedMarkers,

        // 核心方法
        selectVideo, goBackToList, togglePlay, jumpToTime,

        // 時間軸互動
        setSelectedMarkerType, handleRangeStart, handleRangeMove,
        handleRangeEnd, handleRangeCancel, handleClickTimeline,

        // BPM 
        handleTapTempo, saveBPM,

        // 視覺化/格式化工具
        formatTime, getMarkerColorHex, calculateProgressBarWidth,
        calculateMarkerPosition, calculateMarkerWidth,
    };
}