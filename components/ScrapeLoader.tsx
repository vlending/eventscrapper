import React, { useEffect, useState } from 'react';
import { Loader2, Search, CheckCircle2, Globe } from 'lucide-react';

interface ScrapeLoaderProps {
  isVisible: boolean;
}

export const ScrapeLoader: React.FC<ScrapeLoaderProps> = ({ isVisible }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setStep(0);
      return;
    }

    // Adjusted timing to match real search latency better
    const intervals = [
      setTimeout(() => setStep(1), 500),  // Search
      setTimeout(() => setStep(2), 2500), // Parse Results
      setTimeout(() => setStep(3), 4000), // Extract Data
      setTimeout(() => setStep(4), 5000), // Finalize
    ];

    return () => intervals.forEach(clearTimeout);
  }, [isVisible]);

  if (!isVisible) return null;

  const steps = [
    { label: "Initializing search agent...", icon: Loader2, spin: true },
    { label: "Searching Ktown4u, Hello Live, & Stores...", icon: Globe, spin: false },
    { label: "Analyzing search results...", icon: Search, spin: false },
    { label: "Extracting event details...", icon: CheckCircle2, spin: false },
    { label: "Formatting data...", icon: CheckCircle2, spin: false },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center transition-opacity duration-300">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform transition-all scale-100">
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-kpop-pink blur-xl opacity-30 rounded-full animate-pulse"></div>
            <div className="relative bg-white p-4 rounded-full shadow-lg border border-gray-100">
               <Globe className="w-10 h-10 text-kpop-pink animate-pulse" />
            </div>
          </div>
          
          <h3 className="text-xl font-bold text-gray-800 mb-6">Scanning Live Data</h3>
          
          <div className="w-full space-y-4">
            {steps.map((s, idx) => (
              <div 
                key={idx} 
                className={`flex items-center gap-3 transition-all duration-500 ${
                  idx <= step ? 'opacity-100 translate-x-0' : 'opacity-30 -translate-x-4'
                }`}
              >
                {idx < step ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : idx === step ? (
                  <s.icon className={`w-5 h-5 text-kpop-pink flex-shrink-0 ${s.spin ? 'animate-spin' : 'animate-pulse'}`} />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-100 flex-shrink-0" />
                )}
                <span className={`text-sm font-medium ${idx === step ? 'text-gray-800' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="w-full bg-gray-100 h-1.5 rounded-full mt-8 overflow-hidden">
             <div 
               className="h-full bg-gradient-to-r from-kpop-pink to-purple-400 transition-all duration-700 ease-in-out"
               style={{ width: `${Math.min(((step + 1) / steps.length) * 100, 100)}%` }}
             ></div>
          </div>
          
          <p className="mt-4 text-xs text-gray-400 text-center">
            Using Google Search Grounding to fetch real-time info
          </p>
        </div>
      </div>
    </div>
  );
};