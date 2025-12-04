<script setup>
import { usePlayer } from '@/composables/usePlayer';
import VideoList from '@/components/Video/VideoList.vue';
import VideoDetail from '@/components/Video/VideoDetail.vue';

// 使用組合式函數，解構出所有狀態和方法
const {
  // 狀態
  videoList, isLoading, selectedVideoId, markerTypes,
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
} = usePlayer();
</script>

<template>
  <div class="video-timeline-manager">
    <h1 class="text-3xl font-bold mb-6 text-gray-800">🎯 YouTube 時間軸標記工具 (Vue 3 / Composition API)</h1>

    <div v-if="isLoading" class="p-4 bg-yellow-100 text-yellow-700 rounded-lg">
      載入中... 請確認 Node.js 伺服器是否運行在 port 3000。
    </div>

    <div 
        v-for="video in videoList" 
        :key="video.id" 
        :id="`player-preview-${video.id}`" 
        class="hidden-player-container"
    >
      </div>


    <VideoList
      v-if="!selectedVideoId"
      :videoList="videoList"
      :formatTime="formatTime"
      :getMarkerColorHex="getMarkerColorHex"
      @select-video="selectVideo"
      @jump-to-time="jumpToTime"
    />

    <div v-else class="video-detail-container">
      <VideoDetail
        :currentVideo="currentVideo"
        :markerTypes="markerTypes"
        :selectedMarkerType="selectedMarkerType"
        :rangeData="rangeData"
        :selectionRangeStyle="selectionRangeStyle"
        :groupedMarkers="groupedMarkers"
        :tapTempoData="tapTempoData"
        
        :formatTime="formatTime"
        :getMarkerColorHex="getMarkerColorHex"
        :calculateProgressBarWidth="calculateProgressBarWidth"
        :calculateMarkerPosition="calculateMarkerPosition"
        :calculateMarkerWidth="calculateMarkerWidth"
        
        @go-back-to-list="goBackToList"
        @toggle-play="togglePlay(currentVideo.id)"
        @set-marker-type="setSelectedMarkerType"
        @handle-range-start="handleRangeStart"
        @handle-range-move="handleRangeMove"
        @handle-range-end="handleRangeEnd"
        @handle-range-cancel="handleRangeCancel"
        @handle-click-timeline="handleClickTimeline"
        @handle-tap-tempo="handleTapTempo"
        @save-bpm="saveBPM"
        @jump-to-time="jumpToTime"
      />
    </div>
  </div>
</template>

<style scoped>
/* =========================================== */
/* ## 💡 全局設定與容器 (Global) */
/* =========================================== */
.video-timeline-manager {
    padding: 1.5rem;
    max-width: 90rem; /* 匹配 max-w-7xl */
    margin: 0 auto;
    font-family: 'Arial', sans-serif;
    position: relative;
    min-height: 100vh;
}
/* 隱藏播放器的容器 (用於 v-for 預載) */
.hidden-player-container {
    /* 必須使用 !important 確保絕對隱藏，不影響佈局 */
    display: none !important;
    visibility: hidden !important;
    width: 0 !important;
    height: 0 !important;
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* =========================================== */
/* ## 🎥 單一影片詳細模式 (Detail View) 基礎容器 */
/* =========================================== */
.video-detail-container {
    background-color: #f7f7ff; /* 調整為更柔和的背景色 */
    padding: 1.5rem; /* 匹配 p-6 */
    border-radius: 1rem; /* 匹配 rounded-xl */
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); /* 匹配 shadow-2xl */
    border: 2px solid #a29bfe;
}
</style>