import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("./crypto.js",()=>({safeDecrypt:(s:string)=>s}));
import { WooClient, WooError, resolveWooCredentials, wooId } from "./woo-client.js";
import { summarizeWooOrders, wooInventory } from "./woo-metrics.js";

const project = {id:1,shopDomain:"https://shop.example",clientId:"key",clientSecret:"secret"} as any;
function page(data:any,total:number,pages:number) { return new Response(JSON.stringify(data),{headers:{"x-wp-total":String(total),"x-wp-totalpages":String(pages)}}); }
afterEach(() => vi.unstubAllEnvs());
describe("WooCommerce isolated client",()=>{
  it("resolves the development-only Muscle Factory secret references without storing credentials",()=>{
    vi.stubEnv("NODE_ENV","development");
    vi.stubEnv("MUSCLE_FACTORY_WC_CONSUMER_KEY","ck_test_reference");
    vi.stubEnv("MUSCLE_FACTORY_WC_CONSUMER_SECRET","cs_test_reference");
    expect(resolveWooCredentials({
      shopDomain:"https://musclefactorybcn.com",
      clientId:"envref:MUSCLE_FACTORY_WC_CONSUMER_KEY",
      clientSecret:"envref:MUSCLE_FACTORY_WC_CONSUMER_SECRET",
    } as any)).toEqual({consumerKey:"ck_test_reference",consumerSecret:"cs_test_reference"});
  });
  it("rejects development secret references outside their exact environment, domain, or pair",()=>{
    vi.stubEnv("NODE_ENV","production");
    expect(()=>resolveWooCredentials({
      shopDomain:"https://musclefactorybcn.com",
      clientId:"envref:MUSCLE_FACTORY_WC_CONSUMER_KEY",
      clientSecret:"envref:MUSCLE_FACTORY_WC_CONSUMER_SECRET",
    } as any)).toThrow(WooError);
    vi.stubEnv("NODE_ENV","development");
    expect(()=>resolveWooCredentials({
      shopDomain:"https://other.example",
      clientId:"envref:MUSCLE_FACTORY_WC_CONSUMER_KEY",
      clientSecret:"envref:MUSCLE_FACTORY_WC_CONSUMER_SECRET",
    } as any)).toThrow(WooError);
    expect(()=>resolveWooCredentials({
      shopDomain:"https://musclefactorybcn.com",
      clientId:"envref:OTHER_KEY",
      clientSecret:"envref:MUSCLE_FACTORY_WC_CONSUMER_SECRET",
    } as any)).toThrow(WooError);
  });
  it("does not fall back to an unresolved secret reference",()=>{
    vi.stubEnv("NODE_ENV","development");
    vi.stubEnv("MUSCLE_FACTORY_WC_CONSUMER_KEY","");
    vi.stubEnv("MUSCLE_FACTORY_WC_CONSUMER_SECRET","");
    expect(()=>resolveWooCredentials({
      shopDomain:"https://musclefactorybcn.com",
      clientId:"envref:MUSCLE_FACTORY_WC_CONSUMER_KEY",
      clientSecret:"envref:MUSCLE_FACTORY_WC_CONSUMER_SECRET",
    } as any)).toThrow("Faltan las credenciales");
  });
  it("fetches every page and preserves filters",async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(page([{id:1}],2,2)).mockResolvedValueOnce(page([{id:2}],2,2));
    const wc=new WooClient(project,fetcher);
    expect(await wc.all("/orders",{status:"processing"})).toHaveLength(2);
    expect(fetcher.mock.calls[1]![0]).toContain("page=2");
    expect(fetcher.mock.calls[1]![0]).toContain("status=processing");
  });
  it("never calls a truncated list complete",async()=>{
    const wc=new WooClient(project,vi.fn().mockResolvedValue(page([{id:1}],2,2)));
    await expect(wc.all("/orders",{},1)).rejects.toThrow("incompleta");
  });
  it("rejects missing pagination, wrong response shape and changing totals",async()=>{
    await expect(new WooClient(project,vi.fn().mockResolvedValue(new Response("[]"))).all("/products")).rejects.toThrow("paginación");
    await expect(new WooClient(project,vi.fn().mockResolvedValue(page({},1,1))).all("/products")).rejects.toThrow("paginación");
    const wc=new WooClient(project,vi.fn().mockResolvedValueOnce(page([{id:1}],2,2)).mockResolvedValueOnce(page([{id:2}],3,2)));
    await expect(wc.all("/orders")).rejects.toThrow("cambió");
  });
  it("does not replay writes on 500, rejects redirects and hides upstream personal data",async()=>{
    const transport=vi.fn().mockResolvedValue(new Response("customer@example.com secret",{status:500}));
    const wc=new WooClient(project,transport);
    await expect(wc.request("POST","/products",{})).rejects.not.toThrow("customer@example.com");
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport.mock.calls[0]![1].redirect).toBe("error");
  });
  it("does not allow another origin, insecure URL, path traversal or invalid IDs",async()=>{
    expect(()=>new WooClient({...project,shopDomain:"http://store.example"})).toThrow("HTTPS");
    expect(()=>new WooClient({...project,shopDomain:"https://user:pass@store.example"})).toThrow("credenciales");
    await expect(new WooClient(project).raw("GET","//elsewhere.example")).rejects.toThrow("Ruta");
    await expect(new WooClient(project).raw("GET","/products/../orders")).rejects.toThrow("Ruta");
    for(const id of [0,-1,NaN,"abc",1.5]) expect(()=>wooId(id)).toThrow();
  });
});
const order=(overrides:any={})=>({id:1,status:"completed",date_paid_gmt:"2026-01-02T00:00:00",date_created_gmt:"2026-01-01T00:00:00",currency:"EUR",total:"121.00",total_tax:"21.00",shipping_total:"10.00",refunds:[],...overrides});
describe("explicit Woo revenue cohort",()=>{
  it("includes paid processing, completed and fully refunded; excludes unpaid and failed",()=>{
    const out=summarizeWooOrders([order(),order({status:"processing"}),order({status:"refunded",refunds:[{total:"-121.00"}]}),order({status:"pending"}),order({date_paid_gmt:null}),order({status:"failed"})],"EUR");
    expect(out).toMatchObject({revenue30d:242,gross30d:363,refunds30d:121,orders30d:3,taxes30d:63,shipping30d:30});
  });
  it("subtracts partial refunds, retains tax/shipping in gross and uses no binary-float accumulation",()=>{
    expect(summarizeWooOrders([order({total:"0.10",refunds:[]}),order({total:"0.20",refunds:[]})],"EUR").revenue30d).toBe(.3);
    expect(summarizeWooOrders([order({refunds:[{total:"-20.00"}]})],"EUR").revenue30d).toBe(101);
  });
  it("rejects mixed currencies and missing or malformed money rather than invent zero",()=>{
    expect(()=>summarizeWooOrders([order({currency:"USD"})],"EUR")).toThrow("monedas");
    expect(()=>summarizeWooOrders([order({total:null})],"EUR")).toThrow("ausente");
    expect(()=>summarizeWooOrders([order({total:"unknown"})],"EUR")).toThrow("válido");
    expect(()=>summarizeWooOrders([order({refunds:[{total:"-122"}]})],"EUR")).toThrow("superiores");
  });
  it("valid empty reads are really zero",()=>{
    expect(summarizeWooOrders([],"EUR")).toMatchObject({revenue30d:0,orders30d:0,aov:0});
  });
});
describe("variation-aware inventory",()=>{
  it("counts published variations and simple products but not their variable parent twice",async()=>{
    const wc={all:vi.fn().mockResolvedValue([
      {id:11,status:"publish",stock_status:"outofstock",stock_quantity:0,manage_stock:true},
      {id:12,status:"publish",stock_status:"instock",stock_quantity:2,manage_stock:true,low_stock_amount:0},
      {id:13,status:"draft",stock_status:"outofstock"},
    ])} as any;
    const r=await wooInventory(wc,[
      {id:1,type:"variable",status:"publish",name:"Parent",manage_stock:true,stock_quantity:50},
      {id:2,type:"simple",status:"publish",stock_status:"instock",stock_quantity:3,manage_stock:true,low_stock_amount:5},
      {id:3,type:"simple",status:"private",stock_status:"outofstock"},
    ]);
    expect(r).toMatchObject({totalTracked:3,outOfStockCount:1,lowStockCount:1});
    expect(r.outOfStock[0]).toMatchObject({id:11,parentId:1});
    expect(r.lowStock[0]?.id).toBe(2);
  });
  it("does not present variable stock as complete after variation fetch failure",async()=>{
    const wc={all:vi.fn().mockRejectedValue(new Error("permission denied"))} as any;
    await expect(wooInventory(wc,[{id:1,type:"variable",status:"publish"}])).rejects.toThrow("permission");
  });
});
