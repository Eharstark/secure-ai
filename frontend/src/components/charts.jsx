import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export const CHART_COLORS = { cyan: '#22d3ee', blue: '#5b8def', green: '#34d399', amber: '#fbbf24', rose: '#fb7185', slate: '#64748b' }
const tooltipStyle = { background: '#0d1527', border: '1px solid #26334f', borderRadius: 8, color: '#e6ebf4', fontSize: 12 }
const axisTick = { fill: '#8b9bb8', fontSize: 11 }

export function DonutChart({ data, height = 220 }) {
  const visible = data.filter((d) => d.value > 0)
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={visible} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} stroke="none">
            {visible.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e6ebf4' }} />
          <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-xs text-mist-300">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DailyBars({ data, height = 220 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#1a2540" vertical={false} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: '#26334f' }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgba(34,211,238,0.06)' }} contentStyle={tooltipStyle} formatter={(v) => [v, 'Keys created']} />
          <Bar dataKey="count" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
