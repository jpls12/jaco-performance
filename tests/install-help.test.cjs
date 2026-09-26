const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(userAgent,standalone=false){
 const elements=Object.fromEntries(['installAppBanner','menuInstallApp','installAppInstructions','installAppText'].map(id=>[id,{hidden:true,scrollIntoView(){}}]));
 const navigator={userAgent,standalone,maxTouchPoints:0};
 const context=vm.createContext({navigator,window:{navigator,matchMedia:()=>({matches:standalone})},document:{getElementById:id=>elements[id],addEventListener(){}},sessionStorage:{getItem:()=>null}});
 vm.runInContext(fs.readFileSync('js/bootstrap.js','utf8').split('function setupPwaExperience(){')[0],context);
 return {context,elements};
}
test('installation help remains reachable without a native prompt',async()=>{
 const {context,elements}=setup('Android Chrome');context.showInstallExperience();
 assert.equal(elements.menuInstallApp.hidden,false);
 await context.handleInstallApp();
 assert.equal(elements.installAppInstructions.hidden,false);
 assert.match(elements.installAppInstructions.textContent,/Chrome of Edge/);
});
test('iPhone gets Safari instructions; installed app hides installation',async()=>{
 const {context,elements}=setup('iPhone');await context.handleInstallApp();
 assert.match(elements.installAppInstructions.textContent,/Safari/);
 const installed=setup('iPhone',true);installed.context.showInstallExperience();
 assert.equal(installed.elements.menuInstallApp.hidden,true);
});
