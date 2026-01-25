'use client';

import { useState, useEffect } from 'react';
import { fetchMarketSummary, fetchTopMovers, MarketSummary, TopMovers } from '@/lib/api';

export function MarketPanel() {
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [movers, setMovers] = useState<TopMovers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summaryData, moversData] = await Promise.all([
          fetchMarketSummary().catch(() => null),
          fetchTopMovers().catch(() => null),
        ]);
        setSummary(summaryData);
        setMovers(moversData);
      } catch (e: any) {
        setError(e.message || 'Failed to load market data');
      } finally {
        setLoading(false);
      }
    };
    load();

    // Refresh every 5 minutes
    const interval = setInterval(load, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-800 rounded"></div>
              <div className="h-16 bg-gray-800 rounded"></div>
              <div className="h-16 bg-gray-800 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Market Summary */}
      {summary && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Market Overview</h3>
            <SentimentBadge sentiment={summary.marketSentiment} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {summary.summary.newListings24h}
              </div>
              <div className="text-xs text-gray-500">New Listings (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {summary.summary.activeOpportunities}
              </div>
              <div className="text-xs text-gray-500">Active Opportunities</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-300">
                {summary.summary.totalCards.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Total Cards</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Sources */}
      {summary && summary.topSources.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Top Sources</h3>
          <div className="space-y-2">
            {summary.topSources.map((source) => (
              <div key={source.source} className="flex items-center justify-between">
                <span className="text-sm">{source.source}</span>
                <span className="text-sm text-gray-400">
                  {source.activeListings.toLocaleString()} active
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Movers */}
      {movers && (movers.topGainers.length > 0 || movers.topLosers.length > 0) && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Top Movers (90d)</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Gainers */}
            {movers.topGainers.length > 0 && (
              <div>
                <div className="text-xs text-green-400 font-medium mb-2">TOP GAINERS</div>
                <div className="space-y-2">
                  {movers.topGainers.slice(0, 5).map((card) => (
                    <div key={card.cardId} className="flex items-center justify-between text-sm">
                      <div className="truncate flex-1 mr-2">
                        <span className="font-medium">{card.cardName}</span>
                        <span className="text-gray-500 text-xs ml-1">{card.setName}</span>
                      </div>
                      <span className="text-green-400 font-medium whitespace-nowrap">
                        +{card.changePercent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Losers */}
            {movers.topLosers.length > 0 && (
              <div>
                <div className="text-xs text-red-400 font-medium mb-2">TOP LOSERS</div>
                <div className="space-y-2">
                  {movers.topLosers.slice(0, 5).map((card) => (
                    <div key={card.cardId} className="flex items-center justify-between text-sm">
                      <div className="truncate flex-1 mr-2">
                        <span className="font-medium">{card.cardName}</span>
                        <span className="text-gray-500 text-xs ml-1">{card.setName}</span>
                      </div>
                      <span className="text-red-400 font-medium whitespace-nowrap">
                        {card.changePercent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Opportunities */}
      {summary && summary.topOpportunities.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold mb-3">Quick Opportunities</h3>
          <div className="space-y-2">
            {summary.topOpportunities.map((opp) => (
              <div key={opp.cardId} className="flex items-center justify-between text-sm">
                <span className="truncate">{opp.cardName}</span>
                <span className="text-green-400 font-medium">+{opp.spreadPct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-sm text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const colors = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    moderate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    quiet: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  };

  const color = colors[sentiment as keyof typeof colors] || colors.quiet;

  return (
    <span className={`px-2 py-1 text-xs rounded-full border ${color}`}>
      {sentiment.toUpperCase()}
    </span>
  );
}

export function MarketCommentaryCard() {
  const [commentary, setCommentary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/market/commentary');
        if (res.ok) {
          const data = await res.json();
          setCommentary(data);
        }
      } catch {
        // Silent fail - commentary is optional
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading || !commentary || !commentary.content) {
    return null;
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{commentary.title || 'Market Commentary'}</h3>
        {commentary.sentiment && (
          <span className={`text-xs px-2 py-1 rounded ${
            commentary.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
            commentary.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
            'bg-gray-500/20 text-gray-400'
          }`}>
            {commentary.sentiment}
          </span>
        )}
      </div>
      <div className="text-sm text-gray-300 whitespace-pre-wrap">
        {commentary.content}
      </div>
      {commentary.highlights && commentary.highlights.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="text-xs text-gray-500 mb-2">Highlights</div>
          <ul className="text-sm space-y-1">
            {commentary.highlights.map((h: string, i: number) => (
              <li key={i} className="text-gray-400">• {h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
