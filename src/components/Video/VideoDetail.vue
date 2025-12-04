<script setup>
// [ESLint Fix]: 告訴 ESLint 這是 Vue 3 的 <script setup> 環境，
// defineProps 和 defineEmits 是可用的全局宏，從而解決 'no-undef' 錯誤。
/* eslint-disable no-undef */

// 移除 import { computed } from 'vue'; 因為 videoPlayerId 可以直接定義為 computed 屬性
import { computed } from 'vue';

// 定義 Props
const props = defineProps({
  currentVideo: Object,
  markerTypes: Object,
  selectedMarkerType: String,
  rangeData: Object,
  selectionRangeStyle: Object,
  groupedMarkers: Object,
  tapTempoData: Object,
  
  // 視覺化工具函數 (從 usePlayer 傳入)
  formatTime: { type: Function, required: true },
  getMarkerColorHex: { type: Function, required: true },
  calculateProgressBarWidth: { type: Function, required: true },
  calculateMarkerPosition: { type: Function, required: true },
  calculateMarkerWidth: { type: Function, required: true },
});

// 定義 Emits
const emit = defineEmits([
  'go-back-to-list',
  'toggle-play',
  'set-marker-type',
  'handle-range-start',
  'handle-range-move',
  'handle-range-end',
  'handle-range-cancel',
  'handle-click-timeline',
  'handle-tap-tempo',
  'save-bpm',
  'jump-to-time',
]);

// 這裡使用 computed 是正確的，因為 currentVideo.id 可能是響應式的
// 如果 currentVideo 改變，videoPlayerId 也會隨之改變。
const videoPlayerId = computed(() => `player-preview-${props.currentVideo.id}`);

// 為了讓 @click.stop.prevent="handleClickTimeline" 正常工作，
// 我們需要一個方法來觸發 emit，而不是直接在模板中嵌入複雜的邏輯。
// 這裡將點擊時間軸的邏輯封裝起來。
const handleClickTimeline = (event) => {
    // 只有在沒有選中標記類型 (即不處於標記模式) 時才跳轉
    if (!props.selectedMarkerType) {
        emit('handle-click-timeline', event);
    }
    // 如果處於標記模式，點擊行為會被 mousedown/mousemove/mouseup 覆蓋
};

</script>

