(function(root){'use strict';const v=root.ShitouReleaseV50;if(!v)return;
function compact(){document.title='石頭少爺Agent V9.30';document.documentElement.dataset.releaseVersion=v.code;document.querySelectorAll('.version-pill,footer strong,.tower-version').forEach(e=>{const value=e.classList.contains('version-pill')?'V9.30':'石頭少爺Agent V9.30';if(e.textContent!==value)e.textContent=value;});}
compact();document.getElementById('releaseDetails')?.remove();
document.querySelectorAll('.version-pill,footer strong').forEach(e=>new MutationObserver(compact).observe(e,{childList:true,characterData:true,subtree:true}));document.addEventListener('DOMContentLoaded',compact,{once:true});root.ShitouCompactRelease=Object.freeze({compact,displayCode:'V9.30',fullCode:v.code});
})(globalThis);
