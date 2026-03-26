import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Filter } from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  type: "domain" | "insight";
  label: string;
  domain?: string;
  depth?: number;
  totalInsights?: number;
  confidence?: number;
  insightType?: string;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  strength: number;
  type: "domain-insight" | "cross-connection";
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const DOMAIN_COLORS: Record<string, string> = {
  ecommerce: "#c8a84b",
  shopify_technical: "#5b4eff",
  financial_analysis: "#2dd49f",
  trading_markets: "#f97316",
  investment: "#06b6d4",
  marketing: "#e84558",
  sales: "#8b5cf6",
  design_ux: "#ec4899",
  merchandising: "#84cc16",
  seo_content: "#14b8a6",
  logistics: "#f59e0b",
  paid_media: "#ef4444",
  consumer_psychology: "#a855f7",
  pricing_science: "#10b981",
  photography: "#f472b6",
  video_content: "#fb923c",
  copywriting: "#38bdf8",
  social_media: "#c084fc",
  ai_technology: "#22d3ee",
  legal_compliance: "#94a3b8",
  sustainability: "#4ade80",
  customer_service: "#fbbf24",
  analytics_data: "#818cf8",
  international: "#fb7185",
  trends_innovation: "#e879f9",
  supply_chain: "#a3e635",
  brand_strategy: "#fcd34d",
  email_automation: "#2dd4bf",
  marketplace: "#f87171",
  taxes_accounting: "#9ca3af",
  general: "#6b7280",
};

