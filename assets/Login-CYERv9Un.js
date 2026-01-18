import{u as f,r as a,j as e,L as l}from"./index-CJ6frATz.js";const x=()=>{const{signInWithGoogle:c}=f(),[n,r]=a.useState(!1),[o,t]=a.useState(""),[d,h]=a.useState(!1),[i,g]=a.useState(!1);a.useEffect(()=>{h(!0)},[]);const m=async()=>{if(!i){t("Please agree to the terms and conditions.");return}try{r(!0),t("");const s=await c();s.success||t(s.error||"Google sign in failed")}catch{t("An error occurred. Please try again.")}finally{r(!1)}};return e.jsxs("div",{className:"auth-page login-page",children:[e.jsxs("div",{className:`auth-container ${d?"visible":""}`,children:[e.jsxs("div",{className:"auth-header",children:[e.jsx("div",{className:"app-logo",children:"CaBa"}),e.jsx("h2",{children:"Welcome Back"}),e.jsx("p",{children:"Sign in to continue your conversations"})]}),e.jsxs("div",{className:"auth-form",children:[o&&e.jsx("div",{className:"error-message animate-shake",children:o}),e.jsxs("div",{className:"terms-agreement",children:[e.jsx("input",{type:"checkbox",id:"terms",checked:i,onChange:s=>g(s.target.checked)}),e.jsxs("label",{htmlFor:"terms",children:["I agree to the ",e.jsx(l,{to:"/terms",children:"Terms and Conditions"})," and ",e.jsx(l,{to:"/privacy",children:"Privacy Policy"}),"."]})]}),e.jsxs("button",{type:"button",className:`btn btn-google ${n?"loading":""}`,onClick:m,disabled:n||!i,children:[e.jsxs("svg",{width:"18",height:"18",viewBox:"0 0 24 24",children:[e.jsx("path",{fill:"#4285F4",d:"M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"}),e.jsx("path",{fill:"#34A853",d:"M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"}),e.jsx("path",{fill:"#FBBC05",d:"M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"}),e.jsx("path",{fill:"#EA4335",d:"M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"})]}),n?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"spinner"}),"Signing in..."]}):"Continue with Google"]})]})]}),e.jsx("style",{children:`
        .auth-container.visible {
          animation: slideIn 0.6s ease-out;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(50px) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }

        .btn-google.loading {
          position: relative;
          overflow: hidden;
        }

        .btn-google.loading::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `})]})};export{x as default};
