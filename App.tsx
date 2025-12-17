import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VideoData, Marker, MarkerType } from './types';
import { Icons } from './constants';
import { generateId, formatTime, getYouTubeId, getYouTubeThumbnail, isYouTubeUrl, fetchVideoMetadata } from './utils';
import { storage } from './storage';

// Components
import Timeline from './components/Timeline';
import BpmDetector from './components/BpmDetector';
import MarkerList from './components/MarkerList';
import VideoPlayer from './components/VideoPlayer';

const App: React.FC = () => {
  // --- Global State ---
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [markerTypes, setMarkerTypes] = useState<MarkerType[]>([]);

  // --- Data Loading ---
  const loadData = useCallback(async () => {
    const [v, m, t] = await Promise.all([
      storage.getVideos(),
      storage.getMarkers(),
      storage.getMarkerTypes()
    ]);
    setVideos(v);
    setMarkers(m);
    setMarkerTypes(t);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // --- Player State ---
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seekRequest, setSeekRequest] = useState<number | null>(null);

  // --- Editor State ---
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [newTypeInput, setNewTypeInput] = useState('');
  
  // --- Search & Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTypeId, setFilterTypeId] = useState<string>('all');
  const [sortOption, setSortOption] = useState<'title' | 'bpm_desc' | 'bpm_asc' | 'markers_desc' | 'duration'>('title');

  // --- Modal State ---
  const [isMarkerModalOpen, setIsMarkerModalOpen] = useState(false);
  const [pendingMarker, setPendingMarker] = useState<{start: number, end: number} | null>(null);
  const [markerLabelInput, setMarkerLabelInput] = useState('');

  // --- Add Video Modal State ---
  const [isAddVideoModalOpen, setIsAddVideoModalOpen] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [fetchedTitle, setFetchedTitle] = useState('');
  const [customNameInput, setCustomNameInput] = useState('');
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  // --- Handlers for Add Video ---
  const handleUrlChange = async (url: string) => {
    setNewVideoUrl(url);
    if (isYouTubeUrl(url)) {
      setIsFetchingInfo(true);
      const metadata = await fetchVideoMetadata(url);
      if (metadata) {
        setFetchedTitle(metadata.title);
      }
      setIsFetchingInfo(false);
    } else {
      setFetchedTitle('');
    }
  };

  const resetAddVideoForm = () => {
      setNewVideoUrl('');
      setFetchedTitle('');
      setCustomNameInput('');
      setIsFetchingInfo(false);
      setIsAddVideoModalOpen(false);
  };

  const handleAddVideo = async () => {
    // If no fetched title (e.g. mp4 link), use custom name as title, or fallback to "Untitled"
    const finalTitle = fetchedTitle || 'Untitled Video';
    const finalCustomName = customNameInput.trim() || undefined;

    if (!newVideoUrl.trim()) return;

    let thumbnailUrl = 'https://picsum.photos/400/225?grayscale'; // Fallback
    const ytId = getYouTubeId(newVideoUrl);
    
    if (ytId) {
      thumbnailUrl = getYouTubeThumbnail(ytId);
    }

    const newVideo: VideoData = {
      id: generateId(),
      title: finalTitle,
      customName: finalCustomName,
      videoUrl: newVideoUrl,
      thumbnailUrl: thumbnailUrl,
      duration: 0, // Will be updated by player on first load
      bpm: 0
    };

    await storage.addVideo(newVideo);
    setVideos(prev => [...prev, newVideo]);
    resetAddVideoForm();
  };


  // Helpers
  const activeVideo = videos.find(v => v.id === activeVideoId);
  const activeMarkers = markers.filter(m => m.videoId === activeVideoId);

  // --- Search & Filter Logic ---
  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];

    // 1. Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(video => {
        // Search in Title and Custom Name
        if (video.title.toLowerCase().includes(query)) return true;
        if (video.customName && video.customName.toLowerCase().includes(query)) return true;

        const videoMarkers = markers.filter(m => m.videoId === video.id);
        const hasMatchingMarker = videoMarkers.some(m => m.label.toLowerCase().includes(query));
        if (hasMatchingMarker) return true;
        const typesInVideo = new Set(videoMarkers.map(m => m.typeId));
        const matchingTypeIds = markerTypes.filter(t => t.name.toLowerCase().includes(query)).map(t => t.id);
        if (matchingTypeIds.some(id => typesInVideo.has(id))) return true;
        return false;
      });
    }

    // 2. Filter by Type
    if (filterTypeId !== 'all') {
      result = result.filter(video => {
        const videoMarkers = markers.filter(m => m.videoId === video.id);
        return videoMarkers.some(m => m.typeId === filterTypeId);
      });
    }

    // 3. Sort
    result.sort((a, b) => {
      switch (sortOption) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'bpm_desc':
          return (b.bpm || 0) - (a.bpm || 0);
        case 'bpm_asc':
          if ((a.bpm || 0) === 0) return 1;
          if ((b.bpm || 0) === 0) return -1;
          return (a.bpm || 0) - (b.bpm || 0);
        case 'markers_desc':
          const countA = markers.filter(m => m.videoId === a.id).length;
          const countB = markers.filter(m => m.videoId === b.id).length;
          return countB - countA;
        case 'duration':
          return b.duration - a.duration;
        default:
          return 0;
      }
    });

    return result;
  }, [videos, markers, markerTypes, searchQuery, filterTypeId, sortOption]);


  // --- Handlers ---

  const handleVideoSelect = (id: string) => {
    setActiveVideoId(id);
    setPlaying(false);
    setCurrentTime(0);
    if(markerTypes.length > 0) setSelectedTypeId(null);
  };

  const handleGoBack = () => {
    setPlaying(false);
    setActiveVideoId(null);
  };

  const handleAddMarkerType = async () => {
    if (!newTypeInput.trim()) return;
    const colors = ['bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-purple-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newType: MarkerType = {
      id: generateId(),
      name: newTypeInput.trim(),
      color: randomColor,
      textColor: 'text-white'
    };
    
    await storage.addMarkerType(newType);
    setMarkerTypes(prev => [...prev, newType]);
    setSelectedTypeId(newType.id);
    setNewTypeInput('');
  };

  const handleInitiateMarker = (start: number, end: number) => {
    setPlaying(false);
    setPendingMarker({ start, end });
    setMarkerLabelInput('');
    setIsMarkerModalOpen(true);
  };

  const handleConfirmMarker = async () => {
    if (pendingMarker && activeVideoId && selectedTypeId) {
      const newMarker: Marker = {
        id: generateId(),
        videoId: activeVideoId,
        typeId: selectedTypeId,
        start: pendingMarker.start,
        end: pendingMarker.end,
        label: markerLabelInput || 'Untitled Marker',
        createdAt: Date.now()
      };
      await storage.addMarker(newMarker);
      setMarkers(prev => [...prev, newMarker]);
      setIsMarkerModalOpen(false);
      setPendingMarker(null);
    }
  };

  const handleDeleteMarker = async (id: string) => {
    if (confirm('Are you sure you want to delete this marker?')) {
      await storage.deleteMarker(id);
      setMarkers(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleSaveBpm = async (bpm: number) => {
    if (activeVideoId && activeVideo) {
      const updatedVideo = { ...activeVideo, bpm };
      await storage.updateVideo(updatedVideo);
      setVideos(prev => prev.map(v => v.id === activeVideoId ? updatedVideo : v));
    }
  };

  // --- Views ---

  const renderVideoTitle = (video: VideoData) => (
      <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-2">
          <h3 className="text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-1">
              {video.title}
          </h3>
          {video.customName && (
              <span className="text-sm text-slate-500 font-medium">
                   | {video.customName}
              </span>
          )}
      </div>
  );

  const renderVideoList = () => (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex justify-between items-start mb-2">
            <h1 className="text-3xl font-bold text-slate-900">My Library</h1>
            <button 
                onClick={() => setIsAddVideoModalOpen(true)}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm flex items-center transition-all active:scale-95"
            >
                <Icons.Plus className="w-5 h-5 mr-1.5" />
                Add Video
            </button>
        </div>
        <p className="text-slate-500 mb-6">Analyze videos, track BPM, and mark key moments.</p>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
          
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search title, custom names, or markers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
             {/* Filter Type */}
             <div className="flex items-center gap-2 min-w-[140px]">
                <Icons.Filter className="text-slate-400 w-4 h-4" />
                <select 
                  value={filterTypeId} 
                  onChange={(e) => setFilterTypeId(e.target.value)}
                  className="w-full text-sm border-none bg-slate-50 py-2 pl-2 pr-8 rounded-lg focus:ring-0 cursor-pointer text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                >
                  <option value="all">All Types</option>
                  {markerTypes.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
             </div>

             {/* Sort Option */}
             <div className="flex items-center gap-2 min-w-[150px]">
                <Icons.Sort className="text-slate-400 w-4 h-4" />
                <select 
                  value={sortOption} 
                  onChange={(e) => setSortOption(e.target.value as any)}
                  className="w-full text-sm border-none bg-slate-50 py-2 pl-2 pr-8 rounded-lg focus:ring-0 cursor-pointer text-slate-700 font-medium hover:bg-slate-100 transition-colors"
                >
                  <option value="title">A-Z Title</option>
                  <option value="bpm_desc">High BPM</option>
                  <option value="bpm_asc">Low BPM</option>
                  <option value="markers_desc">Most Markers</option>
                  <option value="duration">Duration</option>
                </select>
             </div>
          </div>
        </div>
      </header>

      {/* Video List (No Previews) */}
      <div className="space-y-4">
        {filteredAndSortedVideos.length === 0 ? (
           <div className="text-center py-12 text-slate-400">
             <p>No videos found matching your criteria.</p>
             <button 
                onClick={() => { setSearchQuery(''); setFilterTypeId('all'); }}
                className="mt-2 text-brand-600 font-medium hover:underline"
             >
               Clear filters
             </button>
           </div>
        ) : (
          filteredAndSortedVideos.map(video => {
             const videoMarkers = markers.filter(m => m.videoId === video.id);
             
             // Check if specific markers match the search query to highlight them
             const matchingMarkers = searchQuery.trim() 
                ? videoMarkers.filter(m => m.label.toLowerCase().includes(searchQuery.toLowerCase()))
                : [];

             return (
              <div 
                key={video.id} 
                onClick={() => handleVideoSelect(video.id)}
                className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-brand-300 transition-all cursor-pointer group flex flex-col md:flex-row gap-4"
              >
                {/* Left: Info */}
                <div className="flex-1">
                  <div className="flex items-center justify-between md:justify-start gap-3 mb-1">
                    {renderVideoTitle(video)}
                    {video.bpm > 0 && (
                      <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        {video.bpm} BPM
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center text-sm text-slate-500 font-mono gap-4 mb-3">
                     <span className="flex items-center">
                       <Icons.Clock className="w-3 h-3 mr-1" />
                       {formatTime(video.duration)}
                     </span>
                     <span className="flex items-center">
                       <Icons.Tag className="w-3 h-3 mr-1" />
                       {videoMarkers.length} markers
                     </span>
                  </div>

                  {/* Visual Marker Bar (Compact Preview) */}
                  <div className="w-full h-2 bg-slate-100 rounded-full relative overflow-hidden mt-2">
                     {videoMarkers.map(m => {
                        const type = markerTypes.find(t => t.id === m.typeId);
                        const leftPct = (m.start / video.duration) * 100;
                        const widthPct = Math.max(((m.end - m.start) / video.duration) * 100, 1);
                        return (
                          <div 
                            key={m.id}
                            className={`absolute top-0 bottom-0 ${type?.color || 'bg-slate-400'}`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          />
                        );
                     })}
                  </div>
                </div>

                {/* Right: Matches or Action */}
                <div className="md:w-1/3 flex flex-col justify-center items-start md:items-end border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                    {matchingMarkers.length > 0 ? (
                      <div className="text-xs w-full">
                         <p className="font-semibold text-slate-500 uppercase tracking-wide mb-1">Found in markers:</p>
                         <ul className="space-y-1">
                            {matchingMarkers.slice(0, 2).map(m => (
                              <li key={m.id} className="text-slate-700 truncate bg-yellow-50 px-2 py-1 rounded border border-yellow-100">
                                "{m.label}" <span className="text-slate-400 ml-1">({formatTime(m.start)})</span>
                              </li>
                            ))}
                            {matchingMarkers.length > 2 && <li className="text-slate-400 italic">+ {matchingMarkers.length - 2} more</li>}
                         </ul>
                      </div>
                    ) : (
                       <button className="text-brand-600 font-medium text-sm flex items-center bg-brand-50 px-4 py-2 rounded-lg group-hover:bg-brand-100 transition-colors w-full md:w-auto justify-center">
                          <Icons.Play className="w-4 h-4 mr-2" />
                          Open Project
                       </button>
                    )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const renderDetailView = () => {
    if (!activeVideo) return null;

    return (
      <div className="flex flex-col h-screen md:h-auto md:min-h-screen bg-slate-50">
        {/* Navigation Bar */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-sm">
           <button onClick={handleGoBack} className="flex items-center text-slate-600 hover:text-slate-900 transition-colors font-medium">
             <Icons.ChevronLeft className="w-5 h-5 mr-1" />
             Back to Library
           </button>
           
           {/* Detailed Title */}
           <div className="hidden md:flex flex-col items-end">
               <h2 className="text-sm font-bold text-slate-800 line-clamp-1">{activeVideo.title}</h2>
               {activeVideo.customName && (
                   <span className="text-xs text-slate-500">{activeVideo.customName}</span>
               )}
           </div>
           
           <div className="w-20 md:hidden"></div> {/* Spacer mobile */}
        </div>

        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Player & Timeline (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            {/* Video Player Container */}
            <div className="bg-black rounded-xl overflow-hidden shadow-md">
               <VideoPlayer 
                 url={activeVideo.videoUrl}
                 playing={playing}
                 onProgress={setCurrentTime}
                 onDuration={(d) => {
                     setDuration(d);
                     // Update storage if duration was 0 (newly added video)
                     if (activeVideo.duration === 0 && d > 0) {
                         const updated = { ...activeVideo, duration: d };
                         storage.updateVideo(updated);
                         setVideos(prev => prev.map(v => v.id === activeVideo.id ? updated : v));
                     }
                 }}
                 onEnded={() => setPlaying(false)}
                 seekTo={seekRequest}
               />
               
               {/* Custom Controls Bar */}
               <div className="bg-slate-900 text-white p-3 flex items-center gap-4">
                  <button onClick={() => setPlaying(!playing)} className="hover:text-brand-400 transition-colors">
                    {playing ? <Icons.Pause className="w-6 h-6" /> : <Icons.Play className="w-6 h-6" />}
                  </button>
                  <div className="font-mono text-sm text-slate-300">
                    {formatTime(currentTime)} <span className="text-slate-600">/</span> {formatTime(duration || activeVideo.duration)}
                  </div>
                  <div className="flex-1"></div>
               </div>
            </div>

            {/* Timeline */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
               <Timeline 
                 duration={duration || activeVideo.duration}
                 currentTime={currentTime}
                 markers={activeMarkers}
                 selectedTypeId={selectedTypeId}
                 markerTypes={markerTypes}
                 onSeek={(t) => setSeekRequest(t)}
                 onAddMarker={handleInitiateMarker}
                 onMarkerClick={(m) => setSeekRequest(m.start)}
               />
            </div>
            
            {/* Type Selector */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-semibold text-slate-700">Marker Types</h3>
                 {selectedTypeId && (
                   <button 
                     onClick={() => setSelectedTypeId(null)} 
                     className="text-xs text-red-500 hover:text-red-700 font-medium"
                   >
                     Exit Mark Mode
                   </button>
                 )}
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                 {markerTypes.map(type => (
                   <button
                     key={type.id}
                     onClick={() => setSelectedTypeId(selectedTypeId === type.id ? null : type.id)}
                     className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2 flex items-center
                        ${selectedTypeId === type.id 
                          ? `${type.color} text-white border-transparent ring-2 ring-offset-1 ring-brand-300` 
                          : `bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50`
                        }`}
                   >
                     <div className={`w-2 h-2 rounded-full mr-2 ${selectedTypeId === type.id ? 'bg-white' : type.color}`} />
                     {type.name}
                   </button>
                 ))}
              </div>
              
              {/* Add New Type */}
              <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={newTypeInput}
                   onChange={(e) => setNewTypeInput(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAddMarkerType()}
                   placeholder="New type name..."
                   className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                 />
                 <button 
                   onClick={handleAddMarkerType}
                   disabled={!newTypeInput.trim()}
                   className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 disabled:opacity-50"
                 >
                   <Icons.Plus className="w-4 h-4" />
                 </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Sidebar (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* BPM Section */}
            <BpmDetector 
              initialBpm={activeVideo.bpm}
              onSave={handleSaveBpm}
            />

            {/* Marker List */}
            <div className="bg-slate-50 rounded-xl flex-1 min-h-[400px]">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-700">Timeline Markers</h3>
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">
                  {activeMarkers.length}
                </span>
              </div>
              <div className="p-4 max-h-[600px] overflow-y-auto">
                 <MarkerList 
                   markers={activeMarkers}
                   markerTypes={markerTypes}
                   onJumpTo={(t) => setSeekRequest(t)}
                   onDelete={handleDeleteMarker}
                 />
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  };

  // --- Render ---

  return (
    <div className="min-h-screen font-sans">
      {!activeVideoId ? renderVideoList() : renderDetailView()}

      {/* Modal for Label Input */}
      {isMarkerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all scale-100">
             <h3 className="text-lg font-bold text-slate-800 mb-4">Label this marker</h3>
             <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Time Range</label>
                <div className="font-mono text-slate-700 bg-slate-100 px-3 py-2 rounded-lg">
                  {pendingMarker && `${formatTime(pendingMarker.start)} - ${formatTime(pendingMarker.end)}`}
                </div>
             </div>
             <div className="mb-6">
               <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Label / Note</label>
               <input 
                 autoFocus
                 type="text" 
                 value={markerLabelInput}
                 onChange={(e) => setMarkerLabelInput(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleConfirmMarker()}
                 className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-lg"
                 placeholder="e.g., Key takeaway..."
               />
             </div>
             <div className="flex gap-3 justify-end">
               <button 
                 onClick={() => setIsMarkerModalOpen(false)}
                 className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleConfirmMarker}
                 className="px-5 py-2.5 bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm"
               >
                 Save Marker
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Modal for Add Video */}
      {isAddVideoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 transform transition-all scale-100">
             <h3 className="text-xl font-bold text-slate-900 mb-6">Add New Video</h3>
             
             <div className="mb-4">
               <label className="block text-sm font-bold text-slate-700 mb-2">Video URL (YouTube or MP4)</label>
               <div className="relative">
                 <input 
                    type="text" 
                    value={newVideoUrl}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {isFetchingInfo ? (
                      <Icons.Loader className="w-5 h-5 animate-spin text-brand-500" />
                    ) : (
                      <Icons.Link className="w-5 h-5" />
                    )}
                  </div>
               </div>
               
               {newVideoUrl && isYouTubeUrl(newVideoUrl) && !isFetchingInfo && fetchedTitle && (
                 <p className="mt-2 text-xs text-green-600 flex items-center font-medium">
                   <Icons.Check className="w-3 h-3 mr-1" />
                   Found: {fetchedTitle}
                 </p>
               )}
             </div>

             <div className="mb-4">
               <label className="block text-sm font-bold text-slate-700 mb-2">
                  Original Title 
                  <span className="text-xs font-normal text-slate-400 ml-2">(Auto-filled from YouTube)</span>
               </label>
               <input 
                 type="text" 
                 value={fetchedTitle}
                 onChange={(e) => setFetchedTitle(e.target.value)}
                 className="w-full px-4 py-2 border border-slate-300 bg-slate-50 text-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                 placeholder="Video title..."
               />
             </div>

             <div className="mb-6">
               <label className="block text-sm font-bold text-slate-700 mb-2">
                  Custom Name 
                  <span className="text-xs font-normal text-slate-400 ml-2">(Optional label)</span>
               </label>
               <input 
                 type="text" 
                 value={customNameInput}
                 onChange={(e) => setCustomNameInput(e.target.value)}
                 className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                 placeholder="e.g. My Study Guide"
               />
             </div>

             <div className="flex gap-3 justify-end">
               <button 
                 onClick={resetAddVideoForm}
                 className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg"
               >
                 Cancel
               </button>
               <button 
                 onClick={handleAddVideo}
                 disabled={!fetchedTitle && !newVideoUrl}
                 className="px-5 py-2.5 bg-brand-600 text-white font-medium hover:bg-brand-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 Add Video
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
