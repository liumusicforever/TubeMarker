// Format seconds to MM:SS
export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

// Generate a random ID
export const generateId = (): string => Math.random().toString(36).substr(2, 9);

// Get color classes based on marker type
export const getMarkerColor = (typeId: string, types: any[]): string => {
  const type = types.find(t => t.id === typeId);
  return type ? type.color : 'bg-gray-400';
};

// Extract YouTube Video ID
export const getYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// Check if URL is YouTube
export const isYouTubeUrl = (url: string): boolean => {
  return !!getYouTubeId(url);
};

// Get YouTube Thumbnail
export const getYouTubeThumbnail = (id: string): string => {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
};

// Fetch Video Metadata (Title, etc) via oEmbed
export const fetchVideoMetadata = async (url: string): Promise<{ title: string; thumbnailUrl?: string } | null> => {
  if (!isYouTubeUrl(url)) return null;
  try {
    // Using noembed.com as a CORS-friendly oEmbed proxy
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    if (data.error) return null;
    return {
      title: data.title,
      thumbnailUrl: data.thumbnail_url
    };
  } catch (e) {
    console.error("Failed to fetch metadata", e);
    return null;
  }
};
