'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { fetchPriceTrend, PriceTrend, PricePoint } from '@/lib/api';

interface PriceChartProps {
  cardName: string;
  setName?: string;
  grade?: string;
}

export function PriceChart({ cardName, setName, grade }: PriceChartProps) {
  const [data, setData] = useState<PriceTrend | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPriceTrend(cardName, { setName, grade });
        setData(result);
      } catch (e: any) {
        setError(e.message || 'Failed to load price data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [cardName, setName, grade]);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        Loading price data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-64 flex items-center justify-center text-red-400">
        {error}
      </div>
    );
  }

  if (!data || !data.weeklyData || data.weeklyData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No price data available for this card
      </div>
    );
  }

  const chartData = data.weeklyData.map((point) => ({
    week: point.week,
    price: point.avgPrice / 100,
    sales: point.saleCount,
    min: point.minPrice / 100,
    max: point.maxPrice / 100,
  }));

  const trendColor = data.trend.direction === 'up' ? '#22c55e' :
    data.trend.direction === 'down' ? '#ef4444' : '#eab308';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{data.card.name}</h3>
          <p className="text-sm text-gray-500">
            {data.card.set} {data.card.grade !== 'Any' && `• ${data.card.grade}`}
          </p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${
            data.trend.direction === 'up' ? 'text-green-400' :
            data.trend.direction === 'down' ? 'text-red-400' : 'text-yellow-400'
          }`}>
            {data.trend.direction === 'up' ? '↑' : data.trend.direction === 'down' ? '↓' : '→'}
            {' '}{data.trend.strength}
          </div>
          <p className="text-xs text-gray-500">{data.stats.totalSales} sales</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={trendColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={trendColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="week"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(value) => value.split('-W')[1] ? `W${value.split('-W')[1]}` : value}
            />
            <YAxis
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(value: number, name: string) => [
                name === 'price' ? `$${value.toFixed(2)}` : value,
                name === 'price' ? 'Avg Price' : name === 'sales' ? 'Sales' : name,
              ]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={trendColor}
              fillOpacity={1}
              fill="url(#priceGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Prediction */}
      {data.trend.prediction && (
        <div className="bg-gray-800/50 rounded-lg p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Next Week Prediction</span>
            <span className="font-semibold text-blue-400">
              ${data.trend.prediction.nextWeekAvgPriceUsd}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Confidence: {data.trend.prediction.confidence}
          </div>
        </div>
      )}
    </div>
  );
}

interface TopMoversChartProps {
  gainers: Array<{
    cardName: string;
    changePercent: number;
    newAvgPriceUsd: string;
  }>;
  losers: Array<{
    cardName: string;
    changePercent: number;
    newAvgPriceUsd: string;
  }>;
}

export function TopMoversChart({ gainers, losers }: TopMoversChartProps) {
  const data = [
    ...gainers.slice(0, 5).map((g) => ({
      name: g.cardName.slice(0, 20),
      change: g.changePercent,
      price: parseFloat(g.newAvgPriceUsd),
      type: 'gainer',
    })),
    ...losers.slice(0, 5).map((l) => ({
      name: l.cardName.slice(0, 20),
      change: l.changePercent,
      price: parseFloat(l.newAvgPriceUsd),
      type: 'loser',
    })),
  ];

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: '#9ca3af', fontSize: 10 }}
            width={100}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
            formatter={(value: number) => [`${value > 0 ? '+' : ''}${value.toFixed(1)}%`, 'Change']}
          />
          <Line
            type="monotone"
            dataKey="change"
            stroke="#eab308"
            strokeWidth={2}
            dot={({ payload, ...props }) => (
              <circle
                {...props}
                fill={payload.type === 'gainer' ? '#22c55e' : '#ef4444'}
                r={4}
              />
            )}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
