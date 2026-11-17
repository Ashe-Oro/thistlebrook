import assert from 'node:assert/strict';
// Chromium may capture a cleared compositor surface after a viewport resize
// when requestAnimationFrame is stubbed. A fresh mobile page keeps the real
// presentation loop, and checks both its WebGL frame and its viewport.
export async function captureCoastMobile(browser,dir){
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 try{
  await page.goto('http://localhost:5197/?capture=1&view=beach&hour=13&seed=831');
  await page.waitForFunction(()=>window.__ready||window.__astraError,null,{timeout:120000,polling:200});assert.equal(await page.evaluate(()=>window.__astraError),undefined);
  await page.evaluate(()=>{document.querySelector('.loading').remove();__astra.setPaused(true);});await page.waitForTimeout(500);
  const result=await page.evaluate(()=>{const a=__astra,gl=a.renderer.getContext(),p=new Uint8Array(4);gl.readPixels(gl.drawingBufferWidth/2,gl.drawingBufferHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return {width:document.documentElement.scrollWidth,pixel:[...p],zoom:a.camera.zoom};});
  assert.equal(result.width,390);assert.equal(result.pixel[3],255);assert.notDeepEqual(result.pixel.slice(0,3),[232,237,227]);
  await page.screenshot({path:dir+'07-beach-mobile.png',timeout:120000});assert.deepEqual(errors,[]);return result;
 }finally{await page.close();}
}
