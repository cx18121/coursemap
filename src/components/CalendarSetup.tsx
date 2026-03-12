'use client';

import React, { useState } from 'react';
import { GroupedEvents } from '@/services/icalParser';

export default function CalendarSetup() {
  const [feedUrl, setFeedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<GroupedEvents | null>(null);
  
  // Using generic OAuth flow text for now
  const [accessToken, setAccessToken] = useState(''); 

  const handleParse = async () => {
    if (!feedUrl) return;
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/parse-ics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      setCourses(result.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!courses || !accessToken) return;
    
    // Flatten courses into a single event array for the sync API
    const eventsToSync = Object.values(courses).flat();
    
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/sync-gcal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accessToken, 
          events: eventsToSync,
          // Sending empty color map, can be expanded to UI inputs later
          courseColorMap: {} 
        })
      });
      
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      alert(result.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      
      {/* Fake OAuth Input for Prototype / Local Testing */}
      <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-4">
        <h2 className="text-xl font-medium text-white">1. Authenticate Google</h2>
        <input 
          type="text" 
          placeholder="Paste your Google Calendar Access Token..." 
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />
        <p className="text-xs text-white/60">For development, retrieve a temporary token from Google OAuth 2.0 Playground.</p>
      </div>

      {/* Canvas URL Parser */}
      <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-4">
        <h2 className="text-xl font-medium text-white">2. Process Canvas Feed</h2>
        <div className="flex gap-4">
          <input 
            type="url" 
            placeholder="Paste your Canvas .ics URL here..." 
            value={feedUrl}
            onChange={(e) => setFeedUrl(e.target.value)}
            className="flex-1 px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          <button 
            onClick={handleParse}
            disabled={loading || !feedUrl}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-xl transition-colors shadow-lg shadow-indigo-500/30"
          >
            {loading ? 'Processing...' : 'Fetch Feed'}
          </button>
        </div>
        
        {error && <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200 text-sm">{error}</div>}
      </div>

      {/* Course List & Sync Trigger */}
      {courses && (
        <div className="bg-white/10 p-6 rounded-2xl backdrop-blur-lg border border-white/20 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div>
            <h2 className="text-xl font-medium text-white mb-1">3. Review Found Classes</h2>
            <p className="text-sm text-white/60">We extracted the following courses from your Canvas feed.</p>
          </div>
          
          <div className="space-y-3">
            {Object.entries(courses).map(([courseName, events]) => (
              <div key={courseName} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                <span className="text-white font-medium">{courseName}</span>
                <span className="text-indigo-300 text-sm px-3 py-1 bg-indigo-500/20 rounded-full">{events.length} assignments</span>
              </div>
            ))}
          </div>

          <button 
            onClick={handleSync}
            disabled={loading || !accessToken}
            className="w-full px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/30 transform hover:-translate-y-1"
          >
            {loading ? 'Syncing to Google Calendar...' : 'Push to Google Calendar'}
          </button>
        </div>
      )}
    </div>
  );
}
