import assert from "node:assert/strict";
import test from "node:test";
import { makeSyntheticRle, RLE_UID } from "./synthetic-rle.mjs";

function findPixelOffset(bytes) {
  for (let i=132;i<bytes.length-12;i++) {
    if (bytes[i]===0xe0 && bytes[i+1]===0x7f && bytes[i+2]===0x10 &&
        bytes[i+3]===0 && bytes[i+4]===0x4f && bytes[i+5]===0x42) return i;
  }
  throw Error("pixel element missing");
}
const u32=(bytes,pos)=>new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(pos,true);

test("RLE factory writes DICM, RLE TS UID, encapsulated undefined-length PixelData",()=>{
  const bytes=makeSyntheticRle({scenario:94,layers:[1]});
  assert.equal(new TextDecoder().decode(bytes.slice(128,132)),"DICM");
  assert.ok(new TextDecoder().decode(bytes).includes(RLE_UID));
  const p=findPixelOffset(bytes);
  assert.equal(u32(bytes,p+8),0xffffffff);
  assert.deepEqual(Array.from(bytes.slice(p+12,p+16)),[0xfe,0xff,0x00,0xe0]);
  assert.equal(u32(bytes,p+16),4);
  assert.equal(u32(bytes,p+20),0);
  const frame=p+24; // following Basic Offset Table with one uint32 offset
  assert.deepEqual(Array.from(bytes.slice(frame,frame+4)),[0xfe,0xff,0x00,0xe0]);
  assert.equal(u32(bytes,frame+8),2); // RLE segment count
  assert.equal(u32(bytes,frame+12),64); // first offset from RLE header
  assert.equal(u32(bytes,frame+16),77); // second offset (64 + 13)
  assert.equal(u32(bytes,bytes.length-4),0);
});
test("two-frame RLE has non-empty Basic Offset Table pointing at the second fragment",()=>{
  const bytes=makeSyntheticRle({scenario:95,layers:[1,2]});
  const p=findPixelOffset(bytes);
  assert.equal(u32(bytes,p+16),8);
  assert.equal(u32(bytes,p+20),0);
  const offset2=u32(bytes,p+24);
  const first=p+28;
  const len=u32(bytes,first+4);
  assert.equal(offset2,8+len);
  assert.deepEqual(Array.from(bytes.slice(first+offset2,first+offset2+4)),[0xfe,0xff,0,0xe0]);
  assert.ok(len>64);
});
test("factory rejects empty and excessive frame counts",()=>{
  assert.throws(()=>makeSyntheticRle({layers:[]}));
  assert.throws(()=>makeSyntheticRle({layers:Array.from({length:9},(_,i)=>i)}));
});
