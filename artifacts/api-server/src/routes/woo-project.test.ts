import { describe,it,expect,vi,beforeAll,afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
const mock=vi.hoisted(()=>({find:vi.fn()}));
vi.mock("@workspace/db",()=>({db:{query:{projectsTable:{findFirst:mock.find}}},projectsTable:{id:"id"},usersTable:{}}));
vi.mock("../lib/crypto.js",()=>({safeDecrypt:(v:string)=>v}));
vi.mock("../lib/woo-storage.js",()=>({getWooJson:vi.fn(),wooUpload:vi.fn(),wooObject:vi.fn()}));
vi.mock("../lib/woo-imports.js",()=>({previewWooImport:vi.fn(),applyWooImport:vi.fn()}));
vi.mock("../lib/woo-catalog.js",async(importOriginal)=>{
  const original=await importOriginal<any>();
  return {...original,wooSchema:vi.fn(async()=>({page:{},per_page:{},search:{},status:{enum:["draft","publish"]}}))};
});
import router from "./woo-project.js";
let server:Server, origin:string;
beforeAll(async()=>{
  const app=express();app.use(express.json());
  app.use((req:any,_res,next)=>{
    // Test-only session fixture, never installed in the running application.
    req.session=req.headers["x-test-role"]?{userId:"test",role:req.headers["x-test-role"]}:{};
    next();
  });
  app.use("/api",router);
  server=app.listen(0,"127.0.0.1");
  await new Promise<void>(r=>server.once("listening",r));
  origin=`http://127.0.0.1:${(server.address() as any).port}`;
});
afterAll(()=>new Promise<void>((resolve)=>server.close(()=>resolve())));
describe("Woo hub authorization and invalid inputs",()=>{
  it("blocks anonymous and client sessions before resolving a requested project",async()=>{
    for(const role of ["","client"]){
      const r=await fetch(`${origin}/api/admin/woo/project/999/resources/products`,{headers:role?{"x-test-role":role}:{}});
      expect(r.status).toBe(403);
    }
    expect(mock.find).not.toHaveBeenCalled();
  });
  it("does not fall back to another store for a missing or wrong-platform project",async()=>{
    mock.find.mockResolvedValueOnce(null).mockResolvedValueOnce({platformType:"stripe"});
    for(const expected of [404,400]) {
      const r=await fetch(`${origin}/api/admin/woo/project/999/overview`,{headers:{"x-test-role":"admin"}});
      expect(r.status).toBe(expected);
    }
  });
  it("rejects multi-status filters locally without a WooCommerce request",async()=>{
    mock.find.mockResolvedValue({id:1,platformType:"woocommerce",shopDomain:"https://shop.example",clientId:"key",clientSecret:"secret"});
    const r=await fetch(`${origin}/api/admin/woo/project/1/resources/orders?status=processing,completed`,{headers:{"x-test-role":"admin"}});
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("un solo estado");
  });
  it("rejects mutations without confirmation or an operation identifier",async()=>{
    mock.find.mockResolvedValue({id:1,platformType:"woocommerce",shopDomain:"https://shop.example",clientId:"key",clientSecret:"secret"});
    const r=await fetch(`${origin}/api/admin/woo/project/1/resources/products`,{method:"POST",headers:{"x-test-role":"admin","Content-Type":"application/json"},body:JSON.stringify({data:{name:"test"}})});
    expect(r.status).toBe(400);
  });
});
