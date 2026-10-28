import { createCipheriv } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptMaterialBundle, readPrivateMaterial } from "../lib/materials/week-07";

function fixture() {
  const key="12".repeat(32),iv=Buffer.alloc(12,7);
  const cipher=createCipheriv("aes-256-gcm",Buffer.from(key,"hex"),iv);
  cipher.setAAD(Buffer.from("mobile-2026-2027/week-07/private-materials/v1"));
  const body={"ushtrimet.html":{mime:"text/html",data:Buffer.from("Private test lesson").toString("base64")}};
  const data=Buffer.concat([cipher.update(JSON.stringify(body)),cipher.final()]);
  return {key,body,envelope:{iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")}};
}
describe("private teacher materials encryption",()=>{
 it("decrypts only with the correct key and rejects altered ciphertext",()=>{
  const f=fixture();expect(decryptMaterialBundle(f.envelope,f.key)).toEqual(f.body);
  expect(()=>decryptMaterialBundle(f.envelope,"13".repeat(32))).toThrow();
  const bytes=Buffer.from(f.envelope.data,"base64");bytes[0]^=1;
  expect(()=>decryptMaterialBundle({...f.envelope,data:bytes.toString("base64")},f.key)).toThrow();
  expect(()=>decryptMaterialBundle(f.envelope,"bad-key")).toThrow();
 });
 it("rejects file traversal, secrets and unknown files without loading resources",()=>{
  for(const name of ["../.env.local",".env","lecture-slides.json","key.txt","/ushtrimet.html"]){expect(readPrivateMaterial(name)).toBeNull();}
 });
});
