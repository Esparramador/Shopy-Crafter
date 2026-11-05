import { describe,it,expect,vi,beforeEach } from "vitest";
const store=vi.hoisted(()=>new Map<string,any>());
vi.mock("./crypto.js",()=>({safeDecrypt:(s:string)=>s}));
vi.mock("./woo-storage.js",()=>({
  putWooJson:vi.fn(async(pid:number,key:string,value:any,createOnly:boolean)=>{
    const k=`${pid}/${key}`;
    if(createOnly && store.has(k)) throw Object.assign(new Error("exists"),{code:412});
    store.set(k,structuredClone(value));
  }),
  getWooJson:vi.fn(async(pid:number,key:string)=>store.get(`${pid}/${key}`)),
}));
import { WooClient } from "./woo-client.js";
import { verifiedWooWrite, validateWooWrite } from "./woo-catalog.js";
const project={id:1,shopDomain:"https://shop.example",clientId:"key",clientSecret:"secret"} as any;
const op="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const schema={endpoints:[{methods:["POST","PUT"],args:{
  name:{type:"string"},status:{type:"string",enum:["draft","publish"]},
  regular_price:{type:"string"},manage_stock:{type:"boolean"},stock_quantity:{type:["integer","null"]},
  images:{type:"array",items:{type:"object",properties:{id:{type:"integer"},src:{type:"string"}}}},
}}]};
function client(handle:(method:string,path:string,body:any)=>any) {
  const transport=vi.fn(async(url:any,init:any)=>{
    const path=new URL(url).pathname.replace("/wp-json/wc/v3","");
    if(init.method==="OPTIONS")return new Response(JSON.stringify(schema));
    const result=handle(init.method,path,init.body?JSON.parse(init.body):undefined);
    return result instanceof Response ? result : new Response(JSON.stringify(result));
  });
  return {wc:new WooClient(project,transport),transport};
}
beforeEach(()=>store.clear());
describe("verified and idempotent Woo writes",()=>{
  it("creates once, verifies by GET, and refreshes a successful retry without another POST",async()=>{
    const {wc,transport}=client(()=>({id:5,name:"Test",status:"draft"}));
    const r=await verifiedWooWrite(wc,"products","/products","POST",{name:"Test",status:"draft"},op);
    expect(r).toMatchObject({state:"verified",entityId:5,result:{id:5}});
    await verifiedWooWrite(wc,"products","/products","POST",{name:"Test",status:"draft"},op);
    expect(transport.mock.calls.filter(c=>c[1].method==="POST")).toHaveLength(1);
    expect(transport.mock.calls.filter(c=>c[1].method==="GET")).toHaveLength(2);
  });
  it("blocks same operation ID with different data",async()=>{
    const {wc}=client(()=>({id:5,name:"Test"}));
    await verifiedWooWrite(wc,"products","/products","POST",{name:"Test"},op);
    await expect(verifiedWooWrite(wc,"products","/products","POST",{name:"Other"},op)).rejects.toThrow("distintos");
  });
  it("does not resend an uncertain POST after an upstream 500",async()=>{
    const {wc,transport}=client(()=>new Response("failed",{status:500}));
    await expect(verifiedWooWrite(wc,"products","/products","POST",{name:"Test"},op)).rejects.toThrow("500");
    await expect(verifiedWooWrite(wc,"products","/products","POST",{name:"Test"},op)).rejects.toThrow("incierta");
    expect(transport.mock.calls.filter(c=>c[1].method==="POST")).toHaveLength(1);
  });
  it("refuses success if the read-back disagrees",async()=>{
    const {wc}=client((method)=>({id:5,name:method==="GET"?"Old":"Test"}));
    await expect(verifiedWooWrite(wc,"products","/products/5","PUT",{name:"Test"},op)).rejects.toThrow("confirmó");
    expect(store.get(`1/operations/${op}.json`).state).toBe("uncertain");
  });
  it("validates fields, numeric money and nested properties against the live schema",async()=>{
    const {wc}=client(()=>({}));
    for(const data of [{regular_price:"NaN"},{manage_stock:"yes"},{status:"unknown"},{meta_data:[]},{images:[{file:"/etc/passwd"}]},{stock_quantity:1.2}]) {
      await expect(validateWooWrite(wc,"products","/products","PUT",data)).rejects.toThrow();
    }
    await expect(validateWooWrite(wc,"products","/products","PUT",{regular_price:"12.50",stock_quantity:null})).resolves.toBeUndefined();
  });
});
