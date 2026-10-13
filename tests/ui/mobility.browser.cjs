// BROWSER_EXECUTABLE=/path/to/chromium node tests/ui/mobility.browser.cjs
const {chromium}=require('playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.join(process.cwd(),pathname==='/'?'index.html':pathname);
 try{const content=fs.readFileSync(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(content);}catch{res.statusCode=404;res.end();}
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{}),args:['--no-sandbox','--disable-gpu']});
 try{
 for(const width of [320,390,430]){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r.request().url().endsWith('/workouts')?{workouts:{}}:{})}));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>document.querySelectorAll('.mob-routine').length===8);
 await page.evaluate(()=>{
 customWorkouts={};serverWorkouts={};races={};profile.availability=Object.fromEntries(DAY_KEYS.map(k=>[k,{available:true,maxMinutes:90,preference:'rustig'}]));profile.weeklyAvailability={};
 saveObject(SUPPORT_SETTINGS_KEY,{enabled:false,strength:[],mobility:[],autoPlace:false});openMobilityLibrary();
 });
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){
  await page.screenshot({path:'/tmp/jaco-mobility-overflow.png'});
  console.log(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('body *')].filter(e=>e.scrollWidth>e.clientWidth+1&&e.getBoundingClientRect().width>0).map(e=>({tag:e.tagName,id:e.id,cls:e.className,width:e.clientWidth,scroll:e.scrollWidth})).slice(0,25)})));
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Library overflow at ${width}px`);
 if(width===390)await page.screenshot({path:'/tmp/jaco-mobility-library.png'});
 await page.getByRole('button',{name:'Kies & plan'}).first().click();await page.locator('#mobPlanForm select').selectOption('5');await page.getByRole('button',{name:'Inplannen',exact:true}).click();
 await page.evaluate(()=>switchView('today'));
 await page.locator('#supportToday').getByRole('button',{name:'Start begeleide sessie'}).click();
 assert.equal(await page.locator('#mobilityDialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,`Player overflow at ${width}px`);
 const rect=await page.locator('#mobPause').boundingBox();assert.ok(rect.height>=44);
 await page.locator('#mobPause').click();await page.evaluate(()=>{mobilityActive.startedAt=Date.now()-11000;mobilityTick();});
 await page.locator('#mobPause').click();await page.getByRole('button',{name:'Sluiten & bewaren'}).click();
 await page.locator('#mobilityResume button').click();assert.ok(await page.locator('#mobilityDialog').isVisible());
 if(width===390)await page.screenshot({path:'/tmp/jaco-mobility-player.png'});
 await page.getByRole('button',{name:'Oefening overslaan',exact:true}).click();await page.getByRole('button',{name:'Stoppen & opslaan'}).click();
 assert.equal(await page.locator('#mobilityDialog').evaluate(el=>el.scrollWidth>el.clientWidth),false,`Feedback overflow at ${width}px`);
 assert.equal(errors.length,0,errors.join('\n'));await page.close();
 }
 console.log('PASS: Chromium mobile viewports 320/390/430px, library/planning/Today/player/feedback, no horizontal overflow, 44px+ primary control, pause/close/resume/skip, no JavaScript exceptions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
