const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BqAZ1C49.js","assets/vendor-ui-C9SKRs7W.js","assets/vendor-react-BcsPgoup.js","assets/vendor-supabase-BZ0N5lZN.js","assets/vendor-query-BQ1Yi_ak.js","assets/index-D_zN1tUP.css","assets/LandingPage-Dnzeyo30.js","assets/AppName-qxkHKfGg.js","assets/AppName-BbtBD1tR.css","assets/LandingPage-CUIbdkj0.css","assets/Login-CHxdnWP2.js","assets/Login-BKTjdBs-.css","assets/DownloadAPK-BmqFIePU.js","assets/useAppVersions-ChCi_-wM.js","assets/Terms-Hfce-xzX.js","assets/Privacy-DGt31oRc.js","assets/About-BHFA0q4X.js","assets/versionUtils-C1D8PNZp.js","assets/About-BNHYYKvc.css","assets/AuthenticatedApp-vQBX8wos.js","assets/AuthenticatedApp-CGHs7U8B.css"])))=>i.map(i=>d[i]);
import{C as B,_ as j,s as X,f as ee,o as te,c as ae}from"./index-BqAZ1C49.js";import{j as c,a as se,m as re,w as oe,b1 as ie,X as ne}from"./vendor-ui-C9SKRs7W.js";import{r as o,b as le,N as H,d as ce,e as S}from"./vendor-react-BcsPgoup.js";const de=300*1e3,ue=4e3,me=5e3,F="ota-target-url",P="ota-just-refreshed",z="https://caba-android-app.vercel.app",pe=()=>{const[e,t]=o.useState(!1),[a,r]=o.useState(!1),[i,n]=o.useState(!1),s=o.useRef(null),l=o.useRef(null),d=o.useRef(Date.now()),p=o.useRef(!1),m=o.useRef(B.isNativePlatform());o.useEffect(()=>{const b=document.querySelector('meta[name="build-time"]')?.content||null;if(s.current=b,!b)console.error(`[AutoRefresh] ❌ CRITICAL: <meta name="build-time"> not found!
This means version detection will NOT work.
Make sure index.html has: <meta name="build-time" content="<%= buildTime %>" />
And vite.config.js has createHtmlPlugin with buildTime data.`);else{const h=new Date(Number(b)).toLocaleString();console.log(`[AutoRefresh] Local build: ${b} (${h})`),console.log(`[AutoRefresh] Platform: ${m.current?"Native (Capacitor)":"Web"}`)}te(()=>{if(p.current=!0,sessionStorage.getItem(P)){sessionStorage.removeItem(P),console.log("[AutoRefresh] SW update detected, but just refreshed — ignoring");return}console.log("[AutoRefresh] SW detected new precached content — update available"),t(!0)}),sessionStorage.getItem(P)&&sessionStorage.removeItem(P)},[]);const u=o.useCallback(async()=>{if(!a&&!i&&navigator.onLine&&!(Date.now()-d.current<me)){if(!s.current){console.warn("[AutoRefresh] Skipping check — no local buildTime to compare against");return}try{const x=m.current?z:"/".replace(/\/$/,""),b=await fetch(`${x}/version.json?_t=${Date.now()}`,{cache:"no-store"});if(!b.ok)throw new Error(`HTTP ${b.status}`);const h=await b.json(),f=h.buildTime?String(h.buildTime):null;if(!f){console.warn("[AutoRefresh] Remote version.json has no buildTime field");return}const R=String(s.current);if(f===R||sessionStorage.getItem(P))return;const w=new Date(Number(f)).toLocaleString(),N=new Date(Number(R)).toLocaleString();console.log(`[AutoRefresh] ✨ New version available!
  Remote: ${f} (${w})
  Local:  ${R} (${N})`),t(!0)}catch(x){console.warn("[AutoRefresh] Version check failed:",x.message)}l.current&&clearTimeout(l.current),l.current=setTimeout(u,de)}},[a,i]);o.useEffect(()=>{const x=setTimeout(u,ue),b=()=>{!document.hidden&&navigator.onLine&&setTimeout(u,1e3)};return document.addEventListener("visibilitychange",b),()=>{clearTimeout(x),l.current&&clearTimeout(l.current),document.removeEventListener("visibilitychange",b)}},[u]);const g=o.useCallback(async()=>{if(a)return;r(!0),sessionStorage.setItem(P,"true");const x=m.current,b=window.location.origin===new URL(z).origin;try{if(x&&!b){console.log("[AutoRefresh] Native update — initial switch to Vercel...");const h=z+"/";localStorage.setItem(F,h),console.log("[AutoRefresh] ✅ Target URL saved in localStorage");try{const{Preferences:f}=await j(async()=>{const{Preferences:w}=await import("./index-BqAZ1C49.js").then(N=>N.k);return{Preferences:w}},__vite__mapDeps([0,1,2,3,4,5]));await f.set({key:F,value:h});const{data:{session:R}}=await X.auth.getSession();R&&(await f.set({key:"ota-migrated-session",value:JSON.stringify(R)}),console.log("[AutoRefresh] ✅ Session migrated to Preferences")),console.log("[AutoRefresh] ✅ Target URL backed up in Capacitor Preferences")}catch(f){console.warn("[AutoRefresh] Preferences backup failed (non-critical):",f.message)}if("serviceWorker"in navigator)try{const f=await navigator.serviceWorker.getRegistrations();await Promise.all(f.map(R=>R.unregister())),console.log("[AutoRefresh] ✅ Local service workers unregistered")}catch(f){console.warn("[AutoRefresh] SW unregister failed:",f.message)}if("caches"in window)try{const f=await caches.keys();await Promise.all(f.map(R=>caches.delete(R))),console.log("[AutoRefresh] ✅ Local caches cleared")}catch(f){console.warn("[AutoRefresh] Cache clear failed:",f.message)}await new Promise(f=>setTimeout(f,600)),console.log("[AutoRefresh] 🚀 Redirecting to:",h),window.location.replace(h)}else if(console.log("[AutoRefresh] Silent update (SW/Reload)..."),p.current)console.log("[AutoRefresh] Activating waiting service worker..."),ee();else{if(console.log("[AutoRefresh] No waiting SW — doing hard reload..."),"serviceWorker"in navigator){const h=await navigator.serviceWorker.getRegistrations();await Promise.all(h.map(f=>f.unregister()))}if("caches"in window){const h=await caches.keys();await Promise.all(h.map(f=>caches.delete(f)))}await new Promise(h=>setTimeout(h,300)),window.location.reload()}}catch(h){console.error("[AutoRefresh] ❌ Update failed:",h),window.location.reload()}},[a]),v=o.useCallback(()=>{n(!0),t(!1),console.log("[AutoRefresh] Banner dismissed by user")},[]);return{needsRefresh:e&&!i,handleRefresh:g,handleDismiss:v,checkForUpdates:u,isRefreshing:a}},fe=({needsRefresh:e,isRefreshing:t,handleRefresh:a,handleDismiss:r})=>c.jsx(se,{children:e&&c.jsxs(re.div,{className:`auto-refresh-banner ${t?"updating":""}`,initial:{y:100,x:"-50%",opacity:0},animate:{y:0,x:"-50%",opacity:1},exit:{y:100,x:"-50%",opacity:0},transition:{type:"spring",damping:25,stiffness:200},children:[c.jsxs("div",{className:"banner-content",onClick:t?void 0:a,children:[c.jsx("div",{className:"icon-container",children:t?c.jsx(oe,{className:"refresh-spinner",size:18}):c.jsx(ie,{className:"sparkle-icon",size:18})}),c.jsx("span",{className:"refresh-text",children:t?"Updating to latest version...":"New update available! Tap to refresh"})]}),!t&&c.jsx("button",{className:"banner-close",onClick:r,title:"Dismiss",children:c.jsx(ne,{size:16})})]})});let ge={data:""},he=e=>{if(typeof window=="object"){let t=(e?e.querySelector("#_goober"):window._goober)||Object.assign(document.createElement("style"),{innerHTML:" ",id:"_goober"});return t.nonce=window.__nonce__,t.parentNode||(e||document.head).appendChild(t),t.firstChild}return e||ge},ye=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,ve=/\/\*[^]*?\*\/|  +/g,M=/\n+/g,T=(e,t)=>{let a="",r="",i="";for(let n in e){let s=e[n];n[0]=="@"?n[1]=="i"?a=n+" "+s+";":r+=n[1]=="f"?T(s,n):n+"{"+T(s,n[1]=="k"?"":t)+"}":typeof s=="object"?r+=T(s,t?t.replace(/([^,])+/g,l=>n.replace(/([^,]*:\S+\([^)]*\))|([^,])+/g,d=>/&/.test(d)?d.replace(/&/g,l):l?l+" "+d:d)):n):s!=null&&(n=/^--/.test(n)?n:n.replace(/[A-Z]/g,"-$&").toLowerCase(),i+=T.p?T.p(n,s):n+":"+s+";")}return a+(t&&i?t+"{"+i+"}":i)+r},_={},K=e=>{if(typeof e=="object"){let t="";for(let a in e)t+=a+K(e[a]);return t}return e},be=(e,t,a,r,i)=>{let n=K(e),s=_[n]||(_[n]=(d=>{let p=0,m=11;for(;p<d.length;)m=101*m+d.charCodeAt(p++)>>>0;return"go"+m})(n));if(!_[s]){let d=n!==e?e:(p=>{let m,u,g=[{}];for(;m=ye.exec(p.replace(ve,""));)m[4]?g.shift():m[3]?(u=m[3].replace(M," ").trim(),g.unshift(g[0][u]=g[0][u]||{})):g[0][m[1]]=m[2].replace(M," ").trim();return g[0]})(e);_[s]=T(i?{["@keyframes "+s]:d}:d,a?"":"."+s)}let l=a&&_.g?_.g:null;return a&&(_.g=_[s]),((d,p,m,u)=>{u?p.data=p.data.replace(u,d):p.data.indexOf(d)===-1&&(p.data=m?d+p.data:p.data+d)})(_[s],t,r,l),s},we=(e,t,a)=>e.reduce((r,i,n)=>{let s=t[n];if(s&&s.call){let l=s(a),d=l&&l.props&&l.props.className||/^go/.test(l)&&l;s=d?"."+d:l&&typeof l=="object"?l.props?"":T(l,""):l===!1?"":l}return r+i+(s??"")},"");function L(e){let t=this||{},a=e.call?e(t.p):e;return be(a.unshift?a.raw?we(a,[].slice.call(arguments,1),t.p):a.reduce((r,i)=>Object.assign(r,i&&i.call?i(t.p):i),{}):a,he(t.target),t.g,t.o,t.k)}let Y,W,V;L.bind({g:1});let E=L.bind({k:1});function xe(e,t,a,r){T.p=t,Y=e,W=a,V=r}function k(e,t){let a=this||{};return function(){let r=arguments;function i(n,s){let l=Object.assign({},n),d=l.className||i.className;a.p=Object.assign({theme:W&&W()},l),a.o=/ *go\d+/.test(d),l.className=L.apply(a,r)+(d?" "+d:"");let p=e;return e[0]&&(p=l.as||e,delete l.as),V&&p[0]&&V(l),Y(p,l)}return t?t(i):i}}var Re=e=>typeof e=="function",$=(e,t)=>Re(e)?e(t):e,Ae=(()=>{let e=0;return()=>(++e).toString()})(),G=(()=>{let e;return()=>{if(e===void 0&&typeof window<"u"){let t=matchMedia("(prefers-reduced-motion: reduce)");e=!t||t.matches}return e}})(),_e=20,U="default",q=(e,t)=>{let{toastLimit:a}=e.settings;switch(t.type){case 0:return{...e,toasts:[t.toast,...e.toasts].slice(0,a)};case 1:return{...e,toasts:e.toasts.map(s=>s.id===t.toast.id?{...s,...t.toast}:s)};case 2:let{toast:r}=t;return q(e,{type:e.toasts.find(s=>s.id===r.id)?1:0,toast:r});case 3:let{toastId:i}=t;return{...e,toasts:e.toasts.map(s=>s.id===i||i===void 0?{...s,dismissed:!0,visible:!1}:s)};case 4:return t.toastId===void 0?{...e,toasts:[]}:{...e,toasts:e.toasts.filter(s=>s.id!==t.toastId)};case 5:return{...e,pausedAt:t.time};case 6:let n=t.time-(e.pausedAt||0);return{...e,pausedAt:void 0,toasts:e.toasts.map(s=>({...s,pauseDuration:s.pauseDuration+n}))}}},O=[],Z={toasts:[],pausedAt:void 0,settings:{toastLimit:_e}},A={},J=(e,t=U)=>{A[t]=q(A[t]||Z,e),O.forEach(([a,r])=>{a===t&&r(A[t])})},Q=e=>Object.keys(A).forEach(t=>J(e,t)),Ee=e=>Object.keys(A).find(t=>A[t].toasts.some(a=>a.id===e)),C=(e=U)=>t=>{J(t,e)},Te={blank:4e3,error:4e3,success:2e3,loading:1/0,custom:4e3},je=(e={},t=U)=>{let[a,r]=o.useState(A[t]||Z),i=o.useRef(A[t]);o.useEffect(()=>(i.current!==A[t]&&r(A[t]),O.push([t,r]),()=>{let s=O.findIndex(([l])=>l===t);s>-1&&O.splice(s,1)}),[t]);let n=a.toasts.map(s=>{var l,d,p;return{...e,...e[s.type],...s,removeDelay:s.removeDelay||((l=e[s.type])==null?void 0:l.removeDelay)||e?.removeDelay,duration:s.duration||((d=e[s.type])==null?void 0:d.duration)||e?.duration||Te[s.type],style:{...e.style,...(p=e[s.type])==null?void 0:p.style,...s.style}}});return{...a,toasts:n}},ke=(e,t="blank",a)=>({createdAt:Date.now(),visible:!0,dismissed:!1,type:t,ariaProps:{role:"status","aria-live":"polite"},message:e,pauseDuration:0,...a,id:a?.id||Ae()}),D=e=>(t,a)=>{let r=ke(t,e,a);return C(r.toasterId||Ee(r.id))({type:2,toast:r}),r.id},y=(e,t)=>D("blank")(e,t);y.error=D("error");y.success=D("success");y.loading=D("loading");y.custom=D("custom");y.dismiss=(e,t)=>{let a={type:3,toastId:e};t?C(t)(a):Q(a)};y.dismissAll=e=>y.dismiss(void 0,e);y.remove=(e,t)=>{let a={type:4,toastId:e};t?C(t)(a):Q(a)};y.removeAll=e=>y.remove(void 0,e);y.promise=(e,t,a)=>{let r=y.loading(t.loading,{...a,...a?.loading});return typeof e=="function"&&(e=e()),e.then(i=>{let n=t.success?$(t.success,i):void 0;return n?y.success(n,{id:r,...a,...a?.success}):y.dismiss(r),i}).catch(i=>{let n=t.error?$(t.error,i):void 0;n?y.error(n,{id:r,...a,...a?.error}):y.dismiss(r)}),e};var Ne=1e3,Se=(e,t="default")=>{let{toasts:a,pausedAt:r}=je(e,t),i=o.useRef(new Map).current,n=o.useCallback((u,g=Ne)=>{if(i.has(u))return;let v=setTimeout(()=>{i.delete(u),s({type:4,toastId:u})},g);i.set(u,v)},[]);o.useEffect(()=>{if(r)return;let u=Date.now(),g=a.map(v=>{if(v.duration===1/0)return;let x=(v.duration||0)+v.pauseDuration-(u-v.createdAt);if(x<0){v.visible&&y.dismiss(v.id);return}return setTimeout(()=>y.dismiss(v.id,t),x)});return()=>{g.forEach(v=>v&&clearTimeout(v))}},[a,r,t]);let s=o.useCallback(C(t),[t]),l=o.useCallback(()=>{s({type:5,time:Date.now()})},[s]),d=o.useCallback((u,g)=>{s({type:1,toast:{id:u,height:g}})},[s]),p=o.useCallback(()=>{r&&s({type:6,time:Date.now()})},[r,s]),m=o.useCallback((u,g)=>{let{reverseOrder:v=!1,gutter:x=8,defaultPosition:b}=g||{},h=a.filter(w=>(w.position||b)===(u.position||b)&&w.height),f=h.findIndex(w=>w.id===u.id),R=h.filter((w,N)=>N<f&&w.visible).length;return h.filter(w=>w.visible).slice(...v?[R+1]:[0,R]).reduce((w,N)=>w+(N.height||0)+x,0)},[a]);return o.useEffect(()=>{a.forEach(u=>{if(u.dismissed)n(u.id,u.removeDelay);else{let g=i.get(u.id);g&&(clearTimeout(g),i.delete(u.id))}})},[a,n]),{toasts:a,handlers:{updateHeight:d,startPause:l,endPause:p,calculateOffset:m}}},Pe=E`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
 transform: scale(1) rotate(45deg);
  opacity: 1;
}`,De=E`
from {
  transform: scale(0);
  opacity: 0;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Ie=E`
