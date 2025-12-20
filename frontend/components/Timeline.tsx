import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Marker, MarkerType } from '../types';
import { formatTime } from '../utils';
import { Icons } from '../constants';

interface TimelineProps {
  duration: number;
  currentTime: number;
  markers: Marker[];
  selectedTypeId: string | null;
  markerTypes: MarkerType[];
  onSeek: (time: number) => void;
  onAddMarker: (start: number, end: number) => void;
  onMarkerClick: (marker: Marker) => void;
}

interface TimelineTrackProps {
  duration: number;
  currentTime: number;
  hoverTime: number | null;
  markers: Marker[];
  markerTypes: MarkerType[];
  selectedTypeId: string | null;
  isDragging: boolean;
  dragStart: number | null;
  dragEnd: number | null;
  timelineRef: React.RefObject<HTMLDivElement>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onMarkerClick: (marker: Marker) => void;
  getPositionPercent: (time: number) => number;
}

const TimelineTrack: React.FC<TimelineTrackProps> = ({
  duration,
  currentTime,
  hoverTime,
  markers,
  markerTypes,
  selectedTypeId,
  isDragging,
  dragStart,
  dragEnd,
  timelineRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onMarkerClick,
  getPositionPercent,
}) => {
  const currentType = markerTypes.find(t => t.id === selectedTypeId);

  return (
    <div 
      ref={timelineRef}
      className={`relative w-full h-12 bg-slate-200 rounded-lg overflow-hidden cursor-crosshair group touch-none ${selectedTypeId ? 'cursor-text' : 'cursor-pointer'}`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Playback Progress */}
      <div 
        className="absolute top-0 bottom-0 left-0 bg-slate-300 opacity-50 pointer-events-none"
        style={{ width: `${getPositionPercent(currentTime)}%` }}
      />

      {/* Current Time Indicator Line */}
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)]"
        style={{ left: `${getPositionPercent(currentTime)}%` }}
      />

      {/* Existing Markers */}
      {markers.map(marker => {
          const type = markerTypes.find(t => t.id === marker.typeId);
          const colorClass = type ? type.color : 'bg-gray-400';
          const left = getPositionPercent(marker.start);
          const width = getPositionPercent(marker.end - marker.start);

          return (
              <div
                  key={marker.id}
                  onClick={(e) => {
                      e.stopPropagation();
                      onMarkerClick(marker);
                  }}
                  className={`absolute top-1 bottom-1 ${colorClass} bg-opacity-80 rounded-sm border border-white/20 hover:brightness-110 hover:scale-y-110 hover:z-20 cursor-pointer flex items-center overflow-hidden`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }} // Min width for visibility
                  title={`${marker.label} (${formatTime(marker.start)} - ${formatTime(marker.end)})`}
              >
                {width > 5 && (
                  <span className="text-[10px] text-white font-medium px-1 truncate w-full">
                    {marker.label}
                  </span>
                )}
              </div>
          );
      })}

      {/* Drag Preview (Ghost Marker) */}
      {isDragging && dragStart !== null && dragEnd !== null && (
          <div
              className={`absolute top-1 bottom-1 ${currentType?.color || 'bg-brand-500'} opacity-60 rounded-sm z-10 border-2 border-white border-dashed pointer-events-none`}
              style={{
                  left: `${getPositionPercent(Math.min(dragStart, dragEnd))}%`,
                  width: `${getPositionPercent(Math.abs(dragEnd - dragStart))}%`
              }}
          />
      )}
      
      {/* Hover Time Indicator */}
      {hoverTime !== null && !isDragging && (
         <div 
           className="absolute top-0 bottom-0 w-px bg-slate-400 z-10 pointer-events-none"
           style={{ left: `${getPositionPercent(hoverTime)}%` }}
         />
      )}
    </div>
  );
};

