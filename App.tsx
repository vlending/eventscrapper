import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchScrapedEvents } from './services/geminiService';
import { downloadCsv, copyTsvToClipboard } from './services/exportService';
import { KPopEvent } from './types';
import { EventCard } from './components/EventCard';
import { ScrapeLoader } from './components/ScrapeLoader';
import {
  RefreshCw,
  Calendar as CalendarIcon,
  Users,
  Search,
  Filter,
  Sparkles,
  LayoutGrid,
  Trash2,
  ArrowUp,
  DownloadCloud,
  AlertCircle,
  FileSpreadsheet,
  ClipboardCopy,
  Check
} from 'lucide-react';

// Using a type for view modes
type ViewMode = 'all' | 'artist' | 'date';
type TypeFilter = 'all' | 'fansign' | 'video' | 'fanmeeting' | 'showcase' | 'other';

const TYPE_FILTERS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'fansign', label: '팬사인회' },
  { key: 'video', label: '영통팬싸' },
  { key: 'fanmeeting', label: '팬미팅' },
  { key: 'showcase', label: '쇼케이스' },
  { key: 'other', label: '기타 이벤트' },
];

const matchesTypeFilter = (eventType: string, filter: TypeFilter): boolean => {
  const t = (eventType || '').toLowerCase();
  switch (filter) {
    case 'all': return true;
    case 'fansign': return t.includes('offline fansign') || (t.includes('fansign') && !t.includes('video'));
    case 'video': return t.includes('video');
    case 'fanmeeting': return t.includes('fan meeting') || t.includes('fanmeeting');
    case 'showcase': return t.includes('showcase');
    case 'other': return !t.includes('fansign') && !t.includes('video') && !t.includes('fan meeting') && !t.includes('fanmeeting') && !t.includes('showcase');
    default: return true;
  }
};

const CACHE_KEY = 'kpop-events-cache-v1';

interface CachedState {
  events: KPopEvent[];
  page: number;
  fetchedAt: string;
}

const loadCache = (): CachedState | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedState;
    if (!parsed || !Array.isArray(parsed.events)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveCache = (state: CachedState) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch {}
};

const clearCache = () => {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
};

