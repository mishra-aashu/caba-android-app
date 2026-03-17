const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-IMuJR7Rb.js","assets/vendor-ui-C9SKRs7W.js","assets/vendor-react-BcsPgoup.js","assets/vendor-supabase-BZ0N5lZN.js","assets/vendor-query-BQ1Yi_ak.js","assets/index-D_zN1tUP.css","assets/LandingPage-Dw_8pfki.js","assets/AppName-qxkHKfGg.js","assets/AppName-BbtBD1tR.css","assets/LandingPage-CUIbdkj0.css","assets/Login-wE01KvFm.js","assets/Login-BKTjdBs-.css","assets/DownloadAPK-Ba8LoS69.js","assets/useAppVersions-ERuGqRuB.js","assets/Terms-Hfce-xzX.js","assets/Privacy-DGt31oRc.js","assets/About-BnAmT10Q.js","assets/versionUtils-C1D8PNZp.js","assets/About-BNHYYKvc.css","assets/AuthenticatedApp-ab1O5iC1.js","assets/AuthenticatedApp-CGHs7U8B.css"])))=>i.map(i=>d[i]);
import{C as B,_ as j,f as J,o as ee,c as te}from"./index-IMuJR7Rb.js";import{j as c,a as ae,m as se,w as re,b1 as oe,X as ie}from"./vendor-ui-C9SKRs7W.js";import{r as o,b as ne,N as H,d as le,e as N}from"./vendor-react-BcsPgoup.js";const ce=300*1e3,de=4e3,ue=5e3,F="ota-target-url",S="ota-just-refreshed",z="https://caba-android-app.vercel.app",me=()=>{const[e,t]=o.useState(!1),[a,r]=o.useState(!1),[i,n]=o.useState(!1),s=o.useRef(null),l=o.useRef(null),d=o.useRef(Date.now()),p=o.useRef(!1),m=o.useRef(B.isNativePlatform());o.useEffect(()=>{const b=document.querySelector('meta[name="build-time"]')?.content||null;if(s.current=b,!b)console.error(`[AutoRefresh] ❌ CRITICAL: <meta name="build-time"> not found!
This means version detection will NOT work.
Make sure index.html has: <meta name="build-time" content="<%= buildTime %>" />
And vite.config.js has createHtmlPlugin with buildTime data.`);else{const h=new Date(Number(b)).toLocaleString();console.log(`[AutoRefresh] Local build: ${b} (${h})`),console.log(`[AutoRefresh] Platform: ${m.current?"Native (Capacitor)":"Web"}`)}ee(()=>{if(p.current=!0,sessionStorage.getItem(S)){sessionStorage.removeItem(S),console.log("[AutoRefresh] SW update detected, but just refreshed — ignoring");return}console.log("[AutoRefresh] SW detected new precached content — update available"),t(!0)}),sessionStorage.getItem(S)&&sessionStorage.removeItem(S)},[]);const u=o.useCallback(async()=>{if(!a&&!i&&navigator.onLine&&!(Date.now()-d.current<ue)){if(!s.current){console.warn("[AutoRefresh] Skipping check — no local buildTime to compare against");return}try{const x=m.current?z:"/".replace(/\/$/,""),b=await fetch(`${x}/version.json?_t=${Date.now()}`,{cache:"no-store"});if(!b.ok)throw new Error(`HTTP ${b.status}`);const h=await b.json(),f=h.buildTime?String(h.buildTime):null;if(!f){console.warn("[AutoRefresh] Remote version.json has no buildTime field");return}const R=String(s.current);if(f===R||sessionStorage.getItem(S))return;const w=new Date(Number(f)).toLocaleString(),P=new Date(Number(R)).toLocaleString();console.log(`[AutoRefresh] ✨ New version available!
  Remote: ${f} (${w})
  Local:  ${R} (${P})`),t(!0)}catch(x){console.warn("[AutoRefresh] Version check failed:",x.message)}l.current&&clearTimeout(l.current),l.current=setTimeout(u,ce)}},[a,i]);o.useEffect(()=>{const x=setTimeout(u,de),b=()=>{!document.hidden&&navigator.onLine&&setTimeout(u,1e3)};return document.addEventListener("visibilitychange",b),()=>{clearTimeout(x),l.current&&clearTimeout(l.current),document.removeEventListener("visibilitychange",b)}},[u]);const g=o.useCallback(async()=>{if(a)return;r(!0),sessionStorage.setItem(S,"true");const x=m.current,b=window.location.origin===new URL(z).origin;try{if(x&&!b){console.log("[AutoRefresh] Native update — initial switch to Vercel...");const h=z+"/";localStorage.setItem(F,h),console.log("[AutoRefresh] ✅ Target URL saved in localStorage");try{const{Preferences:f}=await j(async()=>{const{Preferences:R}=await import("./index-IMuJR7Rb.js").then(w=>w.k);return{Preferences:R}},__vite__mapDeps([0,1,2,3,4,5]));await f.set({key:F,value:h}),console.log("[AutoRefresh] ✅ Target URL backed up in Capacitor Preferences")}catch(f){console.warn("[AutoRefresh] Preferences backup failed (non-critical):",f.message)}if("serviceWorker"in navigator)try{const f=await navigator.serviceWorker.getRegistrations();await Promise.all(f.map(R=>R.unregister())),console.log("[AutoRefresh] ✅ Local service workers unregistered")}catch(f){console.warn("[AutoRefresh] SW unregister failed:",f.message)}if("caches"in window)try{const f=await caches.keys();await Promise.all(f.map(R=>caches.delete(R))),console.log("[AutoRefresh] ✅ Local caches cleared")}catch(f){console.warn("[AutoRefresh] Cache clear failed:",f.message)}await new Promise(f=>setTimeout(f,600)),console.log("[AutoRefresh] 🚀 Redirecting to:",h),window.location.replace(h)}else if(console.log("[AutoRefresh] Silent update (SW/Reload)..."),p.current)console.log("[AutoRefresh] Activating waiting service worker..."),J();else{if(console.log("[AutoRefresh] No waiting SW — doing hard reload..."),"serviceWorker"in navigator){const h=await navigator.serviceWorker.getRegistrations();await Promise.all(h.map(f=>f.unregister()))}if("caches"in window){const h=await caches.keys();await Promise.all(h.map(f=>caches.delete(f)))}await new Promise(h=>setTimeout(h,300)),window.location.reload()}}catch(h){console.error("[AutoRefresh] ❌ Update failed:",h),window.location.reload()}},[a]),y=o.useCallback(()=>{n(!0),t(!1),console.log("[AutoRefresh] Banner dismissed by user")},[]);return{needsRefresh:e&&!i,handleRefresh:g,handleDismiss:y,checkForUpdates:u,isRefreshing:a}},pe=({needsRefresh:e,isRefreshing:t,handleRefresh:a,handleDismiss:r})=>c.jsx(ae,{children:e&&c.jsxs(se.div,{className:`auto-refresh-banner ${t?"updating":""}`,initial:{y:100,x:"-50%",opacity:0},animate:{y:0,x:"-50%",opacity:1},exit:{y:100,x:"-50%",opacity:0},transition:{type:"spring",damping:25,stiffness:200},children:[c.jsxs("div",{className:"banner-content",onClick:t?void 0:a,children:[c.jsx("div",{className:"icon-container",children:t?c.jsx(re,{className:"refresh-spinner",size:18}):c.jsx(oe,{className:"sparkle-icon",size:18})}),c.jsx("span",{className:"refresh-text",children:t?"Updating to latest version...":"New update available! Tap to refresh"})]}),!t&&c.jsx("button",{className:"banner-close",onClick:r,title:"Dismiss",children:c.jsx(ie,{size:16})})]})});let fe={data:""},ge=e=>{if(typeof window=="object"){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||fe},he=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,ve=/\/\*[^]*?\*\/|  +/g,M=/\n+/g,T=(e,t)=>{let a="",r="",i="";for(let n in e){let s=e[n];n[0]=="@"?n[1]=="i"?a=n+" "+s+";":r+=n[1]=="f"?T(s,n):n+"{"+T(s,n[1]=="k"?"":t)+"}":typeof s=="object"?r+=T(s,t?t.replace(/([^,])+/g,l=>n.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,d=>/&/.test(d)?d.replace(/&/g,l):l?l+" "+d:d)):n):s!=null&&(n=/^--/.test(n)?n:n.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=T.p?T.p(n,s):n+":"+s+";")}return a+(t&&i?t+"{"+i+"}":i)+r},_={},K=e=>{if(typeof e=="object"){let t="";for(let a in e)t+=a+K(e[a]);return t}return e},ye=(e,t,a,r,i)=>{let n=K(e),s=_[n]||(_[n]=(d=>{let p=0,m=11;for(;p<d.length;)m=101*m+d.charCodeAt(p++)>>>0;return"go"+m})(n));if(!_[s]){let d=n!==e?e:(p=>{let m,u,g=[{}];for(;m=he.exec(p.replace(ve,""));)m[4]?g.shift():m[3]?(u=m[3].replace(M," ").trim(),g.unshift(g[0][u]=g[0][u]||{})):g[0][m[1]]=m[2].replace(M," ").trim();return g[0]})(e);_[s]=T(i?{["@keyframes "+s]:d}:d,a?"":"."+s)}let l=a&&_.g?_.g:null;return a&&(_.g=_[s]),((d,p,m,u)=>{u?p.data=p.data.replace(u,d):p.data.indexOf(d)===-1&&(p.data=m?d+p.data:p.data+d)})(_[s],t,r,l),s},be=(e,t,a)=>e.reduce((r,i,n)=>{let s=t[n];if(s&&s.call){let l=s(a),d=l&&l.props&&l.props.className||/^go/.test(l)&&l;s=d?"."+d:l&&typeof l=="object"?l.props?"":T(l,""):l===!1?"":l}return r+i+(s??"")},"");function O(e){let t=this||{},a=e.call?e(t.p):e;return ye(a.unshift?a.raw?be(a,[].slice.call(arguments,1),t.p):a.reduce((r,i)=>Object.assign(r,i&&i.call?i(t.p):i),{}):a,ge(t.target),t.g,t.o,t.k)}let Y,W,V;O.bind({g:1});let E=O.bind({k:1});function we(e,t,a,r){T.p=t,Y=e,W=a,V=r}function k(e,t){let a=this||{};return function(){let r=arguments;function i(n,s){let l=Object.assign({},n),d=l.className||i.className;a.p=Object.assign({theme:W&&W()},l),a.o=/ *go\d+/.test(d),l.className=O.apply(a,r)+(d?" "+d:"");let p=e;return e[0]&&(p=l.as||e,delete l.as),V&&p[0]&&V(l),Y(p,l)}return t?t(i):i}}var xe=e=>typeof e=="function",L=(e,t)=>xe(e)?e(t):e,Re=(()=>{let e=0;return()=>(++e).toString()})(),G=(()=>{let e;return()=>{if(e===void 0&&typeof window<"u"){let t=matchMedia("(prefers-reduced-motion: reduce)");e=!t||t.matches}return e}})(),Ae=20,U="default",q=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(s=>s.id===t.toast.id?{...s,...t.toast}:s)};case 2:let{toast:r}=t;return q(e,{type:e.toasts.find(s=>s.id===r.id)?1:0,toast:r});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(s=>s.id===i||i===void 0?{...s,dismissed:!0,visible:!1}:s)};case 4:return t.toastId===void 0?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(s=>s.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let n=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(s=>({...s,pauseDuration:s.pauseDuration+n}))}}},$=[],Z={toasts:[],pausedAt:void 0,settings:{toastLimit:Ae}},A={},Q=(e,t=U)=>{A[t]=q(A[t]||Z,e),$.forEach(([a,r])=>{a===t&&r(A[t])})},X=e=>Object.keys(A).forEach(t=>Q(e,t)),_e=e=>Object.keys(A).find(t=>A[t].toasts.some(a=>a.id===e)),C=(e=U)=>t=>{Q(t,e)},Ee={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},Te=(e={},t=U)=>{let[a,r]=o.useState(A[t]||Z),i=o.useRef(A[t]);o.useEffect(()=>(i.current!==A[t]&&r(A[t]),$.push([t,r]),()=>{let s=$.findIndex(([l])=>l===t);s>-1&&$.splice(s,1)}),[t]);let n=a.toasts.map(s=>{var l,d,p;return{...e,...e[s.type],...s,removeDelay:s.removeDelay||((l=e[s.type])==null?void 0:l.removeDelay)||e?.removeDelay,duration:s.duration||((d=e[s.type])==null?void 0:d.duration)||e?.duration||Ee[s.type],style:{...e.style,...(p=e[s.type])==null?void 0:p.style,...s.style}}});return{...a,toasts:n}},je=(e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:a?.id||Re()}),D=e=>(t,a)=>{let r=je(t,e,a);return C(r.toasterId||_e(r.id))({type:2,toast:r}),r.id},v=(e,t)=>D("blank")(e,t);v.error=D("error");v.success=D("success");v.loading=D("loading");v.custom=D("custom");v.dismiss=(e,t)=>{let a={type:3,toastId:e};t?C(t)(a):X(a)};v.dismissAll=e=>v.dismiss(void 0,e);v.remove=(e,t)=>{let a={type:4,toastId:e};t?C(t)(a):X(a)};v.removeAll=e=>v.remove(void 0,e);v.promise=(e,t,a)=>{let r=v.loading(t.loading,{...a,...a?.loading});return typeof e=="function"&&(e=e()),e.then(i=>{let n=t.success?L(t.success,i):void 0;return n?v.success(n,{id:r,...a,...a?.success}):v.dismiss(r),i}).catch(i=>{let n=t.error?L(t.error,i):void 0;n?v.error(n,{id:r,...a,...a?.error}):v.dismiss(r)}),e};var ke=1e3,Ne=(e,t="default")=>{let{toasts:a,pausedAt:r}=Te(e,t),i=o.useRef(new Map).current,n=o.useCallback((u,g=ke)=>{if(i.has(u))return;let y=setTimeout(()=>{i.delete(u),s({type:4,toastId:u})},g);i.set(u,y)},[]);o.useEffect(()=>{if(r)return;let u=Date.now(),g=a.map(y=>{if(y.duration===1/0)return;let x=(y.duration||0)+y.pauseDuration-(u-y.createdAt);if(x<0){y.visible&&v.dismiss(y.id);return}return setTimeout(()=>v.dismiss(y.id,t),x)});return()=>{g.forEach(y=>y&&clearTimeout(y))}},[a,r,t]);let s=o.useCallback(C(t),[t]),l=o.useCallback(()=>{s({type:5,time:Date.now()})},[s]),d=o.useCallback((u,g)=>{s({type:1,toast:{id:u,height:g}})},[s]),p=o.useCallback(()=>{r&&s({type:6,time:Date.now()})},[r,s]),m=o.useCallback((u,g)=>{let{reverseOrder:y=!1,gutter:x=8,defaultPosition:b}=g||{},h=a.filter(w=>(w.position||b)===(u.position||b)&&w.height),f=h.findIndex(w=>w.id===u.id),R=h.filter((w,P)=>P<f&&w.visible).length;return h.filter(w=>w.visible).slice(...y?[R+1]:[0,R]).reduce((w,P)=>w+(P.height||0)+x,0)},[a]);return o.useEffect(()=>{a.forEach(u=>{if(u.dismissed)n(u.id,u.removeDelay);else{let g=i.get(u.id);g&&(clearTimeout(g),i.delete(u.id))}})},[a,n]),{toasts:a,handlers:{updateHeight:d,startPause:l,endPause:p,calculateOffset:m}}},Se=E`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,Pe=E`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,De=E`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,Ie=k("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Se} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${Pe} 0.15s ease-out forwards;
    animation-delay: 150ms;
    position: absolute;
    border-radius: 3px;
    opacity: 0;
    background: ${e=>e.secondary||"#fff"};
    bottom: 9px;
    left: 4px;
    height: 2px;
    width: 12px;
  }

  &:before {
    animation: ${De} 0.15s ease-out forwards;
    animation-delay: 180ms;
    transform: rotate(90deg);
  }
`,$e=E`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`,Le=k("div")`
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 2px solid;
  border-radius: 100%;
  border-color: ${e=>e.secondary||"#e0e0e0"};
  border-right-color: ${e=>e.primary||"#616161"};
  animation: ${$e} 1s linear infinite;
`,Oe=E`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,Ce=E`
0% {
	height: 0;
	width: 0;
	opacity: 0;
}
40% {
  height: 0;
	width: 6px;
	opacity: 1;
}
100% {
  opacity: 1;
  height: 10px;
}`,ze=k("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Oe} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${Ce} 0.2s ease-out forwards;
    opacity: 0;
    animation-delay: 200ms;
    position: absolute;
    border-right: 2px solid;
    border-bottom: 2px solid;
    border-color: ${e=>e.secondary||"#fff"};
    bottom: 6px;
    left: 6px;
    height: 10px;
    width: 6px;
  }
`,We=k("div")`
  position: absolute;
`,Ve=k("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,Ue=E`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,He=k("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${Ue} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,Fe=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return t!==void 0?typeof t=="string"?o.createElement(He,null,t):t:a==="blank"?null:o.createElement(Ve,null,o.createElement(Le,{...r}),a!=="loading"&&o.createElement(We,null,a==="error"?o.createElement(Ie,{...r}):o.createElement(ze,{...r})))},Me=e=>`
0% {transform: translate3d(0,${e*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,Be=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${e*-150}%,-1px) scale(.6); opacity:0;}
`,Ke="0%{opacity:0;} 100%{opacity:1;}",Ye="0%{opacity:1;} 100%{opacity:0;}",Ge=k("div")`
  display: flex;
  align-items: center;
  background: #fff;
  color: #363636;
  line-height: 1.3;
  will-change: transform;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1), 0 3px 3px rgba(0, 0, 0, 0.05);
  max-width: 350px;
  pointer-events: auto;
  padding: 8px 10px;
  border-radius: 8px;
`,qe=k("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,Ze=(e,t)=>{let a=e.includes("top")?1:-1,[r,i]=G()?[Ke,Ye]:[Me(a),Be(a)];return{animation:t?`${E(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${E(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},Qe=o.memo(({toast:e,position:t,style:a,children:r})=>{let i=e.height?Ze(e.position||t||"top-center",e.visible):{opacity:0},n=o.createElement(Fe,{toast:e}),s=o.createElement(qe,{...e.ariaProps},L(e.message,e));return o.createElement(Ge,{className:e.className,style:{...i,...a,...e.style}},typeof r=="function"?r({icon:n,message:s}):o.createElement(o.Fragment,null,n,s))});we(o.createElement);var Xe=({id:e,className:t,style:a,onHeightUpdate:r,children:i})=>{let n=o.useCallback(s=>{if(s){let l=()=>{let d=s.getBoundingClientRect().height;r(e,d)};l(),new MutationObserver(l).observe(s,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return o.createElement("div",{ref:n,className:t,style:a},i)},Je=(e,t)=>{let a=e.includes("top"),r=a?{top:0}:{bottom:0},i=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:G()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(a?1:-1)}px)`,...r,...i}},et=O`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,I=16,tt=({reverseOrder:e,position:t="top-center",toastOptions:a,gutter:r,children:i,toasterId:n,containerStyle:s,containerClassName:l})=>{let{toasts:d,handlers:p}=Ne(a,n);return o.createElement("div",{"data-rht-toaster":n||"",style:{position:"fixed",zIndex:9999,top:I,left:I,right:I,bottom:I,pointerEvents:"none",...s},className:l,onMouseEnter:p.startPause,onMouseLeave:p.endPause},d.map(m=>{let u=m.position||t,g=p.calculateOffset(m,{reverseOrder:e,gutter:r,defaultPosition:t}),y=Je(u,g);return o.createElement(Xe,{id:m.id,key:m.id,onHeightUpdate:p.updateHeight,className:m.visible?et:"",style:y},m.type==="custom"?L(m.message,m):i?i(m):o.createElement(Qe,{toast:m,position:u}))}))},pt=v;const at=o.lazy(()=>j(()=>import("./LandingPage-Dw_8pfki.js"),__vite__mapDeps([6,1,2,0,3,4,5,7,8,9]))),st=o.lazy(()=>j(()=>import("./Login-wE01KvFm.js"),__vite__mapDeps([10,1,2,0,3,4,5,7,8,11]))),rt=o.lazy(()=>j(()=>import("./DownloadAPK-Ba8LoS69.js"),__vite__mapDeps([12,1,2,13,4,0,3,5]))),ot=o.lazy(()=>j(()=>import("./Terms-Hfce-xzX.js"),__vite__mapDeps([14,1,2]))),it=o.lazy(()=>j(()=>import("./Privacy-DGt31oRc.js"),__vite__mapDeps([15,1,2]))),nt=o.lazy(()=>j(()=>import("./About-BnAmT10Q.js"),__vite__mapDeps([16,1,2,13,4,0,3,5,17,7,8,18]))),lt=o.lazy(()=>j(()=>import("./AuthenticatedApp-ab1O5iC1.js").then(e=>e.A),__vite__mapDeps([19,0,1,2,3,4,5,7,8,20]))),ct=()=>{const{isAuthenticated:e,loading:t}=te(),{needsRefresh:a,handleRefresh:r,handleDismiss:i,isRefreshing:n}=me(),s=ne();if(t)return c.jsx("div",{className:"loading-screen"});const l=B.isNativePlatform();return!e&&l&&s.pathname==="/"?c.jsx(H,{to:"/login",replace:!0}):c.jsxs(c.Fragment,{children:[c.jsx(o.Suspense,{fallback:c.jsx("div",{className:"loading"}),children:e?c.jsx(lt,{}):c.jsxs(le,{children:[c.jsx(N,{path:"/",element:c.jsx(at,{})}),c.jsx(N,{path:"/login",element:c.jsx(st,{})}),c.jsx(N,{path:"/download-apk",element:c.jsx(rt,{})}),c.jsx(N,{path:"/terms",element:c.jsx("div",{className:"legal-page-wrapper",children:c.jsx(ot,{})})}),c.jsx(N,{path:"/privacy",element:c.jsx("div",{className:"legal-page-wrapper",children:c.jsx(it,{})})}),c.jsx(N,{path:"/about",element:c.jsx(nt,{})}),c.jsx(N,{path:"*",element:c.jsx(H,{to:"/",replace:!0})})]})}),c.jsx(pe,{needsRefresh:a,isRefreshing:n,handleRefresh:r,handleDismiss:i}),c.jsx(tt,{position:"bottom-center",toastOptions:{duration:3500,className:"premium-toast",success:{className:"premium-toast premium-toast-success",iconTheme:{primary:"var(--brand-primary)",secondary:"#fff"}},error:{className:"premium-toast premium-toast-error",iconTheme:{primary:"var(--error-color)",secondary:"#fff"}},loading:{className:"premium-toast premium-toast-loading"},style:{background:"transparent",boxShadow:"none",border:"none"}},containerStyle:{bottom:"calc(75px + var(--sab, 0px))"}})]})},ft=Object.freeze(Object.defineProperty({__proto__:null,default:ct},Symbol.toStringTag,{value:"Module"}));export{ft as P,v as n,me as u,pt as z};
