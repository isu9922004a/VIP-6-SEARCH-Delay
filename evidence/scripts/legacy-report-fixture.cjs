// R12 presentation regression coverage for the supported feature-flag rollback.
// R13 default presentation is tested separately in unified-r13.test.cjs/browser.
const R=require('../research-report-v1.js');
const legacy=a=>({...a,unifiedResearch:{state:'DISABLED'}});
module.exports={...R,...Object.fromEntries(['view','text','lines','pages'].map(k=>[k,(a,...args)=>R[k](legacy(a),...args)]))};
