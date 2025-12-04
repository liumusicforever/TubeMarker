<script setup>
// [ESLint Fix]: 告訴 ESLint 這是 Vue 3 的 <script setup> 環境，
// defineProps 和 defineEmits 是可用的全局宏，從而解決 'no-undef' 錯誤。
/* eslint-disable no-undef */

// 從主容器透過 Props 傳遞進來
// eslint-disable-next-line no-unused-vars
const props = defineProps({
  videoList: {
    type: Array,
    required: true,
  },
  formatTime: {
    type: Function,
    required: true,
  },
  getMarkerColorHex: {
    type: Function,
    required: true,
  }
});

const emit = defineEmits(['select-video', 'jump-to-time']);

// 篩選出標記點多於 N 個的影片
const limitedMarkers = (labels, limit = 3) => {
    // 確保 labels 是陣列且非空
    if (!Array.isArray(labels)) return [];
    return labels.slice(0, limit);
};

const hasMoreMarkers = (labels, limit = 3) => {
    if (!Array.isArray(labels)) return false;
    return labels.length > limit;
};
</script>

<template>
  <div class="video-list-container max-w-4xl mx-auto p-4 md:p-8">
    <h1 class="text-3xl font-bold mb-6 text-gray-800 border-b-2 pb-2">🎥 影片與標記清單</h1>

    <!-- 清單頭部 -->
    <!-- 針對手機調整欄位分佈：隱藏 BPM 和部分標記預覽 -->
    <div class="grid grid-cols-12 gap-2 md:gap-4 list-header">
      <div class="col-span-6 md:col-span-4 text-left">影片名稱</div>
      <div class="hidden md:block md:col-span-2 text-center">時長</div>
      <div class="hidden lg:block lg:col-span-1 text-center">BPM</div>
      <div class="col-span-6 md:col-span-5 text-right md:text-left">標記預覽 (點擊跳轉)</div>
    </div>
    
    <!-- 清單項目 -->
    <div v-if="videoList && videoList.length > 0">
      <div 
        v-for="video in videoList" 
        :key="video.id" 
        class="grid grid-cols-12 gap-2 md:gap-4 list-item"
        @click="emit('select-video', video.id)"
      >
        <!-- 影片名稱與狀態 -->
        <div class="col-span-6 md:col-span-4 flex flex-col justify-center">
          <span class="font-bold text-base md:text-lg text-gray-800 truncate">{{ video.name }}</span>
          <span v-if="video.isPlaying" class="text-green-600 text-xs font-semibold mt-0.5">▶ 播放中...</span>
        </div>

        <!-- 時長 (僅在中等螢幕以上顯示) -->
        <div class="hidden md:flex md:col-span-2 items-center justify-center text-gray-600 font-mono text-sm">
          {{ formatTime(video.duration) }}
        </div>

        <!-- BPM (僅在大型螢幕以上顯示) -->
        <div class="hidden lg:flex lg:col-span-1 items-center justify-center text-gray-700 font-mono font-bold text-sm">
          {{ video.bpm || '—' }}
        </div>

        <!-- 標記預覽 -->
        <div class="col-span-6 md:col-span-5 flex items-center justify-end md:justify-start gap-2 flex-wrap">
          <template v-if="video.timeLabels && video.timeLabels.length > 0">
            <button
              v-for="(marker, idx) in limitedMarkers(video.timeLabels)"
              :key="idx"
              class="preview-marker-btn text-xs font-semibold shadow-sm"
              :style="{ 
                backgroundColor: getMarkerColorHex(marker.type), 
                borderColor: getMarkerColorHex(marker.type),
                color: ['question', 'reference'].includes(marker.type) ? '#333' : 'white' /* 根據顏色調整文字顏色 */
              }"
              @click.stop="emit('jump-to-time', video.id, marker.start)"
              :title="`${marker.label} (${formatTime(marker.start)} - ${formatTime(marker.end)})`"
            >
              {{ formatTime(marker.start) }}
            </button>
            <span v-if="hasMoreMarkers(video.timeLabels)" class="more-indicator text-indigo-500 font-semibold">+{{ video.timeLabels.length - 3 }} 更多</span>
          </template>
          <span v-else class="no-markers-list text-gray-400 text-sm">無標記</span>
        </div>
      </div>
    </div>
    <div v-else class="p-6 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
        目前沒有影片資料。
    </div>
  </div>
</template>

<style scoped>
/* =========================================== */
/* ## 📑 影片清單模式 (List View) */
/* =========================================== */
.video-list-container {
    display: flex;
    flex-direction: column;
}

/* 清單頭部樣式 */
.list-header {
    font-weight: bold;
    background-color: #f3f4f6; /* 淺灰色背景 */
    color: #4b5563; /* 深灰色文字 */
    padding: 0.75rem 1rem;
    border-radius: 0.5rem 0.5rem 0 0;
    font-size: 0.9rem;
    border-bottom: 2px solid #e5e7eb;
}

/* 清單項目樣式 */
.list-item {
    background-color: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    transition: all 0.2s;
    padding: 1rem;
    border-radius: 0.75rem; /* 增加圓角 */
    cursor: pointer;
    margin-bottom: 0.5rem;
}
.list-item:hover {
    background-color: #eff6ff; /* hover:bg-blue-50 */
    border-color: #6366f1; /* 主題藍色 */
    box-shadow: 0 6px 15px rgba(99, 102, 241, 0.1);
    transform: translateY(-2px);
}

/* 標記預覽按鈕樣式 */
.preview-marker-btn {
    padding: 0.3rem 0.6rem;
    border: 1px solid currentColor;
    border-radius: 9999px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.1s;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
}
.preview-marker-btn:hover {
    opacity: 0.8;
    transform: scale(1.05);
}

.more-indicator {
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
    border-radius: 9999px;
    background-color: #e0e7ff; /* 淺藍色背景 */
}

/* 針對小螢幕進行優化 */
@media (max-width: 768px) {
    .list-header, .list-item {
        padding: 0.75rem;
    }
    .list-item:hover {
        transform: none; /* 小螢幕取消hover效果 */
    }
    .list-header .col-span-4, .list-item .col-span-4 {
        /* 將影片名稱佔比略微調小，給標記預留空間 */
        flex-grow: 1;
    }
    .list-item .text-lg {
        font-size: 1rem;
    }
}
</style>