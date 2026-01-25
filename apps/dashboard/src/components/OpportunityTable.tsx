'use client';

import { ArbitrageOpportunity } from '@/lib/api';

interface Props {
  opportunities: ArbitrageOpportunity[];
  loading?: boolean;
}

export function OpportunityTable({ opportunities, loading }: Props) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-800 rounded mb-2"></div>
        <div className="h-8 bg-gray-800 rounded mb-2"></div>
        <div className="h-8 bg-gray-800 rounded mb-2"></div>
      </div>
    );
  }

  if (!opportunities.length) {
    return (
      <div className="text-gray-500 text-center py-8">
        No arbitrage opportunities found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            <th className="text-left py-3 px-2">Card</th>
            <th className="text-left py-3 px-2">Grade</th>
            <th className="text-right py-3 px-2">Buy</th>
            <th className="text-center py-3 px-2">→</th>
            <th className="text-right py-3 px-2">Sell</th>
            <th className="text-right py-3 px-2">Spread</th>
            <th className="text-right py-3 px-2">Profit</th>
            <th className="text-center py-3 px-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.map((opp, i) => (
            <tr
              key={`${opp.cardId}-${i}`}
              className="border-b border-gray-800 hover:bg-gray-900"
            >
              <td className="py-3 px-2">
                <div className="font-medium">{opp.cardName}</div>
                <div className="text-xs text-gray-500">{opp.setName}</div>
              </td>
              <td className="py-3 px-2 text-gray-400">{opp.grade || 'Raw'}</td>
              <td className="py-3 px-2 text-right">
                <div className="text-green-400">${opp.buyPrice.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{opp.buyVenue}</div>
              </td>
              <td className="py-3 px-2 text-center text-gray-500">→</td>
              <td className="py-3 px-2 text-right">
                <div className="text-blue-400">${opp.sellPrice.toFixed(2)}</div>
                <div className="text-xs text-gray-500">{opp.sellVenue}</div>
              </td>
              <td className="py-3 px-2 text-right">
                <span
                  className={`font-mono ${
                    opp.spreadPct >= 20
                      ? 'text-green-400'
                      : opp.spreadPct >= 15
                      ? 'text-yellow-400'
                      : 'text-gray-400'
                  }`}
                >
                  +{opp.spreadPct.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-2 text-right text-green-400">
                ${(opp.netProfitCents / 100).toFixed(2)}
              </td>
              <td className="py-3 px-2 text-center">
                {opp.buyUrl && (
                  <a
                    href={opp.buyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                  >
                    Buy
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
