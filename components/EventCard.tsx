import React, { useState } from 'react';
import { KPopEvent, StoreName } from '../types';
import { Calendar, ExternalLink, Clock, MapPin, Video, Image as ImageIcon, Mic2, Ticket, Camera, ShoppingBag } from 'lucide-react';

interface EventCardProps {
  event: KPopEvent;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const [imgError, setImgError] = useState(false);
  
  // Helper to generate consistent colors based on store name string
  const getStoreBadgeStyle = (storeName: string) => {
    // Specific overrides for major stores to keep brand colors
    switch (storeName) {
      case StoreName.KTOWN4U: return 'bg-orange-100 text-orange-800 border-orange-200';
      case StoreName.WEVERSE: return 'bg-green-100 text-green-800 border-green-200';
      case StoreName.MAKESTAR: return 'bg-blue-100 text-blue-800 border-blue-200';
      case StoreName.WITHMUU: return 'bg-pink-100 text-pink-800 border-pink-200';
      case StoreName.SOUNDWAVE: return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case StoreName.APPLE_MUSIC: return 'bg-red-100 text-red-800 border-red-200';
    }

    // Dynamic hash-based color for the long list of other stores
    const colors = [
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-teal-100 text-teal-800 border-teal-200',
      'bg-cyan-100 text-cyan-800 border-cyan-200',
      'bg-rose-100 text-rose-800 border-rose-200',
      'bg-amber-100 text-amber-800 border-amber-200',
      'bg-emerald-100 text-emerald-800 border-emerald-200',
      'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
      'bg-violet-100 text-violet-800 border-violet-200',
      'bg-sky-100 text-sky-800 border-sky-200'
    ];
    
    let hash = 0;
    for (let i = 0; i < storeName.length; i++) {
      hash = storeName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-rose-500 text-white animate-pulse';
      case 'Upcoming': return 'bg-yellow-400 text-white';
      case 'Closed': return 'bg-gray-400 text-white';
      default: return 'bg-gray-400 text-white';
    }
  };

  // Generate a placeholder background if image fails
  const getPlaceholderBg = () => {
    const gradients = [
      'from-pink-300 to-rose-300',
      'from-purple-300 to-indigo-300',
      'from-blue-300 to-cyan-300',
      'from-green-300 to-emerald-300',
      'from-orange-300 to-amber-300'
    ];
    const index = event.artist.length % gradients.length;
    return `bg-gradient-to-br ${gradients[index]}`;
  };

  return (
    <div className="group bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
      {/* Image Header */}
      <div className={`relative h-56 overflow-hidden ${(!event.thumbnailUrl || imgError) ? getPlaceholderBg() : 'bg-gray-200'}`}>
        {event.thumbnailUrl && !imgError ? (
          <img
            src={event.thumbnailUrl}
            alt={event.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
            referrerPolicy="no-referrer" /* CRITICAL FIX: Bypass hotlink protection */
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white p-4 text-center">
             <div className="w-12 h-12 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center mb-2">
                <ImageIcon size={24} className="text-white" />
             </div>
             <span className="font-bold text-lg drop-shadow-md">{event.artist}</span>
             <span className="text-xs opacity-90 mt-1">Event Image</span>
          </div>
        )}
        
        <div className="absolute top-3 left-3 flex gap-2 max-w-[80%] flex-wrap">
          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${getStoreBadgeStyle(event.store)}`}>
            {event.store}
          </span>
        </div>
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm ${getStatusColor(event.status)}`}>
            {event.status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-1 text-kpop-pink font-bold text-sm uppercase tracking-wide">
          {event.artist}
        </div>
        <h3 className="text-gray-800 font-bold text-lg mb-3 line-clamp-2 leading-tight h-14">
          {event.title}
        </h3>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            {(() => {
              const t = event.eventType || '';
              if (t.includes('Video')) return <Video size={16} className="text-purple-500"/>;
              if (t.includes('Fan Meeting') || t.includes('Fanmeeting')) return <Mic2 size={16} className="text-fuchsia-500"/>;
              if (t.includes('Showcase')) return <Ticket size={16} className="text-indigo-500"/>;
              if (t.includes('Lucky') || t.includes('Photo')) return <Camera size={16} className="text-amber-500"/>;
              if (t.includes('MD') || t.includes('Goods')) return <ShoppingBag size={16} className="text-emerald-500"/>;
              return <MapPin size={16} className="text-rose-500"/>;
            })()}
            <span>{event.eventType}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-blue-500" />
            <span>Apply: {event.applicationPeriod}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-green-500" />
            <span>Event: <span className="font-semibold text-gray-800">{event.eventDate}</span></span>
          </div>
        </div>

        {/* Action */}
        <div className="mt-5 pt-4 border-t border-gray-50 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            {event.linkVerified === false ? '🔍 검색 폴백' : `ID: ${event.id.split('-')[1] || '000'}`}
          </span>
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-kpop-dark hover:text-kpop-pink transition-colors"
            title={event.linkVerified === false ? '검증된 상세 링크가 없어 Google 검색으로 연결합니다' : '스토어 페이지로 이동'}
          >
            {event.linkVerified === false ? 'Search' : 'Go to Store'} <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
};