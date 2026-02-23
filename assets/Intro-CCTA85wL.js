import{j as t}from"./vendor-ui-BQJ6xnm7.js";import{u as p,j as y,r as x}from"./vendor-react-evG5U_rF.js";import{c as h}from"./index-Dt09K6DN.js";import"./vendor-supabase-BZ0N5lZN.js";import"./vendor-query-Cdl61Ty0.js";const j=({onComplete:o})=>{const s=p(),[c]=y(),{isDark:m}=h(),r=m,a=r?"#25D366":"#00a884";return x.useEffect(()=>{const i=setTimeout(()=>{const e=c.get("redirect");s(e==="login"?"/login":"/"),o()},3e3);return()=>clearTimeout(i)},[s,o]),t.jsxs("div",{className:`intro-overlay transition-colors duration-500 overflow-hidden
      ${r?"bg-[#111b21]":"bg-white"}`,children:[t.jsx("style",{children:`
        /* 1. BALL ANIMATION */
        @keyframes ballDrop {
          0% { transform: translateY(-80px) scale(1); opacity: 1; }
          30% { transform: translateY(0) scale(1); opacity: 1; }
          35% { transform: translateY(5px) scale(1.4, 0.6); opacity: 1; }
          36% { opacity: 0; }
          90% { opacity: 0; }
          91% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(1); opacity: 1; }
        }

        /* 2. LOGO REVEAL */
        @keyframes logoCycle {
          0%, 35% { transform: scale(0); opacity: 0; }
          36% { transform: scale(1.2, 0.8); opacity: 1; }
          45% { transform: scale(1); opacity: 1; }
          85% { transform: scale(1); opacity: 1; }
          90% { transform: scale(0); opacity: 0; }
          100% { transform: scale(0); opacity: 0; }
        }

        /* 3. STROKE DRAWING */
        @keyframes drawStroke {
          0%, 35% { stroke-dashoffset: 200; }
          50% { stroke-dashoffset: 0; }
          85% { stroke-dashoffset: 0; }
          90% { stroke-dashoffset: 200; }
        }

        /* 4. TEXT SLIDE */
        @keyframes textSlide {
          0%, 40% { opacity: 0; transform: translateX(-20px); }
          50% { opacity: 1; transform: translateX(0); }
          85% { opacity: 1; transform: translateX(0); }
          90% { opacity: 0; transform: translateX(-10px); }
        }

        /* 5. DOT WAVE (Improved) */
        @keyframes dotWave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        /* 6. SHOCKWAVE RIPPLE (New) */
        @keyframes rippleEffect {
          0%, 30% { width: 0px; height: 0px; opacity: 0; border-width: 0px; }
          31% { width: 10px; height: 5px; opacity: 0.8; border-width: 4px; }
          50% { width: 120px; height: 20px; opacity: 0; border-width: 0px; }
          100% { width: 120px; height: 20px; opacity: 0; border-width: 0px; }
        }

        /* 7. SPLASH PARTICLES (New) */
        @keyframes splashOut {
          0%, 30% { transform: translate(0,0) scale(0); opacity: 0; }
          31% { transform: translate(0,0) scale(1); opacity: 1; }
          45% { opacity: 0; } /* Fade out quickly as they move */
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }

        @keyframes shadowJump {
          0%, 100% { transform: scale(0.3); opacity: 0.1; }
          35% { transform: scale(1.2); opacity: 0.4; }
          90% { transform: scale(0.3); opacity: 0.1; }
        }
      `}),t.jsxs("div",{className:"relative flex flex-col items-center h-48 justify-center",children:[t.jsx("div",{className:"absolute top-[50%] left-[50%] w-0 h-0 z-0",children:[...Array(6)].map((i,e)=>{const n=e*60*(Math.PI/180),l=40,f=Math.cos(n)*l+"px",d=Math.sin(n)*l-20+"px";return t.jsx("div",{className:"absolute w-1.5 h-1.5 rounded-full",style:{backgroundColor:a,"--tx":f,"--ty":d,animation:"splashOut 3s ease-out infinite"}},e)})}),t.jsx("div",{className:"absolute w-5 h-5 rounded-full z-20",style:{backgroundColor:a,animation:"ballDrop 3s cubic-bezier(0.45, 0, 0.55, 1) infinite"}}),t.jsx("div",{className:"relative z-10 flex items-center justify-center",style:{animation:"logoCycle 3s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite",transformOrigin:"bottom center"},children:t.jsxs("svg",{width:"180",height:"80",viewBox:"0 0 180 80",className:"overflow-visible",children:[t.jsxs("g",{transform:"translate(40, 40)",children:[t.jsx("path",{d:"M 25 -15 A 28 28 0 1 0 25 20",fill:"none",stroke:a,strokeWidth:"7",strokeLinecap:"round",strokeDasharray:"200",style:{animation:"drawStroke 3s ease-in-out infinite"},transform:"rotate(-15)"}),t.jsx("path",{d:"M -15 22 L -25 35 L -5 27 Z",fill:a,style:{animation:"logoCycle 3s infinite"}}),t.jsx("circle",{cx:"-12",cy:"5",r:"4.5",fill:a,style:{animation:"dotWave 1s ease-in-out infinite",animationDelay:"0s"}}),t.jsx("circle",{cx:"0",cy:"5",r:"4.5",fill:a,style:{animation:"dotWave 1s ease-in-out infinite",animationDelay:"0.15s"}}),t.jsx("circle",{cx:"12",cy:"5",r:"4.5",fill:a,style:{animation:"dotWave 1s ease-in-out infinite",animationDelay:"0.3s"}})]}),t.jsx("text",{x:"80",y:"58",fontFamily:"Arial, sans-serif",fontWeight:"bold",fontSize:"48",fill:a,style:{animation:"textSlide 3s ease-out infinite"},children:"aBa"})]})}),t.jsx("div",{className:"absolute bottom-6 rounded-[100%] border-solid box-border z-0",style:{borderColor:a,animation:"rippleEffect 3s linear infinite"}}),t.jsx("div",{className:`absolute bottom-6 w-16 h-1.5 rounded-full blur-sm transition-colors duration-500
            ${r?"bg-black/40":"bg-gray-400/40"}`,style:{animation:"shadowJump 3s cubic-bezier(0.45, 0, 0.55, 1) infinite"}})]}),t.jsx("div",{className:"mt-8 text-center",children:t.jsx("p",{className:"text-xs font-bold tracking-[0.3em] uppercase transition-colors duration-500",style:{color:a,opacity:.8},children:"Loading"})})]})};export{j as default};
