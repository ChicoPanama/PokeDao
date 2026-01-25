'use client';

import { useState, useEffect } from 'react';
import { fetchPortfolio, Portfolio, PortfolioHolding } from '@/lib/api';

interface PortfolioPanelProps {
  userId: string;
}

export function PortfolioPanel({ userId }: PortfolioPanelProps) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchPortfolio(userId);
        setPortfolio(data);
      } catch (e: any) {
        setError(e.message || 'Failed to load portfolio');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-800 rounded w-1/3"></div>
          <div className="h-24 bg-gray-800 rounded"></div>
          <div className="h-32 bg-gray-800 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <div className="text-red-400">{error}</div>
        <p className="text-gray-500 text-sm mt-2">
          Make sure the API is running and the user ID is valid
        </p>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        <p className="text-gray-500">No portfolio data</p>
      </div>
    );
  }

  const gainLossNum = parseFloat(portfolio.summary.totalGainLossPct);
  const isPositive = gainLossNum >= 0;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-lg font-semibold">Portfolio</h2>
        <p className="text-sm text-gray-500">{portfolio.summary.totalHoldings} holdings</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase">Cost Basis</div>
          <div className="text-xl font-bold">${portfolio.summary.totalCostBasisUsd}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase">Current Value</div>
          <div className="text-xl font-bold">${portfolio.summary.totalCurrentValueUsd}</div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase">Gain/Loss</div>
          <div className={`text-xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}${portfolio.summary.totalGainLossUsd}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <div className="text-xs text-gray-500 uppercase">Return</div>
          <div className={`text-xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{portfolio.summary.totalGainLossPct}%
          </div>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="px-4 pb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Card</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Cost</th>
                <th className="pb-2 font-medium text-right">Value</th>
                <th className="pb-2 font-medium text-right">P&L</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    No holdings yet. Add your first card!
                  </td>
                </tr>
              ) : (
                portfolio.holdings.map((holding) => (
                  <HoldingRow key={holding.id} holding={holding} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
  const gainLossNum = holding.gainLossPct ? parseFloat(holding.gainLossPct) : null;
  const isPositive = gainLossNum !== null && gainLossNum >= 0;

  return (
    <tr className="border-b border-gray-800/50 hover:bg-gray-800/30">
      <td className="py-3">
        <div className="font-medium">{holding.cardName}</div>
        <div className="text-xs text-gray-500">
          {holding.setName}
          {holding.grade && ` • ${holding.grade}`}
        </div>
      </td>
      <td className="py-3 text-right">{holding.quantity}</td>
      <td className="py-3 text-right">${holding.costBasisUsd}</td>
      <td className="py-3 text-right">
        {holding.currentValueUsd ? `$${holding.currentValueUsd}` : '-'}
      </td>
      <td className="py-3 text-right">
        {holding.gainLossPct !== null ? (
          <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
            {isPositive ? '+' : ''}{holding.gainLossPct}%
          </span>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </td>
    </tr>
  );
}

interface AddHoldingFormProps {
  userId: string;
  onAdd: () => void;
}

export function AddHoldingForm({ userId, onAdd }: AddHoldingFormProps) {
  const [cardName, setCardName] = useState('');
  const [setName, setSetName] = useState('');
  const [grade, setGrade] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardName || !costBasis) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/portfolio/${userId}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardKey: `${cardName}-${setName}-${grade}`.toLowerCase().replace(/\s+/g, '-'),
          cardName,
          setName: setName || undefined,
          grade: grade || undefined,
          costBasisCents: Math.round(parseFloat(costBasis) * 100),
        }),
      });

      if (response.ok) {
        setCardName('');
        setSetName('');
        setGrade('');
        setCostBasis('');
        onAdd();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Card Name"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          required
        />
        <input
          type="text"
          placeholder="Set Name (optional)"
          value={setName}
          onChange={(e) => setSetName(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Grade (optional)"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Cost ($)"
          value={costBasis}
          onChange={(e) => setCostBasis(e.target.value)}
          step="0.01"
          min="0"
          className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading || !cardName || !costBasis}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium"
      >
        {loading ? 'Adding...' : 'Add Holding'}
      </button>
    </form>
  );
}
