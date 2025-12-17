import React, { useRef, useEffect, useState } from 'react';
import { isYouTubeUrl, getYouTubeId } from '../utils';

interface VideoPlayerProps {
  url: string;
  playing: boolean;
  onProgress: (currentTime: number) => void;
  onDuration: (duration: number) => void;
  onEnded: () => void;
  seekTo: number | null;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  url, 
  playing, 
  onProgress, 
  onDuration, 
  onEnded,
  seekTo 
}) => {
  const isYT = isYouTubeUrl(url);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null); // YouTube Player Instance
  const progressInterval = useRef<number | null>(null);

  // --- HTML5 Video Logic ---
  useEffect(() => {
    if (isYT) return;
    if (videoRef.current) {
      if (playing) {
        videoRef.current.play().catch(e => console.warn("Autoplay blocked", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [playing, isYT]);

  useEffect(() => {
    if (isYT) return;
    if (seekTo !== null && videoRef.current) {
      videoRef.current.currentTime = seekTo;
    }
  }, [seekTo, isYT]);

  const handleTimeUpdate = () => {
    if (videoRef.current) onProgress(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) onDuration(videoRef.current.duration);
  };

  // --- YouTube Video Logic ---
  useEffect(() => {
    if (!isYT) return;

    // Load YouTube API if not exists
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const initPlayer = () => {
      const videoId = getYouTubeId(url);
      if (!videoId) return;

      // Clean up previous instance if any
      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
          'playsinline': 1,
          'controls': 0, // We use custom controls
          'rel': 0,
          'modestbranding': 1
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = initPlayer;
    }

    return () => {
      if (playerRef.current && playerRef.current.destroy) {
        playerRef.current.destroy();
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [url, isYT]);

  // Sync Props to YouTube Player
  useEffect(() => {
    if (!isYT || !playerRef.current || !playerRef.current.playVideo) return;
    
    // Play/Pause
    const playerState = playerRef.current.getPlayerState();
    if (playing && playerState !== 1) { // 1 = playing
      playerRef.current.playVideo();
    } else if (!playing && playerState === 1) {
      playerRef.current.pauseVideo();
    }
  }, [playing, isYT]);

  useEffect(() => {
    if (!isYT || !playerRef.current || seekTo === null) return;
    playerRef.current.seekTo(seekTo, true);
  }, [seekTo, isYT]);

  const onPlayerReady = (event: any) => {
    onDuration(event.target.getDuration());
    if (playing) event.target.playVideo();
  };

  const onPlayerStateChange = (event: any) => {
    // 0 = ended, 1 = playing, 2 = paused
    if (event.data === 0) {
      onEnded();
    }
    
    // Start/Stop Polling for progress
    if (event.data === 1) {
      if (progressInterval.current) clearInterval(progressInterval.current);
      progressInterval.current = window.setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const time = playerRef.current.getCurrentTime();
          onProgress(time);
        }
      }, 500); // Poll every 500ms
    } else {
      if (progressInterval.current) clearInterval(progressInterval.current);
    }
  };

  if (isYT) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg group">
        <div id="yt-player" className="w-full h-full"></div>
        {/* Transparent overlay to block native YT click-to-pause if we want strictly custom controls, 
            but blocking clicks prevents initial interaction sometimes required by browsers. 
            We'll leave it interactive. */}
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg group">
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onClick={(e) => {
            e.preventDefault();
        }}
      />
    </div>
  );
};

export default VideoPlayer;
