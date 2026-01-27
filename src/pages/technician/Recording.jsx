import { useState } from "react";

function Recordings() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recordings, setRecordings] = useState([]);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="w-8 h-8 text-indigo-600"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h12" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900">My Recordings</h1>
            <p className="text-gray-500 mt-1">Browse and manage recordings</p>
          </div>
        </div>

        {/* Search Section */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
            SEARCH
          </label>
          <div className="relative">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              placeholder="Filename, description, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 placeholder-gray-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>
          <p className="text-sm text-gray-500">Showing {recordings.length} results</p>
        </div>

        {/* Recordings List Section */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="w-6 h-6 text-gray-700"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h12" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900">Recordings</h2>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-600 rounded-full text-sm font-semibold">
              {recordings.length}
            </span>
          </div>

          {/* Empty State */}
          {recordings.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  className="w-10 h-10 text-gray-400"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-500">No recordings yet</p>
              <p className="text-sm text-gray-400 mt-1">Start recording to see your recordings here</p>
            </div>
          )}

          {/* Recordings Grid (when data exists) */}
          {recordings.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recordings.map((recording, index) => (
                <div 
                  key={index}
                  className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        className="w-6 h-6 text-indigo-600"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                      </svg>
                    </button>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{recording.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">{recording.description}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{recording.date}</span>
                    <span>{recording.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Recordings;