<template>
  <div v-if="currentVideo" class="max-w-4xl mx-auto p-4 md:p-8">
    <div class="flex items-center justify-between mb-6 border-b pb-4">
      <button 
        @click="emit('go-back-to-list')" 
        class="back-btn flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white shadow-md"
      >
        <span>&larr;</span> 返回清單
      </button>

      <h2 class="text-2xl font-bold truncate flex-1 text-center mx-4 text-gray-800">{{ currentVideo.name }}</h2>

      <button 
        @click="emit('toggle-play')" 
        class="play-pause-btn"
        :class="currentVideo.isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'"
      >
        {{ currentVideo.isPlaying ? '❚❚ 暫停' : '▶ 播放' }}
      </button>
    </div>

    <!-- 影片播放器容器 -->
    <div class="aspect-video bg-black rounded-xl shadow-2xl overflow-hidden mb-6">
      <!-- 這是 YouTube Iframe API 載入播放器的 DOM 節點 -->
      <div :id="videoPlayerId" class="w-full h-full"></div>
    </div>

    <!-- 時間軸與控制項 -->
    <div class="bg-white p-5 rounded-xl shadow-lg mb-8">
      <!-- 時間顯示 -->
      <div class="flex justify-between text-sm font-mono mb-3 text-gray-700 font-semibold">
        <span>{{ formatTime(currentVideo.currentTime) }}</span>
        <span>{{ formatTime(currentVideo.duration) }}</span>
      </div>

      <!-- 時間軸 -->
      <div 
        class="timeline-bar relative h-4 rounded-full cursor-pointer"
        @mousedown.prevent="emit('handle-range-start', $event)"
        @mousemove.prevent="emit('handle-range-move', $event)"
        @mouseup.prevent="emit('handle-range-end')"
        @mouseleave.prevent="rangeData.isSelecting ? emit('handle-range-cancel') : null"
        @click.stop.prevent="handleClickTimeline"
      >
        <!-- 緩衝/進度條 -->
        <div 
          class="absolute top-0 left-0 h-full bg-blue-500/50 rounded-full" 
          :style="{ width: calculateProgressBarWidth(currentVideo) }"
        ></div>

        <!-- 拖曳選取範圍 -->
        <div 
          v-show="rangeData.selectedDuration > 0 || rangeData.isSelecting"
          class="selection-range rounded-full"
          :style="selectionRangeStyle"
        ></div>
        
        <!-- 標記區間 -->
        <button
          v-for="(marker, idx) in currentVideo.timeLabels"
          :key="idx"
          class="timeline-range-marker text-white text-xs font-bold flex items-center justify-center"
          :style="{
            left: calculateMarkerPosition(marker.start, currentVideo.duration),
            width: calculateMarkerWidth(marker.start, marker.end, currentVideo.duration),
            backgroundColor: getMarkerColorHex(marker.type),
            opacity: 0.9,
            color: ['question', 'reference'].includes(marker.type) ? '#333' : 'white', // 淺色背景使用深色文字
          }"
          :title="`${marker.label} (${formatTime(marker.start)} - ${formatTime(marker.end)})`"
          @click.stop="emit('jump-to-time', currentVideo.id, marker.start)"
        >
          <!-- 只有區間夠長才顯示標籤 -->
          <span v-if="(marker.end - marker.start) > 2.5" class="truncate max-w-full px-1">{{ marker.label }}</span>
        </button>

        <!-- 播放頭標記 -->
        <div 
          class="current-time-marker" 
          :style="{ left: calculateProgressBarWidth(currentVideo) }"
        ></div>
      </div>
    </div>

    <!-- 標記與 BPM 區塊 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- 標記類型選擇 -->
      <div class="col-span-1 bg-white p-5 rounded-xl shadow-lg">
        <h3 class="text-xl font-bold mb-4 text-indigo-700 flex items-center gap-2">🏷️ 標記類型</h3>
        <p class="text-sm text-gray-600 mb-4">選中類型後，在時間軸上**拖曳**即可建立標記區間。</p>
        <div class="flex flex-wrap gap-3">
          <button 
            v-for="(type, key) in markerTypes" 
            :key="key"
            @click="emit('set-marker-type', key)"
            class="type-btn"
            :class="{ 
              'ring-4 ring-offset-2 ring-indigo-500/70': selectedMarkerType === key 
            }"
            :style="{ backgroundColor: type.hex, borderColor: type.hex }"
          >
            {{ type.displayName.split(' ')[0] }}
          </button>
        </div>
        
        <div 
          v-if="selectedMarkerType" 
          class="marking-status-display text-sm font-medium mt-4"
          :style="{ borderColor: getMarkerColorHex(selectedMarkerType), color: getMarkerColorHex(selectedMarkerType) }"
        >
          <span class="font-bold">✓ 標記模式啟用:</span> {{ markerTypes[selectedMarkerType].displayName }}
          <span v-if="rangeData.selectedDuration > 0"> (時長: {{ formatTime(rangeData.selectedDuration) }})</span>
        </div>
        <div v-else class="marking-status-display text-gray-500 border-gray-300">
          未選中標記類型。點擊時間軸會直接跳轉。
        </div>
      </div>
    </div>

    <!-- 已儲存標記清單 -->
    <div class="mt-8 bg-white p-5 rounded-xl shadow-lg">
      <h3 class="text-2xl font-bold mb-5 text-gray-800">📋 已儲存標記清單</h3>
      
      <div v-if="currentVideo.timeLabels.length === 0" class="text-gray-500 p-6 border-4 border-dashed border-gray-200 rounded-xl text-center text-lg">
        此影片尚未有任何標記。
      </div>

      <div v-for="(group, type) in groupedMarkers" :key="type" class="mb-8 last:mb-0">
        <h4 class="text-xl font-bold mb-4 border-b-4 pb-2 flex items-center gap-2" :style="{ borderColor: group.colorHex, color: group.colorHex }">
            <span class="text-3xl">{{ group.icon || 'ℹ️' }}</span>
            {{ group.displayName }} ({{ group.markers.length }})
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button 
            v-for="marker in group.markers"
            :key="marker.start"
            class="marker-jump-btn text-left flex flex-col transition duration-150 ease-in-out"
            :style="{ backgroundColor: `${group.colorHex}20`, borderLeft: `5px solid ${group.colorHex}` }"
            @click="emit('jump-to-time', currentVideo.id, marker.start)"
          >
            <div class="flex items-center mb-1">
              <span class="time-stamp font-mono text-xs" :style="{ color: getMarkerColorHex(marker.type) }">
                {{ formatTime(marker.start) }} - {{ formatTime(marker.end) }}
              </span>
            </div>
            <p class="text-gray-800 text-base font-medium truncate">{{ marker.label }}</p>
          </button>
        </div>
      </div>
    </div>
    <!-- 節奏速度偵測 (BPM) -->
      <div class="col-span-1 bg-white p-5 rounded-xl shadow-lg tap-tempo-section" tabindex="0">
        <h3 class="text-xl font-bold mb-4 text-red-600 flex items-center gap-2">🎶 節奏速度 (BPM)</h3>
        <p class="text-sm text-gray-600 mb-3">使用鍵盤 **[Space]** 或滑鼠點擊 Tap 鍵偵測節奏。</p>
        
        <div class="flex items-center gap-4">
            <button 
                @click="emit('handle-tap-tempo')"
                @keydown.space.prevent="emit('handle-tap-tempo')"
                class="tap-button text-2xl font-extrabold rounded-2xl w-24 h-24 flex flex-col items-center justify-center bg-yellow-400 text-yellow-900"
            >
                TAP
            </button>
            <div class="flex-1">
                <div class="text-5xl font-mono font-extrabold text-red-700">
                    {{ tapTempoData.displayBPM ? parseFloat(tapTempoData.displayBPM).toFixed(0) : (currentVideo.bpm || '—') }}
                </div>
                <div class="text-xl font-bold text-red-700 mb-1">BPM</div>
                <p class="tap-display-info text-gray-500">
                    {{ tapTempoData.displayBPM ? `間隔: ${(60000 / parseFloat(tapTempoData.displayBPM)).toFixed(0)} ms` : (currentVideo.bpm ? `已儲存 BPM: ${currentVideo.bpm}` : '開始敲擊偵測') }}
                </p>
            </div>
        </div>

        <button 
            @click="emit('save-bpm')"
            :disabled="!tapTempoData.displayBPM"
            class="save-bpm-btn mt-4 w-full py-2.5 rounded-lg font-semibold transition-colors shadow-md"
            :class="tapTempoData.displayBPM ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-300 text-gray-600 cursor-not-allowed'"
        >
            儲存 BPM {{ tapTempoData.displayBPM ? `(${parseFloat(tapTempoData.displayBPM).toFixed(0)} BPM)` : '' }}
        </button>
      </div>
    <!-- 影片資訊與控制 -->
      <div class="col-span-1 bg-white p-5 rounded-xl shadow-lg">
        <h3 class="text-xl font-bold mb-4 text-gray-700 flex items-center gap-2">⚙️ 資訊與操作</h3>
        <p class="text-sm mb-2 p-2 bg-gray-50 rounded"><span class="font-medium text-gray-600">ID:</span> <span class="font-mono text-gray-800 break-all">{{ currentVideo.videoId }}</span></p>
        <p class="text-sm mb-2 p-2 bg-gray-50 rounded"><span class="font-medium text-gray-600">狀態:</span> <span :class="currentVideo.isPlaying ? 'text-green-600 font-bold' : 'text-red-500'">{{ currentVideo.isPlaying ? '播放中' : '已暫停' }}</span></p>
        <p class="text-sm mb-2 p-2 bg-gray-50 rounded"><span class="font-medium text-gray-600">總標記數:</span> <span class="font-bold text-indigo-600">{{ currentVideo.timeLabels.length }}</span></p>

        <button 
            @click="emit('handle-range-cancel')" 
            class="mt-4 w-full py-2.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-semibold shadow-sm"
        >
            清除選取範圍與標記模式
        </button>
      </div>
  </div>
