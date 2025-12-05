import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

// --- 常量定義 ---

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

// --- Server API (保持不變) ---
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

// --- 核心組合式函數 ---
export function usePlayer() {
    // --- 新增常數 ---
    const LOCAL_STORAGE_KEY = 'customMarkerTypes';
    // 顏色池，用於為新的標記類型分配顏色
    const COLOR_POOL = [
        '#0984e3', // blue
        '#fdcb6e', // yellow
        '#d63031', // red
        '#00b894', // green
        '#6c5ce7', // purple
        '#ff7675', // salmon
        '#2d3436', // dark grey
        '#e17055', // coral
    ];

    // --- 響應式狀態 (原 data) ---
    const selectedVideoId = ref(null);
    const videoList = ref([]);
    const isLoading = ref(true);

    /* eslint-disable-next-line no-unused-vars */
    const loadedPlayers = new Map(); // YT Players
    /* eslint-disable-next-line no-unused-vars */
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
    const markerTypes = ref({});

    // 標記類型狀態
    const selectedMarkerType = ref(null);

    // --- 輔助工具函數 (Utility Functions) ---
    function formatTime(seconds) {
        const sec = Math.floor(seconds);
        const min = Math.floor(sec / 60);
        const remainingSec = sec % 60;
        return `${min}:${remainingSec < 10 ? '0' : ''}${remainingSec}`;
    }

    /**
     * 統一從 MouseEvent 或 TouchEvent 中提取 clientX
     * @param {MouseEvent | TouchEvent} event
     * @returns {number}
     */
    function getClientX(event) {
        // 檢查是否有觸控點 (適用於 TouchEvent)
        if (event.touches && event.touches.length > 0) {
            return event.touches[0].clientX;
        }
        // 否則視為 MouseEvent
        return event.clientX;
    }

    /**
     * 從事件中計算出時間軸上的時間
     * @param {MouseEvent | TouchEvent} event
     * @param {number} videoDuration
     * @returns {number}
     */
    function getTimelineTimeFromEvent(event, videoDuration) {
        if (videoDuration === 0) return 0;

        const clientX = getClientX(event);

        const timeline = event.currentTarget;
        const rect = timeline.getBoundingClientRect();

        const clickX = clientX - rect.left;
        const width = rect.width;
        const percentage = Math.min(1, Math.max(0, clickX / width));

        return Math.floor(percentage * videoDuration);
    }

    function getMarkerColorHex(type) {
        if (!type) return '#b2bec3';

        const typeInfo = markerTypes.value[type.trim().toLowerCase()];
        return typeInfo ? typeInfo.hex : '#b2bec3';
    }

    // --- 自訂標記類型管理 ---

    function loadMarkerTypes() {
        try {
            const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (stored) {
                markerTypes.value = JSON.parse(stored);
                console.log('[MarkerTypes] 成功從 Local Storage 載入。', markerTypes.value);
            } else {
                // 初始化預設值
                markerTypes.value = {
                    'question': { hex: COLOR_POOL[0], displayName: '疑問' },
                    'summary': { hex: COLOR_POOL[1], displayName: '摘要' },
                    'action': { hex: COLOR_POOL[2], displayName: '行動' },
                    'reference': { hex: COLOR_POOL[3], displayName: '參考' },
                };
                saveMarkerTypes();
                console.log('[MarkerTypes] Local Storage 無數據，初始化預設標記。');
            }
        } catch (e) {
            console.error('[MarkerTypes] 載入 Local Storage 失敗:', e);
            markerTypes.value = {};
        }
    }

    function saveMarkerTypes() {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(markerTypes.value));
            console.log('[MarkerTypes] 已儲存到 Local Storage。');
        } catch (e) {
            console.error('[MarkerTypes] 儲存到 Local Storage 失敗:', e);
        }
    }

    function getOrCreateMarkerType(type) {
        const normalizedType = type.trim().toLowerCase();

        if (!normalizedType) {
            return '#b2bec3';
        }

        if (markerTypes.value[normalizedType]) {
            return markerTypes.value[normalizedType].hex;
        }

        const usedCount = Object.keys(markerTypes.value).length;
        const colorIndex = usedCount % COLOR_POOL.length;
        const newHex = COLOR_POOL[colorIndex];

        markerTypes.value[normalizedType] = {
            hex: newHex,
            displayName: type.trim(),
        };

        saveMarkerTypes();
        console.log(`[MarkerTypes] 新增自訂類型: ${normalizedType}, 顏色: ${newHex}`);

        return newHex;
    }

    /**
     * 處理來自 VideoDetail.vue 的新增標記類型請求 (對應 'create-new-marker-type' 事件)
     * @param {string} type 
     */
    function createNewMarkerType(type) {
        if (!type || type.trim() === '') {
            console.warn('[MarkerTypes] 嘗試新增空類型，操作取消。');
            return;
        }

        const normalizedType = type.trim().toLowerCase();

        // 確保類型存在並獲取其顏色（如果不存在則創建）
        getOrCreateMarkerType(type);

        // 創建後自動將其設為當前選中類型 (符合用戶輸入並新增/選中的預期行為)
        setSelectedMarkerType(normalizedType);

        console.log(`[MarkerTypes] 已新增並選中類型: ${type.trim()}`);
    }


    // --- Computed 屬性 ---
    const currentVideo = computed(() => {
        if (!selectedVideoId.value) return null;
        return videoList.value.find(v => v.id === selectedVideoId.value);
    });

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

        const typeKey = selectedMarkerType.value;
        const color = getMarkerColorHex(typeKey) || '#b2bec3';

        return {
            left: `${startPercent}%`,
            width: `${Math.min(endPercent - startPercent, 100)}%`,
            backgroundColor: `${color}40` // 40 代表 25% 透明度
        };
    });

    const groupedMarkers = computed(() => {
        if (!currentVideo.value) return {};

        const groups = {};
        const types = Object.keys(markerTypes.value);

        types.forEach(type => {
            groups[type] = {
                displayName: markerTypes.value[type].displayName,
                colorHex: markerTypes.value[type].hex,
                icon: markerTypes.value[type].displayName[0] || 'I',
                markers: []
            };
        });

        currentVideo.value.timeLabels.forEach(label => {
            const type = label.type.trim().toLowerCase();

            if (!groups[type]) {
                getOrCreateMarkerType(type);

                groups[type] = {
                    displayName: markerTypes.value[type].displayName,
                    colorHex: markerTypes.value[type].hex,
                    icon: markerTypes.value[type].displayName[0] || 'I',
                    markers: []
                };
            }

            if (typeof label.start === 'number' && typeof label.end === 'number') {
                groups[type].markers.push(label);
            }
        });

        const orderedGroups = {};
        Object.keys(groups)
            .sort((a, b) => a.localeCompare(b))
            .forEach(type => {
                if (groups[type].markers.length > 0) {
                    groups[type].markers.sort((a, b) => a.start - b.start);
                    orderedGroups[type] = groups[type];
                }
            });

        return orderedGroups;
    });

    // --- 核心方法 (YT 播放器控制) ---
    function getVidoeIndex(videoId) {
        return videoList.value.findIndex(v => v.id === videoId);
    }

    function updateTime(videoId) {
        const player = loadedPlayers.get(videoId);
        const index = getVidoeIndex(videoId);
        if (player && index !== -1 && typeof player.getCurrentTime === 'function') {
            videoList.value[index].currentTime = Math.floor(player.getCurrentTime());
        }
    }

    function stopTimer(videoId) {
        const id = intervalIds.get(videoId);
        if (id) {
            clearInterval(id);
            intervalIds.delete(videoId);
        }
    }

    function startTimer(videoId) {
        if (!intervalIds.has(videoId)) {
            const id = setInterval(() => updateTime(videoId), 500);
            intervalIds.set(videoId, id);
        }
    }

    function onPlayerStateChangeWithId(event, videoId) {
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
    }

    function onPlayerReadyWithId(event, videoId) {
        const index = getVidoeIndex(videoId);
        if (index === -1) return;

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
    }

    function createPlayer(videoId, ytVideoId) {
        const domId = `player-preview-${videoId}`;
        const playerDom = document.getElementById(domId);

        if (loadedPlayers.has(videoId)) {
            return;
        }

        if (playerDom) {
            console.log(`➡️ [Create Player] 嘗試初始化 ID: ${videoId}, YT ID: ${ytVideoId} 到 DOM: ${domId}`);
            const player = new window.YT.Player(domId, {
                videoId: ytVideoId,
                playerVars: {
                    controls: 1,
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
    }

    function initAllPlayers() {
        videoList.value.forEach(video => {
            createPlayer(video.id, video.videoId);
        });
    }

    // --- BPM 相關 ---
    function calculateBPM(times) {
        if (times.length < 3) return;
        let intervals = [];
        for (let i = 1; i < times.length; i++) {
            intervals.push(times[i] - times[i - 1]);
        }
        const sumIntervals = intervals.reduce((a, b) => a + b, 0);
        const averageInterval = sumIntervals / intervals.length;
        const calculatedBPM = 60000 / averageInterval;
        tapTempoData.value.displayBPM = calculatedBPM.toFixed(1);
    }

    function resetTapTempo() {
        tapTempoData.value.tapTimes = [];
        tapTempoData.value.displayBPM = null;
        console.log("Tap Tempo 已重設。");
    }

    function handleTapTempo() {
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
    }

    function saveBPM() {
        if (!currentVideo.value || !tapTempoData.value.displayBPM) return;

        const newBPM = Math.round(parseFloat(tapTempoData.value.displayBPM));

        const videoIndex = getVidoeIndex(currentVideo.value.id);
        if (videoIndex !== -1) {
            videoList.value[videoIndex].bpm = newBPM;
            ServerAPIManager_Full.saveData(videoList.value);
            console.log(`影片 ID ${currentVideo.value.id} 的 BPM 已儲存為 ${newBPM} (Server 儲存)`);
        }
        resetTapTempo();
    }

    // --- 播放器/導航控制 ---
    function togglePlay(videoId) {
        const player = loadedPlayers.get(videoId);

        if (!player || typeof player.getPlayerState !== 'function') {
            console.warn(`[togglePlay] 影片 ID ${videoId} 的播放器尚未準備就緒。`);
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
                    if (otherPlayer && typeof otherPlayer.pauseVideo === 'function') {
                        otherPlayer.pauseVideo();
                    }
                }
            });
            player.playVideo();
        }
    }

    function jumpToTime(videoId, time) {
        const player = loadedPlayers.get(videoId);
        const index = getVidoeIndex(videoId);

        if (player && index !== -1 && typeof player.seekTo === 'function') {
            player.seekTo(time, true);
            videoList.value[index].currentTime = time;

            if (typeof player.getPlayerState === 'function' && player.getPlayerState() !== window.YT.PlayerState.PLAYING) {
                togglePlay(videoId);
            }
        } else {
            console.warn(`[jumpToTime] 影片 ID ${videoId} 的播放器尚未準備好 (seekTo 不可用)。`);
        }
    }

    function selectVideo(videoId) {
        videoList.value.forEach(v => {
            if (v.id !== videoId && v.isPlaying) {
                const otherPlayer = loadedPlayers.get(v.id);
                if (otherPlayer) otherPlayer.pauseVideo();
            }
        });
        resetTapTempo();
        selectedVideoId.value = videoId;
        selectedMarkerType.value = null;
    }

    function goBackToList() {
        if (currentVideo.value) {
            const player = loadedPlayers.get(currentVideo.value.id);
            if (player) player.pauseVideo();
        }
        handleRangeCancel();
        selectedMarkerType.value = null;
        selectedVideoId.value = null;
    }

    // --- 時間軸互動/標記相關 ---
    function setSelectedMarkerType(type) {
        if (selectedMarkerType.value === type) {
            selectedMarkerType.value = null;
            console.log(`標記模式已取消。`);
        } else {
            selectedMarkerType.value = type;
            const displayName = markerTypes.value[type] ? markerTypes.value[type].displayName : type;
            console.log(`已選擇標記屬性: ${displayName}。現在拖曳即可新增標記。`);
        }
    }

    function handleRangeCancel() {
        rangeData.value.isSelecting = false;
        rangeData.value.selectionStart = 0;
        rangeData.value.selectionEnd = 0;
        rangeData.value.selectedDuration = 0;
    }

    function promptForLabel(videoId, start, end, type) {
        getOrCreateMarkerType(type);
        const typeInfo = markerTypes.value[type];

        const defaultLabel = `${typeInfo.displayName} 於 ${formatTime(start)}`;

        const newTypeLabel = prompt(`請輸入標記內容 (類型: ${typeInfo.displayName}, 時間: ${formatTime(start)} ~ ${formatTime(end)}):`, defaultLabel);

        if (newTypeLabel && newTypeLabel.trim().length > 0) {
            addMarkerWithLabel(videoId, start, end, type, newTypeLabel.trim());
        } else if (newTypeLabel !== null) {
            alert("標記內容不能為空，已取消新增。");
        } else {
            console.log("使用者取消新增標記。");
        }

        handleRangeCancel();
        selectedMarkerType.value = null;
    }

    function addMarkerWithLabel(videoId, start, end, type, label) {
        const index = getVidoeIndex(videoId);
        if (index === -1) return;

        const finalType = type.trim().toLowerCase();

        const newMarker = { start: start, end: end, label: label, type: finalType };

        const updatedLabels = [...videoList.value[index].timeLabels, newMarker].sort((a, b) => a.start - b.start);
        videoList.value[index].timeLabels = updatedLabels;

        ServerAPIManager_Full.saveData(videoList.value);
        console.log(`新增標記 (ID: ${videoId}): "${label}" [${finalType}] 在 ${start}~${end} 秒 (Server 儲存)`);
    }

    function handleRangeStart(event) {
        // 確保點擊不是發生在已有的標記上
        if (event.target.closest('.timeline-range-marker')) return;

        // 排除非左鍵的滑鼠事件 (觸控事件沒有 event.button，所以不會被排除)
        if (event.button !== undefined && event.button !== 0) return;

        const time = getTimelineTimeFromEvent(event, currentVideo.value.duration);

        rangeData.value.isSelecting = true;
        rangeData.value.selectionStart = time;
        rangeData.value.selectionEnd = time;
        rangeData.value.selectedDuration = 0;

        if (currentVideo.value && currentVideo.value.isPlaying) {
            const player = loadedPlayers.get(currentVideo.value.id);
            if (player) player.pauseVideo();
        }
    }

    function handleRangeMove(event) {
        if (!rangeData.value.isSelecting) return;
        if (!currentVideo.value) return;

        // 避免在拖曳中途釋放滑鼠鍵/手指時觸發不必要的移動 (僅適用於滑鼠)
        if (event.buttons !== undefined && event.buttons === 0 && !event.touches) return;

        const time = getTimelineTimeFromEvent(event, currentVideo.value.duration);
        rangeData.value.selectionEnd = time;

        rangeData.value.selectedDuration = Math.abs(rangeData.value.selectionEnd - rangeData.value.selectionStart);

        currentVideo.value.currentTime = time;
        const player = loadedPlayers.get(currentVideo.value.id);
        if (player && typeof player.seekTo === 'function') {
            // 使用 false 進行快速定位，不中斷播放
            player.seekTo(time, false);
        }
    }

    function handleRangeEnd() {
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
                handleRangeCancel();
            }
        } else {
            // 情況 2: 有效拖曳區間
            if (selectedMarkerType.value) {
                promptForLabel(videoId, minTime, maxTime, selectedMarkerType.value);
            } else {
                jumpToTime(videoId, minTime);
                handleRangeCancel();
            }
        }
        rangeData.value.isSelecting = false;
    }

    function handleClickTimeline(event) {
        if (rangeData.value.selectedDuration < 1 && !rangeData.value.isSelecting) {
            const time = getTimelineTimeFromEvent(event, currentVideo.value.duration);

            if (selectedMarkerType.value) {
                promptForLabel(currentVideo.value.id, time, time + 1, selectedMarkerType.value);
            } else {
                jumpToTime(currentVideo.value.id, time);
            }
        }
    }

    // --- 視覺化計算 ---
    function calculateProgressBarWidth(video) {
        if (video.duration === 0) return '0%';
        const percentage = (video.currentTime / video.duration) * 100;
        return `${Math.min(percentage, 100)}%`;
    }

    function calculateMarkerPosition(start, duration) {
        if (duration === 0) return '0%';
        const position = (start / duration) * 100;
        return `${position}%`;
    }

    function calculateMarkerWidth(start, end, duration) {
        if (duration === 0) return '0%';
        const width = ((end - start) / duration) * 100;
        return `${width}%`;
    }

    // --- 生命周期 ---
    const loadVideoData = async () => {
        isLoading.value = true;
        videoList.value = await ServerAPIManager_Full.loadData();
        isLoading.value = false;
    };

    onMounted(async () => {
        loadMarkerTypes();
        await loadVideoData();

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
        selectedVideoId, videoList, isLoading,
        tapTempoData, rangeData, selectedMarkerType,
        markerTypes,

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

        // 標記類型管理
        getOrCreateMarkerType,
        createNewMarkerType,
    };
}