const App: React.FC = () => {
  const cached = typeof window !== 'undefined' ? loadCache() : null;

  const [events, setEvents] = useState<KPopEvent[]>(cached?.events ?? []);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(cached?.page ?? 1);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(cached?.fetchedAt ?? null);

  // Infinite Scroll State
  const [displayLimit, setDisplayLimit] = useState<number>(12);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadEvents = async (isNewScan: boolean = false) => {
    setLoading(true);
    setError(null);

    const targetPage = isNewScan ? 1 : page + 1;
    if (isNewScan) {
      setPage(1);
    } else {
      setPage(targetPage);
    }

    try {
      // Calls /api/scrape — Gemini key stays server-side
      const newEvents = await fetchScrapedEvents(targetPage);

      const merged = (() => {
        const currentEvents = isNewScan ? [] : events;
        const existingKeys = new Set(currentEvents.map(e => e.link || `${e.store}-${e.title}`));
        const uniqueNewEvents = newEvents.filter(e => {
          const key = e.link || `${e.store}-${e.title}`;
          return !existingKeys.has(key);
        });
        return [...currentEvents, ...uniqueNewEvents];
      })();

      setEvents(merged);
      const stamp = new Date().toISOString();
      setLastFetchedAt(stamp);
      saveCache({ events: merged, page: targetPage, fetchedAt: stamp });

    } catch (err: any) {
      console.error("Full fetch error:", err);
      const msg =
        typeof err?.message === 'string' ? err.message :
        typeof err === 'string' ? err :
        (() => { try { return JSON.stringify(err); } catch { return String(err); } })();
      setError(msg || "An unexpected error occurred while fetching events.");
    } finally {
      setLoading(false);
    }
  };

  const handleNewScan = () => {
    loadEvents(true);
  };

  const handleDeepScan = () => {
    loadEvents(false);
  };

  const handleClear = () => {
    if (window.confirm("저장된 모든 이벤트를 지울까요? (캐시 포함)")) {
      setEvents([]);
      setDisplayLimit(12);
      setPage(1);
      setLastFetchedAt(null);
      clearCache();
    }
  };

  const handleExportCsv = () => {
    if (filteredEvents.length === 0) return;
    const stamp = new Date().toISOString().split('T')[0];
    downloadCsv(filteredEvents, `kpop-events-${stamp}.csv`);
  };

  const handleCopyForSheets = async () => {
    if (filteredEvents.length === 0) return;
    const ok = await copyTsvToClipboard(filteredEvents);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      alert('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해주세요.');
    }
  };

  // No automatic initial load — every scan consumes Gemini quota,
  // so we rely on cached results and require the user to click "New Scan".

  // Filter logic
  const filteredEvents = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return events.filter(event => {
      const matchesSearch =
        !term ||
        event.artist.toLowerCase().includes(term) ||
        event.title.toLowerCase().includes(term) ||
        event.store.toLowerCase().includes(term);
      return matchesSearch && matchesTypeFilter(event.eventType, typeFilter);
    });
  }, [events, searchTerm, typeFilter]);

  // Infinite Scroll Logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setDisplayLimit(prev => prev + 12);
        }
      },
      { threshold: 0.5 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [filteredEvents]);

  // Scroll to top button logic
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Grouping logic for different views
  const groupedEvents = useMemo(() => {
    if (viewMode === 'artist') {
      const groups: Record<string, KPopEvent[]> = {};
      filteredEvents.forEach(e => {
        if (!groups[e.artist]) groups[e.artist] = [];
        groups[e.artist].push(e);
      });
      return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
    } else if (viewMode === 'date') {
      const groups: Record<string, KPopEvent[]> = {};
      filteredEvents.forEach(e => {
        const dateKey = e.eventDate || "TBA";
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(e);
      });
      return Object.entries(groups).sort((a, b) => {
        const dateStrA = a[0].replace(/\./g, '-');
        const dateStrB = b[0].replace(/\./g, '-');
        const dateA = new Date(dateStrA).getTime();
        const dateB = new Date(dateStrB).getTime();
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;
        return dateA - dateB;
      });
    }
    return [];
  }, [filteredEvents, viewMode]);

  // Slice events for display in 'All' mode
  const displayedEvents = useMemo(() => {
    if (viewMode !== 'all') return [];
    return filteredEvents.slice(0, displayLimit);
  }, [filteredEvents, displayLimit, viewMode]);

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-800 font-sans pb-20">
      <ScrapeLoader isVisible={loading} />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={scrollToTop}>
              <div className="w-8 h-8 bg-gradient-to-tr from-kpop-pink to-purple-400 rounded-lg flex items-center justify-center text-white font-bold shadow-lg">
                K
              </div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 hidden sm:block">
                K-pop Fan event scrapper
              </h1>
            </div>

            <div className="flex items-center gap-2">
              {events.length > 0 && (
                <>
                  <button
                    onClick={handleCopyForSheets}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-full transition-all"
                    title="Google Sheets에 붙여넣기 (TSV 클립보드 복사)"
                  >
                    {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
                    {copied ? '복사됨' : 'Sheets로 복사'}
                  </button>
                  <button
                    onClick={handleExportCsv}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-full transition-all"
                    title="CSV 다운로드 (Excel/Google Sheets에서 열기)"
                  >
                    <FileSpreadsheet size={14} />
                    CSV
                  </button>
                  <button
                    onClick={handleClear}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    title="Clear all events"
                  >
                    <Trash2 size={20} />
                  </button>
                </>
              )}
              
              <button 
                onClick={handleNewScan}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-xl active:scale-95 transform duration-150"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                {loading ? 'Scanning...' : 'New Scan'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Type Filter Chips */}
        <div className="mb-4 flex flex-wrap gap-2">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                typeFilter === f.key
                  ? 'bg-kpop-pink text-white border-kpop-pink shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-kpop-pink hover:text-kpop-pink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-start md:items-center">
          {/* View Toggles */}
          <div className="flex p-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto max-w-full">
            <button
              onClick={() => setViewMode('all')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${viewMode === 'all' ? 'bg-kpop-light text-kpop-dark shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <LayoutGrid size={16} /> All Events
            </button>
            <button
              onClick={() => setViewMode('artist')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${viewMode === 'artist' ? 'bg-kpop-light text-kpop-dark shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <Users size={16} /> By Artist
            </button>
            <button
              onClick={() => setViewMode('date')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${viewMode === 'date' ? 'bg-kpop-light text-kpop-dark shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              <CalendarIcon size={16} /> By Date
            </button>
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search size={18} className="text-gray-400 group-focus-within:text-kpop-pink transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search artist or store..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-kpop-pink/50 focus:border-kpop-pink transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-4 rounded-xl mb-6 flex items-start gap-3 shadow-sm">
             <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
             <div>
               <p className="font-bold">Error fetching data</p>
               <p className="text-sm opacity-90 mt-1">{error}</p>
             </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredEvents.length === 0 && !error && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
              <Filter className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {events.length === 0 ? '아직 스캔된 이벤트가 없습니다' : '필터에 해당하는 이벤트가 없습니다'}
            </h3>
            <p className="mt-1 text-gray-500">
              {events.length === 0
                ? '우측 상단 "New Scan" 버튼을 눌러 시작하세요. (Gemini 무료 한도: 하루 20회)'
                : '검색어 또는 필터를 조정해보세요.'}
            </p>
            {events.length === 0 && (
              <button
                onClick={handleNewScan}
                disabled={loading}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                지금 스캔하기
              </button>
            )}
          </div>
        )}

        {/* Grid / List Content */}
        {viewMode === 'all' && (
          <div>
             <div className="mb-6 flex items-baseline gap-2">
                <h2 className="text-2xl font-bold text-gray-800">All Active Events</h2>
                <span className="text-gray-500 text-sm">({filteredEvents.length} loaded)</span>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedEvents.map(event => (
                  <EventCard key={event.id} event={event} />
                ))}
             </div>

             {/* Infinite Scroll Trigger Area */}
             <div ref={observerTarget} className="flex justify-center py-8">
                {displayedEvents.length < filteredEvents.length ? (
                   <div className="flex flex-col items-center gap-2">
                     <div className="w-8 h-8 border-4 border-kpop-pink border-t-transparent rounded-full animate-spin"></div>
                     <span className="text-sm text-gray-500 font-medium">Scrolling for more...</span>
                   </div>
                ) : (
                  /* Deep Scan Button (Shows when all currently loaded events are displayed) */
                  filteredEvents.length > 0 && !loading && (
                    <button 
                      onClick={handleDeepScan}
                      className="flex flex-col items-center gap-2 px-8 py-4 bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md hover:border-kpop-pink transition-all group w-full max-w-md"
                    >
                      <DownloadCloud className="w-8 h-8 text-kpop-pink group-hover:scale-110 transition-transform" />
                      <div>
                        <span className="block font-bold text-gray-800">Deep Scan for More Events</span>
                        <span className="text-xs text-gray-400">Search deeper into stores (Page {page + 1})</span>
                      </div>
                    </button>
                  )
                )}
             </div>
          </div>
        )}

        {/* Grouped Views */}
        {(viewMode === 'artist' || viewMode === 'date') && (
          <div className="space-y-12">
            {groupedEvents.map(([groupTitle, groupEvents]) => (
              <div key={groupTitle} className="relative">
                 <div className="flex items-center gap-4 mb-6 sticky top-20 z-10 py-2 bg-[#f8f9fa]/95 backdrop-blur-sm">
                    <div className="h-8 w-1 bg-kpop-pink rounded-full"></div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {viewMode === 'artist' ? groupTitle : `Date: ${groupTitle}`}
                    </h2>
                    <span className="bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs font-semibold">
                      {groupEvents.length}
                    </span>
                    <div className="h-[1px] flex-1 bg-gray-200"></div>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupEvents.map(event => (
                      <EventCard key={event.id} event={event} />
                    ))}
                 </div>
              </div>
            ))}
             <div className="flex justify-center py-12">
               <button 
                  onClick={handleDeepScan}
                  className="px-6 py-2 bg-white border border-gray-300 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
               >
                 Load More Events via Deep Scan
               </button>
             </div>
          </div>
        )}

      </main>

      {/* Footer / Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 flex justify-between items-center text-xs text-gray-500 z-30">
        <div className="flex items-center gap-2">
          <Sparkles size={12} className="text-kpop-pink" />
          <span>Powered by Gemini 2.5 Flash</span>
        </div>
        <div>
          {lastFetchedAt
            ? `Last scan: ${new Date(lastFetchedAt).toLocaleString()}`
            : '아직 스캔하지 않음'}
        </div>
      </div>

      {/* Back to Top Button */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-16 right-6 p-3 bg-white text-gray-800 rounded-full shadow-lg border border-gray-100 hover:shadow-xl hover:scale-110 transition-all duration-300 z-40 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <ArrowUp size={20} />
      </button>

    </div>
  );
};

export default App;