</template>

<style scoped>
/* =========================================== */
/* ## 🎥 單一影片詳細模式 (Detail View) 相關 */
/* =========================================== */

/* 返回按鈕 & 播放/暫停按鈕的基礎樣式 */
.back-btn, .play-pause-btn {
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: 9999px; /* 圓角 */
    cursor: pointer;
    transition: all 0.2s;
    font-size: 1rem;
    font-weight: 600;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* 標記狀態顯示 */
.marking-status-display {
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    margin-top: 1rem;
    border: 2px dashed currentColor;
    background-color: white;
}


/* =========================================== */
/* ## ⏱️ 時間軸互動區 (Timeline Bar) */
/* =========================================== */
.timeline-bar {
    position: relative;
    overflow: hidden;
    z-index: 50;
    height: 1rem; /* 匹配 h-4 (16px) */
    /* 📌 實現要求 2: 設置明顯的底色 */
    background-color: #e5e7eb; /* tailwind's gray-200, 作為時間軸的完整底色 */
    border: 1px solid #d1d5db; /* 輕微邊框，使其更清晰 */
}

/* 播放頭 */
.current-time-marker {
    position: absolute;
    top: -4px; /* 稍微超出邊界，增加可見度 */
    bottom: -4px;
    width: 0.35rem; 
    background-color: #ef4444; /* red-500 */
    border-radius: 9999px;
    z-index: 60;  
    transform: translateX(-50%);
    pointer-events: none;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.5);
}

