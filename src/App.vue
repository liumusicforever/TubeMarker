<script setup>
// 修正：現在 App.vue 只需要導入並渲染 VideoManager，
// 所有播放器邏輯和組件都已包含在 VideoManager 及其子組件中。
import VideoManager from './views/VideoManager.vue';
</script>

<template>
  <div id="app" class="min-h-screen bg-gray-100">
    <!-- 移除舊的 h1 和 YouTubePlayer，直接渲染主應用程式容器 -->
    <VideoManager />
  </div>
</template>

<style>
/*
保留了您提供的基礎樣式，並增加了全局的背景色和最小高度。
*/
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 移除 text-align: center; 讓 VideoManager 自己的佈局來控制內容 */
  color: #2c3e50;
  /* 移除 margin-top: 30px; 讓 VideoManager 內建的 padding 控制間距 */
  margin: 0;
  padding: 0;
}

/* 確保整個頁面從頂部開始 */
body {
  margin: 0;
  padding: 0;
}
</style>