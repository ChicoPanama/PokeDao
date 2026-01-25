'use client';

import { useEffect, useState } from 'react';
import { OpportunityTable } from '@/components/OpportunityTable';
import { SignalTable } from '@/components/SignalTable';
import { StatusBar } from '@/components/StatusBar';
import { PortfolioPanel } from '@/components/PortfolioPanel';
import { MarketPanel, MarketCommentaryCard } from '@/components/MarketPanel';
import { PriceChart } from '@/components/PriceChart';
import { fetchArbitrage, fetchSignals, ArbitrageOpportunity, Signal } from '@/lib/api';

type Tab = 'arbitrage' | 'signals' | 'portfolio' | 'market' | 'charts';

export default function Home() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('arbitrage');
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string>('Charizard');
  const [demoUserId] = useState('demo-user-123'); // Demo user for portfolio

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [arbData, sigData] = await Promise.all([
        fetchArbitrage({ limit: 25 }),
        fetchSignals({ limit: 25 }),
      ]);
      setOpportunities(arbData);
      setSignals(sigData);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 60 seconds
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: 'arbitrage', label: 'Arbitrage', icon: '⚡', count: opportunities.length },
    { id: 'signals', label: 'Signals', icon: '📊', count: signals.length },
    { id: 'portfolio', label: 'Portfolio', icon: '💼' },
    { id: 'market', label: 'Market', icon: '📈' },
    { id: 'charts', label: 'Charts', icon: '📉' },
  ];

  return (
    <main className="min-h-screen pb-16">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎴</span>
              <div>
                <h1 className="text-xl font-bold">PokeDAO Terminal</h1>
                <p className="text-xs text-gray-500">Pokemon TCG Market Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadData}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Row */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs uppercase">Opportunities</div>
            <div className="text-2xl font-bold text-green-400">{opportunities.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs uppercase">Signals</div>
            <div className="text-2xl font-bold text-blue-400">{signals.length}</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs uppercase">Avg Spread</div>
            <div className="text-2xl font-bold text-yellow-400">
              {opportunities.length > 0
                ? `+${(opportunities.reduce((sum, o) => sum + o.spreadPct, 0) / opportunities.length).toFixed(1)}%`
                : '-'}
            </div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-gray-500 text-xs uppercase">Best Spread</div>
            <div className="text-2xl font-bold text-green-400">
              {opportunities.length > 0
                ? `+${Math.max(...opportunities.map((o) => o.spreadPct)).toFixed(1)}%`
                : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-2 border-b border-gray-800 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.icon} {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1 text-gray-400">({tab.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
            <p className="text-gray-500 text-sm mt-1">
              Make sure the API is running at localhost:3000
            </p>
          </div>
        )}

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {activeTab === 'arbitrage' && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <OpportunityTable opportunities={opportunities} loading={loading} />
              </div>
            )}

            {activeTab === 'signals' && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <SignalTable signals={signals} loading={loading} />
              </div>
            )}

            {activeTab === 'portfolio' && (
              <PortfolioPanel userId={demoUserId} />
            )}

            {activeTab === 'market' && (
              <div className="space-y-4">
                <MarketCommentaryCard />
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold mb-4">Recent Opportunities</h3>
                  <OpportunityTable
                    opportunities={opportunities.slice(0, 10)}
                    loading={loading}
                  />
                </div>
              </div>
            )}

            {activeTab === 'charts' && (
              <div className="space-y-4">
                {/* Card Search */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <label className="block text-sm text-gray-400 mb-2">
                    Search Card for Price History
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={selectedCard}
                      onChange={(e) => setSelectedCard(e.target.value)}
                      placeholder="Enter card name..."
                      className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
                    />
                    <button
                      onClick={() => setSelectedCard(selectedCard)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                    >
                      Search
                    </button>
                  </div>
                </div>

                {/* Price Chart */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <PriceChart cardName={selectedCard} />
                </div>

                {/* Quick Cards */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-3">Popular Cards</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Charizard', 'Pikachu', 'Mewtwo', 'Gengar', 'Umbreon', 'Rayquaza'].map(
                      (card) => (
                        <button
                          key={card}
                          onClick={() => setSelectedCard(card)}
                          className={`px-3 py-1 text-sm rounded border ${
                            selectedCard === card
                              ? 'bg-blue-600 border-blue-500'
                              : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          {card}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <MarketPanel />
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar />
    </main>
  );
}
