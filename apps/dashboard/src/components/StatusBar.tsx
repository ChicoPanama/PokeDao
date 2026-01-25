'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, HealthStatus } from '@/lib/api';

export function StatusBar() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const status = await fetchHealth();
        setHealth(status);
        setLastUpdate(new Date());
      } catch (e) {
        setHealth({ status: 'error', redis: 'error' });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColor = health?.status === 'ok' ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-2 text-xs">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-gray-400">
              API: {health?.status || 'checking...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${health?.redis === 'PONG' ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="text-gray-400">
              Redis: {health?.redis || '-'}
            </span>
          </div>
        </div>
        <div className="text-gray-500">
          {lastUpdate && `Last update: ${lastUpdate.toLocaleTimeString()}`}
        </div>
      </div>
    </div>
  );
}
