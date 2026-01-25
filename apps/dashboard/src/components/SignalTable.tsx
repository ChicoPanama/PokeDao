'use client';

import { Signal } from '@/lib/api';

interface Props {
  signals: Signal[];
  loading?: boolean;
}

export function SignalTable({ signals, loading }: Props) {
  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-800 rounded mb-2"></div>
        <div className="h-8 bg-gray-800 rounded mb-2"></div>
        <div className="h-8 bg-gray-800 rounded mb-2"></div>
      </div>
    );
  }

  if (!signals.length) {
    return (
      <div className="text-gray-500 text-center py-8">
        No signals found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-800">
            <th className="text-left py-3 px-2">Card</th>
            <th className="text-right py-3 px-2">Edge</th>
            <th className="text-right py-3 px-2">Confidence</th>
            <th className="text-left py-3 px-2">Thesis</th>
            <th className="text-center py-3 px-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr
              key={signal.id}
              className="border-b border-gray-800 hover:bg-gray-900"
            >
              <td className="py-3 px-2">
                <div className="font-medium">{signal.cardName || signal.cardId}</div>
                {signal.setCode && (
                  <div className="text-xs text-gray-500">
                    {signal.setCode} #{signal.cardNumber}
                  </div>
                )}
              </td>
              <td className="py-3 px-2 text-right">
                <span
                  className={`font-mono font-bold ${
                    signal.edgePct >= 20
                      ? 'text-green-400'
                      : signal.edgePct >= 15
                      ? 'text-yellow-400'
                      : 'text-gray-400'
                  }`}
                >
                  +{signal.edgePct.toFixed(1)}%
                </span>
              </td>
              <td className="py-3 px-2 text-right">
                <div className="flex items-center justify-end gap-1">
                  <div className="w-16 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${signal.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {(signal.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
              <td className="py-3 px-2 text-gray-400 max-w-xs truncate">
                {signal.thesis || '-'}
              </td>
              <td className="py-3 px-2 text-center">
                {signal.listingUrl && (
                  <a
                    href={signal.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    Open
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
