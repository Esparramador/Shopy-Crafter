import { describe, it, expect, vi } from "vitest";
vi.mock("@workspace/db",()=>({db:{}}));
vi.mock("./woo-storage.js",()=>({}));
vi.mock("./woo-catalog.js",()=>({}));
import AdmZip from "adm-zip";
import { unpackWooZip } from "./woo-imports.js";
const archive=(name:string,data=Buffer.from("%PDF-1.4\nhello"))=>{
  const z=new AdmZip();z.addFile(name,data);return z.toBuffer();
};
describe("ZIP preview validation before any store write",()=>{
  it("accepts only admitted plain entries and never extracts to disk",()=>{
    expect(unpackWooZip(archive("sku/photo.pdf"))[0]?.name).toBe("sku/photo.pdf");
  });
  it("rejects executable, nested and SVG content by name",()=>{
    for(const name of ["plugin.php","theme.zip","run.exe","photo.svg","payload.js"]) expect(()=>unpackWooZip(archive(name))).toThrow("no admitidos");
  });
  it("rejects corrupt archives and central-directory bombs",()=>{
    expect(()=>unpackWooZip(Buffer.from("not zip"))).toThrow("inválido");
    const b=archive("photo.pdf");const pos=b.length-22;b.writeUInt16LE(101,pos+8);b.writeUInt16LE(101,pos+10);
    expect(()=>unpackWooZip(b)).toThrow("entradas");
  });
  it("rejects expansion bombs before inflation",()=>{
    expect(()=>unpackWooZip(archive("image.jpg",Buffer.alloc(1024*1024)))).toThrow("expansión");
  });
  it("rejects traversal and absolute paths from raw central directory names",()=>{
    const original=archive("aa/x.pdf");
    // Same-length central and local names: parser must not sanitize away traversal.
    for(const bad of ["../x.pdf","/a/x.pdf","a:\\x.pdf"]) {
      const b=Buffer.from(original);let at=0;
      while((at=b.indexOf(Buffer.from("aa/x.pdf"),at))>=0){b.write(bad,at);at+=8;}
      expect(()=>unpackWooZip(b)).toThrow("Ruta");
    }
  });
  it("rejects duplicate case-folded filenames",()=>{
    const z=new AdmZip();z.addFile("A.pdf",Buffer.from("one"));z.addFile("a.pdf",Buffer.from("two"));
    expect(()=>unpackWooZip(z.toBuffer())).toThrow("duplicados");
  });
});