/* 標記選區的視覺化 */
.selection-range {
    height: 100%;
    position: absolute;
    top: 0;
    pointer-events: none;
    z-index: 20;
    opacity: 0.5;
}

/* 時間軸上的標記區間 */
.timeline-range-marker {
    position: absolute;
    top: 0;
    height: 100%;
    pointer-events: auto;
    cursor: pointer;
    z-index: 40;
    transition: opacity 0.2s, transform 0.1s;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
}
.timeline-range-marker:hover {
    opacity: 1;
    transform: scaleY(1.1); /* 懸停時略微放大 */
    z-index: 55;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
}

.timeline-range-marker span {
    display: block;
    padding: 0 0.5rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* 讓文字在時間軸內居中 */
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 0;
    right: 0;
    text-align: center;
    line-height: 1;
}

/* 標記類型選擇按鈕 */
.type-btn {
    padding: 0.6rem 1.2rem;
    border: 2px solid transparent;
    border-radius: 9999px; 
    color: white;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    opacity: 0.9;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    color: white !important; /* 強制按鈕文字為白色，提高可讀性 */
}
.type-btn.ring-4 {
    border-color: white; /* 讓邊框顏色更突出 */
    transform: scale(1.05);
    opacity: 1;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
}

/* =========================================== */
/* ## 🎶 節奏速度偵測 (Tap Tempo) */
/* =========================================== */
.tap-button:active {
    transform: translateY(1px) scale(0.98);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

/* =========================================== */
/* ## 📂 已儲存標記列表 (Full Markers List) */
/* =========================================== */
.marker-jump-btn {
    padding: 1rem;
    border-radius: 0.75rem;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.marker-jump-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
}
.time-stamp {
    font-weight: 700;
    background-color: rgba(255, 255, 255, 0.8);
    border: 1px solid currentColor;
}
</style>