from {
  transform: scale(0) rotate(90deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(90deg);
	opacity: 1;
}`,Oe=k("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#ff4b4b"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Pe} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;

  &:after,
  &:before {
    content: '';
    animation: ${De} 0.15s ease-out forwards;
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
    animation: ${Ie} 0.15s ease-out forwards;
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
`,Ce=E`
from {
  transform: scale(0) rotate(45deg);
	opacity: 0;
}
to {
  transform: scale(1) rotate(45deg);
	opacity: 1;
}`,ze=E`
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
}`,We=k("div")`
  width: 20px;
  opacity: 0;
  height: 20px;
  border-radius: 10px;
  background: ${e=>e.primary||"#61d345"};
  position: relative;
  transform: rotate(45deg);

  animation: ${Ce} 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
  animation-delay: 100ms;
  &:after {
    content: '';
    box-sizing: border-box;
    animation: ${ze} 0.2s ease-out forwards;
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
`,Ve=k("div")`
  position: absolute;
`,Ue=k("div")`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
`,He=E`
from {
  transform: scale(0.6);
  opacity: 0.4;
}
to {
  transform: scale(1);
  opacity: 1;
}`,Fe=k("div")`
  position: relative;
  transform: scale(0.6);
  opacity: 0.4;
  min-width: 20px;
  animation: ${He} 0.3s 0.12s cubic-bezier(0.175, 0.885, 0.32, 1.275)
    forwards;
`,Me=({toast:e})=>{let{icon:t,type:a,iconTheme:r}=e;return t!==void 0?typeof t=="string"?o.createElement(Fe,null,t):t:a==="blank"?null:o.createElement(Ue,null,o.createElement(Le,{...r}),a!=="loading"&&o.createElement(Ve,null,a==="error"?o.createElement(Oe,{...r}):o.createElement(We,{...r})))},Be=e=>`
0% {transform: translate3d(0,${e*-200}%,0) scale(.6); opacity:.5;}
100% {transform: translate3d(0,0,0) scale(1); opacity:1;}
`,Ke=e=>`
0% {transform: translate3d(0,0,-1px) scale(1); opacity:1;}
100% {transform: translate3d(0,${e*-150}%,-1px) scale(.6); opacity:0;}
`,Ye="0%{opacity:0;} 100%{opacity:1;}",Ge="0%{opacity:1;} 100%{opacity:0;}",qe=k("div")`
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
`,Ze=k("div")`
  display: flex;
  justify-content: center;
  margin: 4px 10px;
  color: inherit;
  flex: 1 1 auto;
  white-space: pre-line;
`,Je=(e,t)=>{let a=e.includes("top")?1:-1,[r,i]=G()?[Ye,Ge]:[Be(a),Ke(a)];return{animation:t?`${E(r)} 0.35s cubic-bezier(.21,1.02,.73,1) forwards`:`${E(i)} 0.4s forwards cubic-bezier(.06,.71,.55,1)`}},Qe=o.memo(({toast:e,position:t,style:a,children:r})=>{let i=e.height?Je(e.position||t||"top-center",e.visible):{opacity:0},n=o.createElement(Me,{toast:e}),s=o.createElement(Ze,{...e.ariaProps},$(e.message,e));return o.createElement(qe,{className:e.className,style:{...i,...a,...e.style}},typeof r=="function"?r({icon:n,message:s}):o.createElement(o.Fragment,null,n,s))});xe(o.createElement);var Xe=({id:e,className:t,style:a,onHeightUpdate:r,children:i})=>{let n=o.useCallback(s=>{if(s){let l=()=>{let d=s.getBoundingClientRect().height;r(e,d)};l(),new MutationObserver(l).observe(s,{subtree:!0,childList:!0,characterData:!0})}},[e,r]);return o.createElement("div",{ref:n,className:t,style:a},i)},et=(e,t)=>{let a=e.includes("top"),r=a?{top:0}:{bottom:0},i=e.includes("center")?{justifyContent:"center"}:e.includes("right")?{justifyContent:"flex-end"}:{};return{left:0,right:0,display:"flex",position:"absolute",transition:G()?void 0:"all 230ms cubic-bezier(.21,1.02,.73,1)",transform:`translateY(${t*(a?1:-1)}px)`,...r,...i}},tt=L`
  z-index: 9999;
  > * {
    pointer-events: auto;
  }
`,I=16,at=({reverseOrder:e,position:t="top-center",toastOptions:a,gutter:r,children:i,toasterId:n,containerStyle:s,containerClassName:l})=>{let{toasts:d,handlers:p}=Se(a,n);return o.createElement("div",{"data-rht-toaster":n||"",style:{position:"fixed",zIndex:9999,top:I,left:I,right:I,bottom:I,pointerEvents:"none",...s},className:l,onMouseEnter:p.startPause,onMouseLeave:p.endPause},d.map(m=>{let u=m.position||t,g=p.calculateOffset(m,{reverseOrder:e,gutter:r,defaultPosition:t}),v=et(u,g);return o.createElement(Xe,{id:m.id,key:m.id,onHeightUpdate:p.updateHeight,className:m.visible?tt:"",style:v},m.type==="custom"?$(m.message,m):i?i(m):o.createElement(Qe,{toast:m,position:u}))}))},ft=y;const st=o.lazy(()=>j(()=>import("./LandingPage-Dnzeyo30.js"),__vite__mapDeps([6,1,2,0,3,4,5,7,8,9]))),rt=o.lazy(()=>j(()=>import("./Login-CHxdnWP2.js"),__vite__mapDeps([10,1,2,0,3,4,5,7,8,11]))),ot=o.lazy(()=>j(()=>import("./DownloadAPK-BmqFIePU.js"),__vite__mapDeps([12,1,2,13,4,0,3,5]))),it=o.lazy(()=>j(()=>import("./Terms-Hfce-xzX.js"),__vite__mapDeps([14,1,2]))),nt=o.lazy(()=>j(()=>import("./Privacy-DGt31oRc.js"),__vite__mapDeps([15,1,2]))),lt=o.lazy(()=>j(()=>import("./About-BHFA0q4X.js"),__vite__mapDeps([16,1,2,13,4,0,3,5,17,7,8,18]))),ct=o.lazy(()=>j(()=>import("./AuthenticatedApp-vQBX8wos.js").then(e=>e.A),__vite__mapDeps([19,0,1,2,3,4,5,7,8,20]))),dt=()=>{const{isAuthenticated:e,loading:t}=ae(),{needsRefresh:a,handleRefresh:r,handleDismiss:i,isRefreshing:n}=pe(),s=le();if(t)return c.jsx("div",{className:"loading-screen"});const l=B.isNativePlatform();return!e&&l&&s.pathname==="/"?c.jsx(H,{to:"/login",replace:!0}):c.jsxs(c.Fragment,{children:[c.jsx(o.Suspense,{fallback:c.jsx("div",{className:"loading"}),children:e?c.jsx(ct,{}):c.jsxs(ce,{children:[c.jsx(S,{path:"/",element:c.jsx(st,{})}),c.jsx(S,{path:"/login",element:c.jsx(rt,{})}),c.jsx(S,{path:"/download-apk",element:c.jsx(ot,{})}),c.jsx(S,{path:"/terms",element:c.jsx("div",{className:"legal-page-wrapper",children:c.jsx(it,{})})}),c.jsx(S,{path:"/privacy",element:c.jsx("div",{className:"legal-page-wrapper",children:c.jsx(nt,{})})}),c.jsx(S,{path:"/about",element:c.jsx(lt,{})}),c.jsx(S,{path:"*",element:c.jsx(H,{to:"/",replace:!0})})]})}),c.jsx(fe,{needsRefresh:a,isRefreshing:n,handleRefresh:r,handleDismiss:i}),c.jsx(at,{position:"bottom-center",toastOptions:{duration:3500,className:"premium-toast",success:{className:"premium-toast premium-toast-success",iconTheme:{primary:"var(--brand-primary)",secondary:"#fff"}},error:{className:"premium-toast premium-toast-error",iconTheme:{primary:"var(--error-color)",secondary:"#fff"}},loading:{className:"premium-toast premium-toast-loading"},style:{background:"transparent",boxShadow:"none",border:"none"}},containerStyle:{bottom:"calc(75px + var(--sab, 0px))"}})]})},gt=Object.freeze(Object.defineProperty({__proto__:null,default:dt},Symbol.toStringTag,{value:"Module"}));export{gt as P,y as n,pe as u,ft as z};