export default function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>("");
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/shopybrain/knowledge-graph`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = 500;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    svg.attr("width", width).attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    let filteredNodes = data.nodes;
    let filteredEdges = data.edges;

    if (selectedDomain) {
      const domainNodeId = `domain-${selectedDomain}`;
      filteredNodes = data.nodes.filter(n =>
        n.id === domainNodeId || n.domain === selectedDomain
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = data.edges.filter(e => {
        const srcId = typeof e.source === "string" ? e.source : e.source.id;
        const tgtId = typeof e.target === "string" ? e.target : e.target.id;
        return nodeIds.has(srcId) && nodeIds.has(tgtId);
      });
    }

    if (minConfidence > 0) {
      filteredNodes = filteredNodes.filter(n =>
        n.type === "domain" || (n.confidence ?? 1) >= minConfidence
      );
      const nodeIds = new Set(filteredNodes.map(n => n.id));
      filteredEdges = filteredEdges.filter(e => {
        const srcId = typeof e.source === "string" ? e.source : e.source.id;
        const tgtId = typeof e.target === "string" ? e.target : e.target.id;
        return nodeIds.has(srcId) && nodeIds.has(tgtId);
      });
    }

    const nodes: GraphNode[] = filteredNodes.map(n => ({ ...n }));
    const edges: GraphEdge[] = filteredEdges.map(e => ({ ...e }));

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force("link", d3.forceLink<GraphNode, any>(edges)
        .id((d: any) => d.id)
        .distance((d: any) => d.type === "domain-insight" ? 60 : 120)
        .strength((d: any) => d.strength * 0.3))
      .force("charge", d3.forceManyBody().strength((d: any) => d.type === "domain" ? -300 : -40))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => d.type === "domain" ? 30 : 8));

    const link = g.append("g")
      .selectAll("line")
      .data(edges)
      .join("line")
      .attr("stroke", (d: any) => d.type === "cross-connection" ? "#c8a84b44" : "#ffffff12")
      .attr("stroke-width", (d: any) => d.type === "cross-connection" ? 1.5 : 0.5)
      .attr("stroke-dasharray", (d: any) => d.type === "cross-connection" ? "4,4" : "none");

    const node = g.append("g")
      .selectAll<SVGCircleElement, GraphNode>("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d) => d.type === "domain" ? 16 + (d.depth ?? 0) * 0.12 : 3 + (d.confidence ?? 0.5) * 5)
      .attr("fill", (d) => {
        const color = DOMAIN_COLORS[d.domain ?? "general"] ?? "#6b7280";
        return d.type === "domain" ? color : color + "88";
      })
      .attr("stroke", (d) => d.type === "domain" ? "#fff" : "none")
      .attr("stroke-width", (d) => d.type === "domain" ? 2 : 0)
      .style("cursor", "pointer")
      .on("mouseover", function (_event, d) {
        d3.select(this).attr("stroke", "#c8a84b").attr("stroke-width", 3);
        const rect = container.getBoundingClientRect();
        const x = (d.x ?? 0);
        const y = (d.y ?? 0);
        setTooltip({
          x: x,
          y: y - 25,
          content: d.type === "domain"
            ? `${d.label} (${d.depth}% depth, ${d.totalInsights} insights)`
            : `${d.label} (${Math.round((d.confidence ?? 0.5) * 100)}% confidence)`,
        });
      })
      .on("mouseout", function (_event, d) {
        d3.select(this)
          .attr("stroke", d.type === "domain" ? "#fff" : "none")
          .attr("stroke-width", d.type === "domain" ? 2 : 0);
        setTooltip(null);
      });

    const domainLabels = g.append("g")
      .selectAll("text")
      .data(nodes.filter(n => n.type === "domain"))
      .join("text")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => 16 + (d.depth ?? 0) * 0.12 + 14)
      .attr("fill", "#aaa")
      .attr("font-size", 9)
      .attr("font-weight", 600)
      .attr("pointer-events", "none")
      .text((d) => {
        const label = d.label ?? d.domain ?? "";
        return label.split(" · ")[0].slice(0, 18);
      });

    const drag = d3.drag<SVGCircleElement, GraphNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(drag);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d) => d.x ?? 0)
        .attr("cy", (d) => d.y ?? 0);

      domainLabels
        .attr("x", (d) => d.x ?? 0)
        .attr("y", (d) => d.y ?? 0);
    });

    return () => {
      simulation.stop();
    };
  }, [data, selectedDomain, minConfidence]);

  const domains = data?.nodes.filter(n => n.type === "domain") ?? [];

  if (loading) {
    return (
      <div className="glass-card" style={{ height: 550, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)" }}>
        Loading knowledge graph...
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--bdr)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={14} color="var(--gold)" />
          <span style={{ fontSize: 13, fontWeight: 700 }}>Knowledge Graph</span>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            {data?.nodes.length ?? 0} nodos · {data?.edges.length ?? 0} conexiones
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <select
            value={selectedDomain}
            onChange={e => setSelectedDomain(e.target.value)}
            style={{
              fontSize: 11, padding: "4px 8px", borderRadius: 6,
              background: "var(--ink3)", border: "1px solid var(--bdr)", color: "var(--t)",
            }}
          >
            <option value="">Todos los dominios</option>
            {domains.map(d => (
              <option key={d.id} value={d.domain}>{d.label?.split(" · ")[0]}</option>
            ))}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--t3)" }}>Min. confianza:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={minConfidence}
              onChange={e => setMinConfidence(parseFloat(e.target.value))}
              style={{ width: 80, accentColor: "var(--gold)" }}
            />
            <span style={{ fontSize: 11, color: "var(--gold)", fontWeight: 600 }}>
              {Math.round(minConfidence * 100)}%
            </span>
          </div>
        </div>
      </div>
      <div ref={containerRef} style={{ position: "relative", background: "var(--ink1)" }}>
        <svg ref={svgRef} style={{ width: "100%", height: 500 }} />
        {tooltip && (
          <div style={{
            position: "absolute", left: tooltip.x, top: tooltip.y,
            transform: "translate(-50%, -100%)",
            background: "rgba(0,0,0,0.85)", color: "#fff",
            padding: "6px 10px", borderRadius: 6, fontSize: 11,
            whiteSpace: "nowrap", pointerEvents: "none",
            border: "1px solid var(--gold)",
            zIndex: 10,
          }}>
            {tooltip.content}
          </div>
        )}
      </div>
    </div>
  );
}
