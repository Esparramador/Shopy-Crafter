import { useRoute } from "wouter";
import { GlassCard } from "@/components/ui/GlassCard";
import { useGetFinancialDashboard } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingUp, AlertTriangle, Scale } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const mockChartData = [
  { name: 'Lun', revenue: 4000, margin: 2400 },
  { name: 'Mar', revenue: 3000, margin: 1398 },
  { name: 'Mie', revenue: 2000, margin: 9800 },
  { name: 'Jue', revenue: 2780, margin: 3908 },
  { name: 'Vie', revenue: 1890, margin: 4800 },
  { name: 'Sab', revenue: 2390, margin: 3800 },
  { name: 'Dom', revenue: 3490, margin: 4300 },
];

export default function PricingPage() {
  const [, params] = useRoute("/projects/:id/pricing");
  const projectId = parseInt(params?.id || "0");
  
  const { data, isLoading } = useGetFinancialDashboard(projectId);

  if (isLoading) return <div className="p-12 text-center">Cargando...</div>;

  const dashboard = data || {
    grossRevenue: 24500,
    totalCogs: 9800,
    grossProfit: 14700,
    grossMarginPct: 60,
    netMarginPct: 22,
    aov: 85.50,
    productProfitability: [
      { productId: "1", title: "Bomber Jacket", unitsSold: 45, revenue: 4005, cogs: 1200, grossProfit: 2805, marginPct: 70, grade: "A" },
      { productId: "2", title: "Sneakers X", unitsSold: 120, revenue: 10800, cogs: 6000, grossProfit: 4800, marginPct: 44, grade: "C" }
    ],
    alerts: ["Sneakers X tiene margen < 50%", "CAC de campaña Meta subió 15%"]
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Economista IA (Pricing)</h1>
          <p className="text-muted-foreground mt-1">Dashboard de P&L, márgenes y optimización de precios.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Revenue Bruto (30d)</div>
          <div className="text-3xl font-bold text-foreground">{formatCurrency(dashboard.grossRevenue)}</div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Gross Profit</div>
          <div className="text-3xl font-bold text-green-400">{formatCurrency(dashboard.grossProfit)}</div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-2">Margen Neto %</div>
          <div className="text-3xl font-bold text-primary">{dashboard.netMarginPct}%</div>
        </GlassCard>
        <GlassCard className="p-6">
          <div className="text-sm text-muted-foreground mb-2">AOV (Ticket Medio)</div>
          <div className="text-3xl font-bold text-blue-400">{formatCurrency(dashboard.aov)}</div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-6 lg:col-span-2">
          <h2 className="text-xl font-bold text-foreground mb-6">Evolución de Beneficios</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5b4eff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#5b4eff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#666" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `€${val}`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f0f1a', borderColor: '#1f1f2e', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#5b4eff" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <div className="space-y-6">
          <GlassCard className="p-6 bg-red-500/5 border-red-500/20">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h2 className="text-lg font-bold text-foreground">Alertas de Margen</h2>
            </div>
            <div className="space-y-3">
              {dashboard.alerts.map((alert, i) => (
                <div key={i} className="text-sm text-red-200 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  {alert}
                </div>
              ))}
            </div>
          </GlassCard>
          
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Scale className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Acciones IA</h2>
            </div>
            <div className="space-y-3">
              <button className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors">
                Revisar COGS del Catálogo
              </button>
              <button className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-left px-4 py-3 rounded-xl text-sm font-medium transition-colors">
                Scraping de Competidores
              </button>
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard className="p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h2 className="text-xl font-bold text-foreground">Rentabilidad por Producto</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground">
              <tr>
                <th className="p-4 font-medium">Producto</th>
                <th className="p-4 font-medium text-right">Ventas</th>
                <th className="p-4 font-medium text-right">Revenue</th>
                <th className="p-4 font-medium text-right">COGS Total</th>
                <th className="p-4 font-medium text-right">Margen</th>
                <th className="p-4 font-medium text-center">Grade</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {dashboard.productProfitability.map((p) => (
                <tr key={p.productId} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-4 font-medium text-foreground">{p.title}</td>
                  <td className="p-4 text-right text-muted-foreground">{p.unitsSold}</td>
                  <td className="p-4 text-right text-foreground">{formatCurrency(p.revenue)}</td>
                  <td className="p-4 text-right text-red-400">{formatCurrency(p.cogs)}</td>
                  <td className="p-4 text-right font-bold text-green-400">{p.marginPct}%</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.marginPct > 60 ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {p.grade}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-primary hover:underline font-medium text-xs">Optimizar Precio</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