const Timeline: React.FC<TimelineProps> = ({
  duration,
  currentTime,
  markers,
  selectedTypeId,
  markerTypes,
  onSeek,
  onAddMarker,
  onMarkerClick,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Helper to get time from mouse event
  const getTimeFromEvent = (ref: React.RefObject<HTMLDivElement>, e: React.MouseEvent) => {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    return percentage * duration;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const time = getTimeFromEvent(timelineRef, e);

    if (selectedTypeId) {
      // Start creating a marker range
      setIsDragging(true);
      setDragStart(time);
      setDragEnd(time);
    } else {
      // Just seek
      onSeek(time);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const time = getTimeFromEvent(timelineRef, e);
    setHoverTime(time);

    if (isDragging && dragStart !== null) {
      setDragEnd(time);
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart !== null && dragEnd !== null) {
      const start = Math.min(dragStart, dragEnd);
      const end = Math.max(dragStart, dragEnd);
      
      // If the drag was very short (click), make it at least 1 second or a point marker
      const finalEnd = (end - start < 0.5) ? start + 1 : end;
      
      onAddMarker(start, finalEnd);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleMouseLeave = () => {
    if (isDragging) {
        handleMouseUp();
    }
    setHoverTime(null);
  };

  // Rendering Helpers
  const getPositionPercent = (time: number) => (time / duration) * 100;

  const currentType = markerTypes.find(t => t.id === selectedTypeId);

  // Group markers by type for expanded view
  const groupedMarkers = useMemo(() => {
    return markerTypes
      .map(type => ({
        type,
        items: markers.filter(m => m.typeId === type.id)
      }))
      .filter(group => group.items.length > 0);
  }, [markers, markerTypes]);

  // Create refs object for type-specific timelines
  const typeTimelineRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({});
  
  // Initialize refs for each type
  useEffect(() => {
    groupedMarkers.forEach(({ type }) => {
      if (!typeTimelineRefs.current[type.id]) {
        typeTimelineRefs.current[type.id] = React.createRef<HTMLDivElement>();
      }
    });
  }, [groupedMarkers]);

  return (
    <div className="w-full flex flex-col select-none">
      {/* Expand/Collapse Button */}
      <div className="flex items-center mb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center text-xs text-slate-500 hover:text-slate-700 transition-colors"
        >
          <Icons.ChevronDown 
            className={`w-4 h-4 mr-1 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
          />
          <span>{isExpanded ? '收起時間軸' : '展開時間軸'}</span>
        </button>
      </div>

      {/* Time Display */}
      <div className="flex justify-between text-xs text-slate-500 font-mono mb-1 px-1">
        <span>{formatTime(hoverTime ?? currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Main Timeline Track */}
      <TimelineTrack
        duration={duration}
        currentTime={currentTime}
        hoverTime={hoverTime}
        markers={markers}
        markerTypes={markerTypes}
        selectedTypeId={selectedTypeId}
        isDragging={isDragging}
        dragStart={dragStart}
        dragEnd={dragEnd}
        timelineRef={timelineRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMarkerClick={onMarkerClick}
        getPositionPercent={getPositionPercent}
      />

      {/* Expanded View: Separate Timeline for Each Type */}
      {isExpanded && groupedMarkers.length > 0 && (
        <div className="mt-4 space-y-3">
          {groupedMarkers.map(({ type, items }) => {
            const typeTimelineRef = typeTimelineRefs.current[type.id];
            
            const handleTypeMouseDown = (e: React.MouseEvent) => {
              const time = getTimeFromEvent(typeTimelineRef, e);
              if (selectedTypeId === type.id) {
                setIsDragging(true);
                setDragStart(time);
                setDragEnd(time);
              } else {
                onSeek(time);
              }
            };

            const handleTypeMouseMove = (e: React.MouseEvent) => {
              const time = getTimeFromEvent(typeTimelineRef, e);
              setHoverTime(time);
              if (isDragging && dragStart !== null && selectedTypeId === type.id) {
                setDragEnd(time);
              }
            };

            return (
              <div key={type.id} className="flex flex-col">
                {/* Type Label */}
                <div className="flex items-center mb-1 px-1">
                  <div className={`w-2 h-2 rounded-full mr-2 ${type.color}`}></div>
                  <span className="text-xs font-medium text-slate-600">{type.name}</span>
                  <span className="text-xs text-slate-400 ml-1">({items.length})</span>
                </div>
                
                {/* Type-specific Timeline Track */}
                <TimelineTrack
                  duration={duration}
                  currentTime={currentTime}
                  hoverTime={hoverTime}
                  markers={items}
                  markerTypes={markerTypes}
                  selectedTypeId={selectedTypeId === type.id ? selectedTypeId : null}
                  isDragging={isDragging && selectedTypeId === type.id}
                  dragStart={selectedTypeId === type.id ? dragStart : null}
                  dragEnd={selectedTypeId === type.id ? dragEnd : null}
                  timelineRef={typeTimelineRef}
                  onMouseDown={handleTypeMouseDown}
                  onMouseMove={handleTypeMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onMarkerClick={onMarkerClick}
                  getPositionPercent={getPositionPercent}
                />
              </div>
            );
          })}
        </div>
      )}
      
      {/* Mode Indicator Text */}
      <div className="h-6 mt-1 flex items-center">
          {isDragging ? (
              <span className="text-xs text-brand-600 font-medium animate-pulse">
                Release to create marker ({formatTime(Math.min(dragStart!, dragEnd!))} - {formatTime(Math.max(dragStart!, dragEnd!))})
              </span>
          ) : selectedTypeId ? (
            <span className="text-xs text-slate-500 flex items-center">
               <span className={`w-2 h-2 rounded-full mr-1.5 animate-pulse ${currentType?.color || ''}`} style={{ backgroundColor: currentType?.color ? undefined : '#3b82f6' }}></span>
               Marking Mode: <strong>{currentType?.name}</strong>. Drag on timeline.
            </span>
          ) : (
             <span className="text-xs text-slate-400">
               Click to seek. Select a type below to mark.
             </span>
          )}
      </div>
    </div>
  );
};

export default Timeline;
