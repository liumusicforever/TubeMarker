import React from 'react';
import { Marker, MarkerType } from '../types';
import { formatTime } from '../utils';
import { Icons } from '../constants';

interface MarkerListProps {
  markers: Marker[];
  markerTypes: MarkerType[];
  onJumpTo: (time: number) => void;
  onDelete: (id: string) => void;
}

const MarkerList: React.FC<MarkerListProps> = ({ markers, markerTypes, onJumpTo, onDelete }) => {
  // Group markers by type
  const groupedMarkers = markerTypes.map(type => ({
    type,
    items: markers.filter(m => m.typeId === type.id).sort((a, b) => a.start - b.start)
  })).filter(group => group.items.length > 0);

  // Handle markers with deleted types (fallback)
  const uncategorized = markers.filter(m => !markerTypes.find(t => t.id === m.typeId));
  if (uncategorized.length > 0) {
      groupedMarkers.push({
          type: { id: 'unknown', name: 'Uncategorized', color: 'bg-gray-400', textColor: 'text-white' },
          items: uncategorized
      });
  }

  return (
    <div className="space-y-6">
      {groupedMarkers.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          <Icons.Tag className="w-12 h-12 mx-auto mb-2 opacity-20" />
          <p>No markers yet. Select a type and drag on the timeline.</p>
        </div>
      ) : (
        groupedMarkers.map(({ type, items }) => (
          <div key={type.id} className="animate-fade-in">
            <div className="flex items-center mb-3">
              <div className={`w-3 h-3 rounded-full mr-2 ${type.color}`}></div>
              <h3 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
                {type.name} <span className="text-slate-400 ml-1">({items.length})</span>
              </h3>
            </div>
            
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-1">
              {items.map(marker => (
                <div 
                  key={marker.id} 
                  className="group bg-white rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-all p-3 flex items-start relative overflow-hidden"
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${type.color}`} />
                  
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => onJumpTo(marker.start)}
                  >
                    <div className="flex items-center text-xs font-mono text-slate-500 mb-1">
                      <Icons.Clock className="w-3 h-3 mr-1" />
                      {formatTime(marker.start)} - {formatTime(marker.end)}
                    </div>
                    <p className="text-slate-800 font-medium text-sm line-clamp-2 leading-relaxed">
                      {marker.label}
                    </p>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(marker.id); }}
                    className="ml-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete marker"
                  >
                    <Icons.Trash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default MarkerList;
