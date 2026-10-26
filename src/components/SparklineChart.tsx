"use client";

import { ResponsiveContainer, LineChart, Line } from "recharts";

interface Props {
  data: number[];
  positive: boolean;
}

export default function SparklineChart({ data, positive }: Props) {
  const chartData = data.map((v) => ({ v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="v"
          dot={false}
          strokeWidth={1.5}
          stroke={positive ? "#22c55e" : "#ef4444"}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
