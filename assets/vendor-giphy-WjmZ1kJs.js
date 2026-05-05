import{R as f,r as E,a as ii,b as qt,g as Jr}from"./vendor-react-CXp5nHmk.js";import{t as oi}from"./vendor-supabase-CY7rS9wC.js";let Ke;const si=new Uint8Array(16);function ai(){if(!Ke&&(Ke=typeof crypto<"u"&&crypto.getRandomValues&&crypto.getRandomValues.bind(crypto),!Ke))throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");return Ke(si)}const K=[];for(let e=0;e<256;++e)K.push((e+256).toString(16).slice(1));function ci(e,t=0){return K[e[t+0]]+K[e[t+1]]+K[e[t+2]]+K[e[t+3]]+"-"+K[e[t+4]]+K[e[t+5]]+"-"+K[e[t+6]]+K[e[t+7]]+"-"+K[e[t+8]]+K[e[t+9]]+"-"+K[e[t+10]]+K[e[t+11]]+K[e[t+12]]+K[e[t+13]]+K[e[t+14]]+K[e[t+15]]}const li=typeof crypto<"u"&&crypto.randomUUID&&crypto.randomUUID.bind(crypto),dr={randomUUID:li};function ui(e,t,r){if(dr.randomUUID&&!e)return dr.randomUUID();e=e||{};const n=e.random||(e.rng||ai)();return n[6]=n[6]&15|64,n[8]=n[8]&63|128,ci(n)}var fi=Object.defineProperty,di=Object.defineProperties,hi=Object.getOwnPropertyDescriptors,hr=Object.getOwnPropertySymbols,pi=Object.prototype.hasOwnProperty,gi=Object.prototype.propertyIsEnumerable,pr=(e,t,r)=>t in e?fi(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,Wt=(e,t)=>{for(var r in t||(t={}))pi.call(t,r)&&pr(e,r,t[r]);if(hr)for(var r of hr(t))gi.call(t,r)&&pr(e,r,t[r]);return e},mi=(e,t)=>di(e,hi(t)),Q={ENABLED:typeof window<"u"&&typeof location<"u"&&location.search.indexOf("giphy-debug")!==-1,LEVEL:0,PREFIX:"GiphyJS",debug:(...e)=>{Q.ENABLED&&Q.LEVEL<=0&&console.debug(Q.PREFIX,...e)},info:(...e)=>{Q.ENABLED&&Q.LEVEL<=1&&console.info(Q.PREFIX,...e)},warn:(...e)=>{Q.ENABLED&&Q.LEVEL<=2&&console.warn(Q.PREFIX,...e)},error:(...e)=>{Q.ENABLED&&Q.LEVEL<=3&&console.error(Q.PREFIX,...e)}},vi=(e,t,r)=>{let n=1/0,i;return r.forEach(o=>{const s=o.width/e,d=o.height/t,u=s*d,g=Math.abs(1-u);g<n&&(n=g,i=o)}),i},yi=50;function bi(e,t,r,n=yi){let[i]=e;const o=e.filter(s=>(s.width*s.height>i.width*i.height&&(i=s),t-s.width<=n&&r-s.height<=n));return o.length===0?i:vi(t,r,o)}var en=bi;function wi(e,t=0){return e.slice(0,t)}function _i(e,t){return e.filter(r=>t.indexOf(r)===-1)}function Rt(e,t){const r={};return t.forEach(n=>{e[n]!==void 0&&(r[n]=e[n])}),r}var Ei=e=>{let t=0,r=0;const n=e.offsetWidth,i=e.offsetHeight;do t+=e.offsetLeft,r+=e.offsetTop,e=e.offsetParent;while(e);const o={left:t,top:r,width:n,height:i,right:t+n,bottom:r+i,x:t,y:r};return mi(Wt({},o),{toJSON:()=>JSON.stringify(o)})},Ci=Ei,Ee="",tn=16,rn=()=>{let e="";const t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",r=t.length;for(let n=0;n<tn;n++)e+=t.charAt(Math.floor(Math.random()*r));return e},xi=()=>{if(!Ee){try{Ee=sessionStorage.getItem("giphyPingbackId")}catch{}if(!Ee){const e=new Date().getTime().toString(16);try{Ee=`${e}${ui().replace(/-/g,"")}`.substring(0,tn)}catch{Ee=rn()}try{sessionStorage.setItem("giphyPingbackId",Ee)}catch{}}}return Ee},Zt=xi,Qe=null;new Promise(e=>{typeof Image>"u"&&e(!1);const t=new Image;t.onload=()=>{Qe=!0,e(Qe)},t.onerror=()=>{Qe=!1,e(Qe)},t.src="data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA"});var gr=(e,t,r)=>{let n=e==null?void 0:e.assets;if(n){n=Wt({},n),delete n.source;const i=Object.values(n).sort((o,s)=>o.width-s.width);return en(i,t,r)}},$i=(e,t,r,n)=>{const i=Rt(e,["original","fixed_width","fixed_height","fixed_width_small","fixed_height_small"]),o=Object.entries(i).map(([s,d])=>Wt({renditionName:s},d));return en(o,t,r,n)},ft=({images:e},t)=>{const{fixed_width:r}=e;if(r){const{width:n,height:i}=r,o=n/i;return Math.round(t/o)}return 0},Li=({images:e},t)=>{const{fixed_width:r}=e;if(r){const{width:n,height:i}=r,o=n/i;return Math.round(t*o)}return 0},ki=({alt_text:e,user:t,tags:r=[],is_sticker:n=!1,title:i=""})=>{if(e)return e;if(i)return i;const o=t&&t.username||"",s=wi(_i(r,["transparent"]),o?4:5);return`${o?`${o} `:""}${s.join(" ")} ${n?"Sticker":"GIF"}`},Me=(typeof window<"u"?window:global)||{};Me._GIPHY_SDK_HEADERS_=Me._GIPHY_SDK_HEADERS_||(Me.Headers?new Me.Headers({"X-GIPHY-SDK-PLATFORM":"web"}):void 0);var Yt=()=>Me._GIPHY_SDK_HEADERS_,Pt=(e,t)=>{var r;return(r=Yt())==null?void 0:r.set(e,t)},Si=Object.defineProperty,Ai=Object.defineProperties,Ii=Object.getOwnPropertyDescriptors,Ri=Object.getOwnPropertyNames,mr=Object.getOwnPropertySymbols,Pi=Object.prototype.hasOwnProperty,Oi=Object.prototype.propertyIsEnumerable,vr=(e,t,r)=>t in e?Si(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,fe=(e,t)=>{for(var r in t||(t={}))Pi.call(t,r)&&vr(e,r,t[r]);if(mr)for(var r of mr(t))Oi.call(t,r)&&vr(e,r,t[r]);return e},Et=(e,t)=>Ai(e,Ii(t)),Di=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,r)=>(typeof require<"u"?require:t)[r]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')}),Ti=(e,t)=>function(){return t||(0,e[Ri(e)[0]])((t={exports:{}}).exports,t),t.exports},nn=(e,t,r)=>new Promise((n,i)=>{var o=u=>{try{d(r.next(u))}catch(g){i(g)}},s=u=>{try{d(r.throw(u))}catch(g){i(g)}},d=u=>u.done?n(u.value):Promise.resolve(u.value).then(o,s);d((r=r.apply(e,t)).next())}),Ni=Ti({"package.json"(e,t){t.exports={scripts:{lint:"run -T eslint . --ext .ts,.tsx",clean:"rm -rf ./dist",dev:"parcel public/test.html",docs:"typedoc src/index.ts",build:"run -T tsup src/index.ts --format cjs,esm --dts && run -T publint",prepublish:"npm run clean && npm run build",test:"run -T jest --config ./jestconfig.js","test:watch":"run -T jest --config ./jestconfig.js --watchAll"},name:"@giphy/js-fetch-api",version:"5.7.0",description:"Javascript API to fetch gifs and stickers from the GIPHY API.",homepage:"https://github.com/Giphy/giphy-js/tree/master/packages/fetch-api",main:"dist/index.cjs",types:"dist/index.d.ts",module:"dist/index.js",type:"module",sideEffects:!1,exports:{".":{types:"./dist/index.d.ts",import:"./dist/index.js",require:"./dist/index.cjs"},"./package.json":"./package.json"},files:["dist/","src/**/*"],license:"MIT",publishConfig:{access:"public"},dependencies:{"@giphy/js-types":"*","@giphy/js-util":"*"},devDependencies:{"jest-fetch-mock":"^3.0.3","parcel-bundler":"latest",typedoc:"^0.20.37","typedoc-thunder-theme":"^0.0.3",typescript:"^5.0.4"}}}}),Fi=["is_anonymous","is_community","is_featured","is_hidden","is_indexable","is_preserve_size","is_realtime","is_removed","is_sticker","is_dynamic"],Mi=["suppress_chrome","is_public","is_verified"],yr=e=>t=>e[t]=!!e[t],ji=e=>typeof e=="string"?e:e.text,on=(e,t="")=>{const r=fe({},e);r.id=String(r.id),r.tags=(r.tags||[]).map(ji),r.bottle_data||(r.bottle_data={}),r.response_id=t,Fi.forEach(yr(r)),Object.keys(r.images||{}).forEach(i=>{const o=r.images[i];o.width=parseInt(o.width),o.height=parseInt(o.height)});const{user:n}=r;if(n){const i=fe({},n);Mi.forEach(yr(i)),r.user=i}return r},br=e=>{const{response_id:t}=e.meta;return e.data=on(e.data,t),e},pe=e=>{const{response_id:t}=e.meta;return e.data=e.data.map(r=>on(r,t)),e},Gi=(typeof window<"u"?window:global)||{},Bi=Gi.GIPHY_API_URL||"https://api.giphy.com/v1/",sn=class extends Error{constructor(t,r,n=0,i=""){super(t),this.url=r,this.status=n,this.statusText=i}},Hi=class extends sn{},wr=sn,Ui="@giphy/js-fetch-api: ",zi="Error fetching",Vi=e=>e,ce={},qi=6e4,Wi=6e3,Zi=()=>{const e=Date.now();Object.keys(ce).forEach(t=>{const r=ce[t].isError?Wi:qi;e-ce[t].ts>=r&&delete ce[t]})};function Yi(e,t={}){const{apiVersion:r=1,noCache:n=!1,normalizer:i=Vi}=t,o=Bi.replace(/\/v\d+\/$/,`/v${r}/`);if(Zi(),!ce[e]||n){const s=`${o}${e}`,d=()=>nn(this,null,function*(){var u,g;let m;try{const v=yield fetch(s,{method:"get"});if(v.ok){const y=yield v.json();if((u=y.meta)!=null&&u.response_id)return i(y);throw{message:"synthetic response"}}else{let y=zi;try{const b=yield v.json();b.message&&(y=b.message),(g=b.meta)!=null&&g.msg&&(y=b.meta.msg)}catch{}ce[e]&&(ce[e].isError=!0);let x=wr;y==="This content is not available in your location"&&(x=Hi),m=new x(`${Ui}${y}`,s,v.status,v.statusText)}}catch(v){m=new wr(v.message,s),ce[e]&&(ce[e].isError=!0)}throw m});ce[e]={request:d(),ts:Date.now()}}return ce[e].request}var ie=Yi,Ct=e=>e&&e.type?e.type:"gifs",Ki=class{constructor(e,t={}){this.getQS=(r={})=>new URLSearchParams(fe(Et(fe({},r),{api_key:this.apiKey,pingback_id:Zt()}),this.qsParams)).toString(),this.apiKey=e,this.qsParams=t}categories(e){return ie(`gifs/categories?${this.getQS(e)}`)}gif(e,t){const r=t!=null&&t.internal?"internal/":"";return ie(`${r}gifs/${e}?${this.getQS()}`,{normalizer:br})}gifs(e,t){return Array.isArray(e)?ie(`gifs?${this.getQS({ids:e.join(",")})}`,{normalizer:pe}):ie(`gifs/categories/${e}/${t}?${this.getQS()}`,{normalizer:pe})}emoji(e){return ie(`emoji?${this.getQS(e)}`,{normalizer:pe})}emojiDefaultVariations(e){return ie(`emoji?${this.getQS(e)}`,{apiVersion:2,normalizer:pe})}emojiVariations(e){return ie(`emoji/${e}/variations?${this.getQS()}`,{apiVersion:2,normalizer:pe})}animate(e,t={}){const r=this.getQS(Et(fe({},t),{m:e}));return ie(`text/animate?${r}`,{normalizer:pe})}search(e,t={}){const r=t.channel?`@${t.channel} ${e}`:e;let n;t.type==="text"&&(n=!0);const i=this.getQS(Et(fe({rating:"pg-13"},t),{q:r,excludeDynamicResults:n}));return ie(`${Ct(t)}/search?${i}`,{normalizer:pe})}subcategories(e,t){return ie(`gifs/categories/${e}?${this.getQS(t)}`)}trending(e={}){return ie(`${Ct(e)}/trending?${this.getQS(fe({rating:"pg-13"},e))}`,{normalizer:pe})}random(e){return ie(`${Ct(e)}/random?${this.getQS(fe({rating:"pg-13"},e))}`,{noCache:!0,normalizer:br})}related(e,t={}){const{type:r="gifs"}=t;return ie(`${r}/related?${this.getQS(fe({gif_id:e,rating:"pg-13"},t))}`,{normalizer:pe})}channels(e,t={}){return ie(`channels/search?${this.getQS(fe({q:e,rating:"pg-13"},t))}`)}},dc=Ki,Qi=Symbol("has inivisible gifs"),an=(e,t=[])=>{let r=[...t],n=t.map(s=>s.id),i=t.length,o=!1;return s=>nn(void 0,null,function*(){if(s&&(r=s,n=s.map(v=>v.id)),o)return r;const d=yield e(i),{pagination:u,data:g}=d;i=u.count+u.offset,o=i===u.total_count,g.forEach(v=>{const{id:y}=v;n.includes(y)||(r.push(v),n.push(y))});const m=[...r];return u.hasMoreGifs&&(m.skipCountCheck=Qi),m})},_r;if(typeof Di<"u"){const{version:e}=Ni();(_r=Yt())!=null&&_r.get("X-GIPHY-SDK-NAME")||(Pt("X-GIPHY-SDK-NAME","FetchAPI"),Pt("X-GIPHY-SDK-VERSION",e))}var j="-ms-",He="-moz-",T="-webkit-",cn="comm",dt="rule",Kt="decl",Xi="@import",Ji="@namespace",ln="@keyframes",eo="@layer",un=Math.abs,Qt=String.fromCharCode,Ot=Object.assign;function to(e,t){return Z(e,0)^45?(((t<<2^Z(e,0))<<2^Z(e,1))<<2^Z(e,2))<<2^Z(e,3):0}function fn(e){return e.trim()}function ge(e,t){return(e=t.exec(e))?e[0]:e}function I(e,t,r){return e.replace(t,r)}function rt(e,t,r){return e.indexOf(t,r)}function Z(e,t){return e.charCodeAt(t)|0}function Le(e,t,r){return e.slice(t,r)}function le(e){return e.length}function dn(e){return e.length}function je(e,t){return t.push(e),e}function ro(e,t){return e.map(t).join("")}function Er(e,t){return e.filter(function(r){return!ge(r,t)})}var ht=1,Ie=1,hn=0,se=0,W=0,Oe="";function pt(e,t,r,n,i,o,s,d){return{value:e,root:t,parent:r,type:n,props:i,children:o,line:ht,column:Ie,length:s,return:"",siblings:d}}function ye(e,t){return Ot(pt("",null,null,"",null,null,0,e.siblings),e,{length:-e.length},t)}function ke(e){for(;e.root;)e=ye(e.root,{children:[e]});je(e,e.siblings)}function no(){return W}function io(){return W=se>0?Z(Oe,--se):0,Ie--,W===10&&(Ie=1,ht--),W}function ue(){return W=se<hn?Z(Oe,se++):0,Ie++,W===10&&(Ie=1,ht++),W}function be(){return Z(Oe,se)}function nt(){return se}function gt(e,t){return Le(Oe,e,t)}function ze(e){switch(e){case 0:case 9:case 10:case 13:case 32:return 5;case 33:case 43:case 44:case 47:case 62:case 64:case 126:case 59:case 123:case 125:return 4;case 58:return 3;case 34:case 39:case 40:case 91:return 2;case 41:case 93:return 1}return 0}function oo(e){return ht=Ie=1,hn=le(Oe=e),se=0,[]}function so(e){return Oe="",e}function xt(e){return fn(gt(se-1,Dt(e===91?e+2:e===40?e+1:e)))}function ao(e){for(;(W=be())&&W<33;)ue();return ze(e)>2||ze(W)>3?"":" "}function co(e,t){for(;--t&&ue()&&!(W<48||W>102||W>57&&W<65||W>70&&W<97););return gt(e,nt()+(t<6&&be()==32&&ue()==32))}function Dt(e){for(;ue();)switch(W){case e:return se;case 34:case 39:e!==34&&e!==39&&Dt(W);break;case 40:e===41&&Dt(e);break;case 92:ue();break}return se}function lo(e,t){for(;ue()&&e+W!==57;)if(e+W===84&&be()===47)break;return"/*"+gt(t,se-1)+"*"+Qt(e===47?e:ue())}function uo(e){for(;!ze(be());)ue();return gt(e,se)}function fo(e){return so(it("",null,null,null,[""],e=oo(e),0,[0],e))}function it(e,t,r,n,i,o,s,d,u){for(var g=0,m=0,v=s,y=0,x=0,b=0,k=1,$=1,S=1,w=0,a="",c=i,l=o,p=n,h=a;$;)switch(b=w,w=ue()){case 40:if(b!=108&&Z(h,v-1)==58){rt(h+=I(xt(w),"&","&\f"),"&\f",un(g?d[g-1]:0))!=-1&&(S=-1);break}case 34:case 39:case 91:h+=xt(w);break;case 9:case 10:case 13:case 32:h+=ao(b);break;case 92:h+=co(nt()-1,7);continue;case 47:switch(be()){case 42:case 47:je(ho(lo(ue(),nt()),t,r,u),u),(ze(b||1)==5||ze(be()||1)==5)&&le(h)&&Le(h,-1,void 0)!==" "&&(h+=" ");break;default:h+="/"}break;case 123*k:d[g++]=le(h)*S;case 125*k:case 59:case 0:switch(w){case 0:case 125:$=0;case 59+m:S==-1&&(h=I(h,/\f/g,"")),x>0&&(le(h)-v||k===0&&b===47)&&je(x>32?xr(h+";",n,r,v-1,u):xr(I(h," ","")+";",n,r,v-2,u),u);break;case 59:h+=";";default:if(je(p=Cr(h,t,r,g,m,i,d,a,c=[],l=[],v,o),o),w===123)if(m===0)it(h,t,p,p,c,o,v,d,l);else{switch(y){case 99:if(Z(h,3)===110)break;case 108:if(Z(h,2)===97)break;default:m=0;case 100:case 109:case 115:}m?it(e,p,p,n&&je(Cr(e,p,p,0,0,i,d,a,i,c=[],v,l),l),i,l,v,d,n?c:l):it(h,p,p,p,[""],l,0,d,l)}}g=m=x=0,k=S=1,a=h="",v=s;break;case 58:v=1+le(h),x=b;default:if(k<1){if(w==123)--k;else if(w==125&&k++==0&&io()==125)continue}switch(h+=Qt(w),w*k){case 38:S=m>0?1:(h+="\f",-1);break;case 44:d[g++]=(le(h)-1)*S,S=1;break;case 64:be()===45&&(h+=xt(ue())),y=be(),m=v=le(a=h+=uo(nt())),w++;break;case 45:b===45&&le(h)==2&&(k=0)}}return o}function Cr(e,t,r,n,i,o,s,d,u,g,m,v){for(var y=i-1,x=i===0?o:[""],b=dn(x),k=0,$=0,S=0;k<n;++k)for(var w=0,a=Le(e,y+1,y=un($=s[k])),c=e;w<b;++w)(c=fn($>0?x[w]+" "+a:I(a,/&\f/g,x[w])))&&(u[S++]=c);return pt(e,t,r,i===0?dt:d,u,g,m,v)}function ho(e,t,r,n){return pt(e,t,r,cn,Qt(no()),Le(e,2,-2),0,n)}function xr(e,t,r,n,i){return pt(e,t,r,Kt,Le(e,0,n),Le(e,n+1,-1),n,i)}function pn(e,t,r){switch(to(e,t)){case 5103:return T+"print-"+e+e;case 5737:case 4201:case 3177:case 3433:case 1641:case 4457:case 2921:case 5572:case 6356:case 5844:case 3191:case 6645:case 3005:case 4215:case 6389:case 5109:case 5365:case 5621:case 3829:case 6391:case 5879:case 5623:case 6135:case 4599:return T+e+e;case 4855:return T+e.replace("add","source-over").replace("substract","source-out").replace("intersect","source-in").replace("exclude","xor")+e;case 4789:return He+e+e;case 5349:case 4246:case 4810:case 6968:case 2756:return T+e+He+e+j+e+e;case 5936:switch(Z(e,t+11)){case 114:return T+e+j+I(e,/[svh]\w+-[tblr]{2}/,"tb")+e;case 108:return T+e+j+I(e,/[svh]\w+-[tblr]{2}/,"tb-rl")+e;case 45:return T+e+j+I(e,/[svh]\w+-[tblr]{2}/,"lr")+e}case 6828:case 4268:case 2903:return T+e+j+e+e;case 6165:return T+e+j+"flex-"+e+e;case 5187:return T+e+I(e,/(\w+).+(:[^]+)/,T+"box-$1$2"+j+"flex-$1$2")+e;case 5443:return T+e+j+"flex-item-"+I(e,/flex-|-self/g,"")+(ge(e,/flex-|baseline/)?"":j+"grid-row-"+I(e,/flex-|-self/g,""))+e;case 4675:return T+e+j+"flex-line-pack"+I(e,/align-content|flex-|-self/g,"")+e;case 5548:return T+e+j+I(e,"shrink","negative")+e;case 5292:return T+e+j+I(e,"basis","preferred-size")+e;case 6060:return T+"box-"+I(e,"-grow","")+T+e+j+I(e,"grow","positive")+e;case 4554:return T+I(e,/([^-])(transform)/g,"$1"+T+"$2")+e;case 6187:return I(I(I(e,/(zoom-|grab)/,T+"$1"),/(image-set)/,T+"$1"),e,"")+e;case 5495:case 3959:return I(e,/(image-set\([^]*)/,T+"$1$`$1");case 4968:return I(I(e,/(.+:)(flex-)?(.*)/,T+"box-pack:$3"+j+"flex-pack:$3"),/space-between/,"justify")+T+e+e;case 4200:if(!ge(e,/flex-|baseline/))return j+"grid-column-align"+Le(e,t)+e;break;case 2592:case 3360:return j+I(e,"template-","")+e;case 4384:case 3616:return r&&r.some(function(n,i){return t=i,ge(n.props,/grid-\w+-end/)})?~rt(e+(r=r[t].value),"span",0)?e:j+I(e,"-start","")+e+j+"grid-row-span:"+(~rt(r,"span",0)?ge(r,/\d+/):+ge(r,/\d+/)-+ge(e,/\d+/))+";":j+I(e,"-start","")+e;case 4896:case 4128:return r&&r.some(function(n){return ge(n.props,/grid-\w+-start/)})?e:j+I(I(e,"-end","-span"),"span ","")+e;case 4095:case 3583:case 4068:case 2532:return I(e,/(.+)-inline(.+)/,T+"$1$2")+e;case 8116:case 7059:case 5753:case 5535:case 5445:case 5701:case 4933:case 4677:case 5533:case 5789:case 5021:case 4765:if(le(e)-1-t>6)switch(Z(e,t+1)){case 109:if(Z(e,t+4)!==45)break;case 102:return I(e,/(.+:)(.+)-([^]+)/,"$1"+T+"$2-$3$1"+He+(Z(e,t+3)==108?"$3":"$2-$3"))+e;case 115:return~rt(e,"stretch",0)?pn(I(e,"stretch","fill-available"),t,r)+e:e}break;case 5152:case 5920:return I(e,/(.+?):(\d+)(\s*\/\s*(span)?\s*(\d+))?(.*)/,function(n,i,o,s,d,u,g){return j+i+":"+o+g+(s?j+i+"-span:"+(d?u:+u-+o)+g:"")+e});case 4949:if(Z(e,t+6)===121)return I(e,":",":"+T)+e;break;case 6444:switch(Z(e,Z(e,14)===45?18:11)){case 120:return I(e,/(.+:)([^;\s!]+)(;|(\s+)?!.+)?/,"$1"+T+(Z(e,14)===45?"inline-":"")+"box$3$1"+T+"$2$3$1"+j+"$2box$3")+e;case 100:return I(e,":",":"+j)+e}break;case 5719:case 2647:case 2135:case 3927:case 2391:return I(e,"scroll-","scroll-snap-")+e}return e}function lt(e,t){for(var r="",n=0;n<e.length;n++)r+=t(e[n],n,e,t)||"";return r}function po(e,t,r,n){switch(e.type){case eo:if(e.children.length)break;case Xi:case Ji:case Kt:return e.return=e.return||e.value;case cn:return"";case ln:return e.return=e.value+"{"+lt(e.children,n)+"}";case dt:if(!le(e.value=e.props.join(",")))return""}return le(r=lt(e.children,n))?e.return=e.value+"{"+r+"}":""}function go(e){var t=dn(e);return function(r,n,i,o){for(var s="",d=0;d<t;d++)s+=e[d](r,n,i,o)||"";return s}}function mo(e){return function(t){t.root||(t=t.return)&&e(t)}}function vo(e,t,r,n){if(e.length>-1&&!e.return)switch(e.type){case Kt:e.return=pn(e.value,e.length,r);return;case ln:return lt([ye(e,{value:I(e.value,"@","@"+T)})],n);case dt:if(e.length)return ro(r=e.props,function(i){switch(ge(i,n=/(::plac\w+|:read-\w+)/)){case":read-only":case":read-write":ke(ye(e,{props:[I(i,/:(read-\w+)/,":"+He+"$1")]})),ke(ye(e,{props:[i]})),Ot(e,{props:Er(r,n)});break;case"::placeholder":ke(ye(e,{props:[I(i,/:(plac\w+)/,":"+T+"input-$1")]})),ke(ye(e,{props:[I(i,/:(plac\w+)/,":"+He+"$1")]})),ke(ye(e,{props:[I(i,/:(plac\w+)/,j+"input-$1")]})),ke(ye(e,{props:[i]})),Ot(e,{props:Er(r,n)});break}return""})}}var Ae={},$t,Lt;const Re=typeof process<"u"&&Ae!==void 0&&(Ae.REACT_APP_SC_ATTR||Ae.SC_ATTR)||"data-styled",gn="active",mn="data-styled-version",mt="6.4.1",Xt=`/*!sc*/
`,Ue=typeof window<"u"&&typeof document<"u";function $r(e){if(typeof process<"u"&&Ae!==void 0){const t=Ae[e];if(t!==void 0&&t!=="")return t!=="false"}}const yo=!!(typeof SC_DISABLE_SPEEDY=="boolean"?SC_DISABLE_SPEEDY:(Lt=($t=$r("REACT_APP_SC_DISABLE_SPEEDY"))!==null&&$t!==void 0?$t:$r("SC_DISABLE_SPEEDY"))!==null&&Lt!==void 0?Lt:typeof process>"u"||Ae===void 0),vn="sc-keyframes-";function Ze(e,...t){return new Error(`An error occurred. See https://github.com/styled-components/styled-components/blob/main/packages/styled-components/src/utils/errors.md#${e} for more information.${t.length>0?` Args: ${t.join(", ")}`:""}`)}let ot=new Map,ut=new Map,st=1;const Ge=e=>{if(ot.has(e))return ot.get(e);for(;ut.has(st);)st++;const t=st++;return ot.set(e,t),ut.set(t,e),t},bo=e=>ut.get(e),wo=(e,t)=>{st=t+1,ot.set(e,t),ut.set(t,e)},Jt=Object.freeze([]),Pe=Object.freeze({});function _o(e,t,r=Pe){return e.theme!==r.theme&&e.theme||t||r.theme}const Eo=/[!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~-]+/g,Co=/(^-|-$)/g;function yn(e){return e.replace(Eo,"-").replace(Co,"")}const xo=/(a)(d)/gi,Lr=e=>String.fromCharCode(e+(e>25?39:97));function er(e){let t,r="";for(t=Math.abs(e);t>52;t=t/52|0)r=Lr(t%52)+r;return(Lr(t%52)+r).replace(xo,"$1-$2")}const Tt=5381,xe=(e,t)=>{let r=t.length;for(;r;)e=33*e^t.charCodeAt(--r);return e},bn=e=>xe(Tt,e);function wn(e){return er(bn(e)>>>0)}function $o(e){return e.displayName||e.name||"Component"}function Nt(e){return typeof e=="string"&&!0}function Lo(e){return Nt(e)?`styled.${e}`:`Styled(${$o(e)})`}const _n=Symbol.for("react.memo"),ko=Symbol.for("react.forward_ref"),So={contextType:!0,defaultProps:!0,displayName:!0,getDerivedStateFromError:!0,getDerivedStateFromProps:!0,propTypes:!0,type:!0},Ao={name:!0,length:!0,prototype:!0,caller:!0,callee:!0,arguments:!0,arity:!0},En={$$typeof:!0,compare:!0,defaultProps:!0,displayName:!0,propTypes:!0,type:!0},Io={[ko]:{$$typeof:!0,render:!0,defaultProps:!0,displayName:!0,propTypes:!0},[_n]:En};function kr(e){return("type"in(t=e)&&t.type.$$typeof)===_n?En:"$$typeof"in e?Io[e.$$typeof]:So;var t}const Ro=Object.defineProperty,Po=Object.getOwnPropertyNames,Oo=Object.getOwnPropertySymbols,Do=Object.getOwnPropertyDescriptor,To=Object.getPrototypeOf,No=Object.prototype;function Cn(e,t,r){if(typeof t!="string"){const n=To(t);n&&n!==No&&Cn(e,n,r);const i=Po(t).concat(Oo(t)),o=kr(e),s=kr(t);for(let d=0;d<i.length;++d){const u=i[d];if(!(u in Ao||r&&r[u]||s&&u in s||o&&u in o)){const g=Do(t,u);try{Ro(e,u,g)}catch{}}}}return e}function vt(e){return typeof e=="function"}function xn(e){return typeof e=="object"&&"styledComponentId"in e}function Be(e,t){return e&&t?e+" "+t:e||t||""}function Ft(e,t){return e.join("")}function Ve(e){return e!==null&&typeof e=="object"&&e.constructor.name===Object.name&&!("props"in e&&e.$$typeof)}function Mt(e,t,r=!1){if(!r&&!Ve(e)&&!Array.isArray(e))return t;if(Array.isArray(t))for(let n=0;n<t.length;n++)e[n]=Mt(e[n],t[n]);else if(Ve(t))for(const n in t)e[n]=Mt(e[n],t[n]);return e}function tr(e,t){Object.defineProperty(e,"toString",{value:t})}const Fo=class{constructor(e){this.groupSizes=new Uint32Array(512),this.length=512,this.tag=e,this._cGroup=0,this._cIndex=0}indexOfGroup(e){if(e===this._cGroup)return this._cIndex;let t=this._cIndex;if(e>this._cGroup)for(let r=this._cGroup;r<e;r++)t+=this.groupSizes[r];else for(let r=this._cGroup-1;r>=e;r--)t-=this.groupSizes[r];return this._cGroup=e,this._cIndex=t,t}insertRules(e,t){if(e>=this.groupSizes.length){const i=this.groupSizes,o=i.length;let s=o;for(;e>=s;)if(s<<=1,s<0)throw Ze(16,`${e}`);this.groupSizes=new Uint32Array(s),this.groupSizes.set(i),this.length=s;for(let d=o;d<s;d++)this.groupSizes[d]=0}let r=this.indexOfGroup(e+1),n=0;for(let i=0,o=t.length;i<o;i++)this.tag.insertRule(r,t[i])&&(this.groupSizes[e]++,r++,n++);n>0&&this._cGroup>e&&(this._cIndex+=n)}clearGroup(e){if(e<this.length){const t=this.groupSizes[e],r=this.indexOfGroup(e),n=r+t;this.groupSizes[e]=0;for(let i=r;i<n;i++)this.tag.deleteRule(r);t>0&&this._cGroup>e&&(this._cIndex-=t)}}getGroup(e){let t="";if(e>=this.length||this.groupSizes[e]===0)return t;const r=this.groupSizes[e],n=this.indexOfGroup(e),i=n+r;for(let o=n;o<i;o++)t+=this.tag.getRule(o)+Xt;return t}},Mo=`style[${Re}][${mn}="${mt}"]`,jo=new RegExp(`^${Re}\\.g(\\d+)\\[id="([\\w\\d-]+)"\\].*?"([^"]*)`),Sr=e=>typeof ShadowRoot<"u"&&e instanceof ShadowRoot||"host"in e&&e.nodeType===11,jt=e=>{if(!e)return document;if(Sr(e))return e;if("getRootNode"in e){const t=e.getRootNode();if(Sr(t))return t}return document},Go=(e,t,r)=>{const n=r.split(",");let i;for(let o=0,s=n.length;o<s;o++)(i=n[o])&&e.registerName(t,i)},Bo=(e,t)=>{var r;const n=((r=t.textContent)!==null&&r!==void 0?r:"").split(Xt),i=[];for(let o=0,s=n.length;o<s;o++){const d=n[o].trim();if(!d)continue;const u=d.match(jo);if(u){const g=0|parseInt(u[1],10),m=u[2];g!==0&&(wo(m,g),Go(e,m,u[3]),e.getTag().insertRules(g,i)),i.length=0}else i.push(d)}},kt=e=>{const t=jt(e.options.target).querySelectorAll(Mo);for(let r=0,n=t.length;r<n;r++){const i=t[r];i&&i.getAttribute(Re)!==gn&&(Bo(e,i),i.parentNode&&i.parentNode.removeChild(i))}};let Te=!1;function Ho(){if(Te!==!1)return Te;if(typeof document<"u"){const e=document.head.querySelector('meta[property="csp-nonce"]');if(e)return Te=e.nonce||e.getAttribute("content")||void 0;const t=document.head.querySelector('meta[name="sc-nonce"]');if(t)return Te=t.getAttribute("content")||void 0}return Te=typeof __webpack_nonce__<"u"?__webpack_nonce__:void 0}const $n=(e,t)=>{const r=document.head,n=e||r,i=document.createElement("style"),o=(u=>{const g=Array.from(u.querySelectorAll(`style[${Re}]`));return g[g.length-1]})(n),s=o!==void 0?o.nextSibling:null;i.setAttribute(Re,gn),i.setAttribute(mn,mt);const d=t||Ho();return d&&i.setAttribute("nonce",d),n.insertBefore(i,s),i},Uo=class{constructor(e,t){this.element=$n(e,t),this.element.appendChild(document.createTextNode("")),this.sheet=(r=>{var n;if(r.sheet)return r.sheet;const i=(n=r.getRootNode().styleSheets)!==null&&n!==void 0?n:document.styleSheets;for(let o=0,s=i.length;o<s;o++){const d=i[o];if(d.ownerNode===r)return d}throw Ze(17)})(this.element),this.length=0}insertRule(e,t){try{return this.sheet.insertRule(t,e),this.length++,!0}catch{return!1}}deleteRule(e){this.sheet.deleteRule(e),this.length--}getRule(e){const t=this.sheet.cssRules[e];return t&&t.cssText?t.cssText:""}},zo=class{constructor(e,t){this.element=$n(e,t),this.nodes=this.element.childNodes,this.length=0}insertRule(e,t){if(e<=this.length&&e>=0){const r=document.createTextNode(t);return this.element.insertBefore(r,this.nodes[e]||null),this.length++,!0}return!1}deleteRule(e){this.element.removeChild(this.nodes[e]),this.length--}getRule(e){return e<this.length?this.nodes[e].textContent:""}};let Ar=Ue;const Vo={isServer:!Ue,useCSSOMInjection:!yo};class yt{static registerId(t){return Ge(t)}constructor(t=Pe,r={},n){this.options=Object.assign(Object.assign({},Vo),t),this.gs=r,this.keyframeIds=new Set,this.names=new Map(n),this.server=!!t.isServer,!this.server&&Ue&&Ar&&(Ar=!1,kt(this)),tr(this,()=>(i=>{const o=i.getTag(),{length:s}=o;let d="";for(let u=0;u<s;u++){const g=bo(u);if(g===void 0)continue;const m=i.names.get(g);if(m===void 0||!m.size)continue;const v=o.getGroup(u);if(v.length===0)continue;const y=Re+".g"+u+'[id="'+g+'"]';let x="";for(const b of m)b.length>0&&(x+=b+",");d+=v+y+'{content:"'+x+'"}'+Xt}return d})(this))}rehydrate(){!this.server&&Ue&&kt(this)}reconstructWithOptions(t,r=!0){const n=new yt(Object.assign(Object.assign({},this.options),t),this.gs,r&&this.names||void 0);return n.keyframeIds=new Set(this.keyframeIds),!this.server&&Ue&&t.target!==this.options.target&&jt(this.options.target)!==jt(t.target)&&kt(n),n}allocateGSInstance(t){return this.gs[t]=(this.gs[t]||0)+1}getTag(){return this.tag||(this.tag=(t=(({useCSSOMInjection:r,target:n,nonce:i})=>r?new Uo(n,i):new zo(n,i))(this.options),new Fo(t)));var t}hasNameForId(t,r){var n,i;return(i=(n=this.names.get(t))===null||n===void 0?void 0:n.has(r))!==null&&i!==void 0&&i}registerName(t,r){Ge(t),t.startsWith(vn)&&this.keyframeIds.add(t);const n=this.names.get(t);n?n.add(r):this.names.set(t,new Set([r]))}insertRules(t,r,n){this.registerName(t,r),this.getTag().insertRules(Ge(t),n)}clearNames(t){this.names.has(t)&&this.names.get(t).clear()}clearRules(t){this.getTag().clearGroup(Ge(t)),this.clearNames(t)}clearTag(){this.tag=void 0}}const Ln=new WeakSet,qo={animationIterationCount:1,aspectRatio:1,borderImageOutset:1,borderImageSlice:1,borderImageWidth:1,columnCount:1,columns:1,flex:1,flexGrow:1,flexShrink:1,gridRow:1,gridRowEnd:1,gridRowSpan:1,gridRowStart:1,gridColumn:1,gridColumnEnd:1,gridColumnSpan:1,gridColumnStart:1,fontWeight:1,lineHeight:1,opacity:1,order:1,orphans:1,scale:1,tabSize:1,widows:1,zIndex:1,zoom:1,WebkitLineClamp:1,fillOpacity:1,floodOpacity:1,stopOpacity:1,strokeDasharray:1,strokeDashoffset:1,strokeMiterlimit:1,strokeOpacity:1,strokeWidth:1};function Wo(e,t){return t==null||typeof t=="boolean"||t===""?"":typeof t!="number"||t===0||e in qo||e.startsWith("--")?String(t).trim():t+"px"}const Ce=47;function Ir(e){if(e.charCodeAt(0)===45&&e.charCodeAt(1)===45)return e;let t="";for(let r=0;r<e.length;r++){const n=e.charCodeAt(r);t+=n>=65&&n<=90?"-"+String.fromCharCode(n+32):e[r]}return t.startsWith("ms-")?"-"+t:t}const kn=Symbol.for("sc-keyframes");function Zo(e){return typeof e=="object"&&e!==null&&kn in e}function Sn(e){return vt(e)&&!(e.prototype&&e.prototype.isReactComponent)}const An=e=>e==null||e===!1||e==="",Yo=Symbol.for("react.client.reference");function Rr(e){return e.$$typeof===Yo}function In(e,t){for(const r in e){const n=e[r];e.hasOwnProperty(r)&&!An(n)&&(Array.isArray(n)&&Ln.has(n)||vt(n)?t.push(Ir(r)+":",n,";"):Ve(n)?(t.push(r+" {"),In(n,t),t.push("}")):t.push(Ir(r)+": "+Wo(r,n)+";"))}}function $e(e,t,r,n,i=[]){if(An(e))return i;const o=typeof e;if(o==="string")return i.push(e),i;if(o==="function"){if(Rr(e))return i;if(Sn(e)&&t){const s=e(t);return $e(s,t,r,n,i)}return i.push(e),i}if(Array.isArray(e)){for(let s=0;s<e.length;s++)$e(e[s],t,r,n,i);return i}return xn(e)?(i.push(`.${e.styledComponentId}`),i):Zo(e)?(r?(e.inject(r,n),i.push(e.getName(n))):i.push(e),i):Rr(e)?i:Ve(e)?(In(e,i),i):(i.push(e.toString()),i)}const Ko=bn(mt);class Qo{constructor(t,r,n){this.rules=t,this.componentId=r,this.baseHash=xe(Ko,r),this.baseStyle=n,yt.registerId(r)}generateAndInjectStyles(t,r,n){let i=this.baseStyle?this.baseStyle.generateAndInjectStyles(t,r,n):"";{let o="";for(let s=0;s<this.rules.length;s++){const d=this.rules[s];if(typeof d=="string")o+=d;else if(d)if(Sn(d)){const u=d(t);typeof u=="string"?o+=u:u!=null&&u!==!1&&(o+=Ft($e(u,t,r,n)))}else o+=Ft($e(d,t,r,n))}if(o){this.dynamicNameCache||(this.dynamicNameCache=new Map);const s=n.hash?n.hash+o:o;let d=this.dynamicNameCache.get(s);if(!d){if(d=er(xe(xe(this.baseHash,n.hash),o)>>>0),this.dynamicNameCache.size>=200){const u=this.dynamicNameCache.keys().next().value;u!==void 0&&this.dynamicNameCache.delete(u)}this.dynamicNameCache.set(s,d)}if(!r.hasNameForId(this.componentId,d)){const u=n(o,"."+d,void 0,this.componentId);r.insertRules(this.componentId,d,u)}i=Be(i,d)}}return i}}const Xo=/&/g;function Rn(e,t){let r=0;for(;--t>=0&&e.charCodeAt(t)===92;)r++;return!(1&~r)}function St(e){const t=e.length;let r="",n=0,i=0,o=0,s=!1,d=!1;for(let u=0;u<t;u++){const g=e.charCodeAt(u);if(o!==0||s||g!==Ce||e.charCodeAt(u+1)!==42)if(s)g===42&&e.charCodeAt(u+1)===Ce&&(s=!1,u++);else if(g!==34&&g!==39||Rn(e,u)){if(o===0)if(g===123)i++;else if(g===125){if(i--,i<0){d=!0;let m=u+1;for(;m<t;){const v=e.charCodeAt(m);if(v===59||v===10)break;m++}m<t&&e.charCodeAt(m)===59&&m++,i=0,u=m-1,n=m;continue}i===0&&(r+=e.substring(n,u+1),n=u+1)}else g===59&&i===0&&(r+=e.substring(n,u+1),n=u+1)}else o===0?o=g:o===g&&(o=0);else s=!0,u++}return d||i!==0||o!==0?(n<t&&i===0&&o===0&&(r+=e.substring(n)),r):e}function Pn(e,t){const r=t+" ",n=","+r;for(let i=0;i<e.length;i++){const o=e[i];if(o.type==="rule"){o.value=(r+o.value).replaceAll(",",n);const s=o.props,d=[];for(let u=0;u<s.length;u++)d[u]=r+s[u];o.props=d}Array.isArray(o.children)&&o.type!=="@keyframes"&&Pn(o.children,t)}return e}function Jo({options:e=Pe,plugins:t=Jt}=Pe){let r,n,i;const o=(y,x,b)=>b.startsWith(n)&&b.endsWith(n)&&b.replaceAll(n,"").length>0?`.${r}`:y,s=t.slice();s.push(y=>{y.type===dt&&y.value.includes("&")&&(i||(i=new RegExp(`\\${n}\\b`,"g")),y.props[0]=y.props[0].replace(Xo,n).replace(i,o))}),e.prefix&&s.push(vo),s.push(po);let d=[];const u=go(s.concat(mo(y=>d.push(y)))),g=(y,x="",b="",k="&")=>{r=k,n=x,i=void 0;const $=(function(w){const a=w.indexOf("//")!==-1,c=w.indexOf("}")!==-1;if(!a&&!c)return w;if(!a)return St(w);const l=w.length;let p="",h=0,_=0,A=0,R=0,P=0,O=!1;for(;_<l;){const F=w.charCodeAt(_);if(F!==34&&F!==39||Rn(w,_))if(A===0)if(F===Ce&&_+1<l&&w.charCodeAt(_+1)===42){for(_+=2;_+1<l&&(w.charCodeAt(_)!==42||w.charCodeAt(_+1)!==Ce);)_++;_+=2}else if(F!==40)if(F!==41)if(R>0)_++;else if(F===42&&_+1<l&&w.charCodeAt(_+1)===Ce)p+=w.substring(h,_),_+=2,h=_,O=!0;else if(F===Ce&&_+1<l&&w.charCodeAt(_+1)===Ce){for(p+=w.substring(h,_);_<l&&w.charCodeAt(_)!==10;)_++;h=_,O=!0}else F===123?P++:F===125&&P--,_++;else R>0&&R--,_++;else R++,_++;else _++;else A===0?A=F:A===F&&(A=0),_++}return O?(h<l&&(p+=w.substring(h)),P===0?p:St(p)):P===0?w:St(w)})(y);let S=fo(b||x?b+" "+x+" { "+$+" }":$);return e.namespace&&(S=Pn(S,e.namespace)),d=[],lt(S,u),d},m=e;let v=Tt;for(let y=0;y<t.length;y++)t[y].name||Ze(15),v=xe(v,t[y].name);return m!=null&&m.namespace&&(v=xe(v,m.namespace)),m!=null&&m.prefix&&(v=xe(v,"p")),g.hash=v!==Tt?v.toString():"",g}const es=new yt,Gt=Jo(),On=f.createContext({shouldForwardProp:void 0,styleSheet:es,stylis:Gt,stylisPlugins:void 0});On.Consumer;function ts(){return f.useContext(On)}const Dn=f.createContext(void 0);Dn.Consumer;const Pr=Object.prototype.hasOwnProperty,At={};function rs(e,t){const r=typeof e!="string"?"sc":yn(e);At[r]=(At[r]||0)+1;const n=r+"-"+wn(mt+r+At[r]);return t?t+"-"+n:n}function ns(e,t,r){const n=xn(e),i=e,o=!Nt(e),{attrs:s=Jt,componentId:d=rs(t.displayName,t.parentComponentId),displayName:u=Lo(e)}=t,g=t.displayName&&t.componentId?yn(t.displayName)+"-"+t.componentId:t.componentId||d,m=n&&i.attrs?i.attrs.concat(s).filter(Boolean):s;let{shouldForwardProp:v}=t;if(n&&i.shouldForwardProp){const k=i.shouldForwardProp;if(t.shouldForwardProp){const $=t.shouldForwardProp;v=(S,w)=>k(S,w)&&$(S,w)}else v=k}const y=new Qo(r,g,n?i.componentStyle:void 0);function x(k,$){return(function(S,w,a){const{attrs:c,componentStyle:l,defaultProps:p,foldedComponentIds:h,styledComponentId:_,target:A}=S,R=f.useContext(Dn),P=ts(),O=S.shouldForwardProp||P.shouldForwardProp,F=_o(w,R,p)||Pe;let D,X;{const te=f.useRef(null),M=te.current;if(M!==null&&M[1]===F&&M[2]===P.styleSheet&&M[3]===P.stylis&&M[7]===l&&(function(re,H,z){const V=re,U=H;let ae=0;for(const ne in U)if(Pr.call(U,ne)&&(ae++,V[ne]!==U[ne]))return!1;return ae===z})(M[0],w,M[4]))D=M[5],X=M[6];else{D=(function(H,z,V){const U=Object.assign(Object.assign({},z),{className:void 0,theme:V}),ae=H.length>1;for(let ne=0;ne<H.length;ne++){const de=H[ne],he=vt(de)?de(ae?Object.assign({},U):U):de;for(const J in he)J==="className"?U.className=Be(U.className,he[J]):J==="style"?U.style=Object.assign(Object.assign({},U.style),he[J]):J in z&&z[J]===void 0||(U[J]=he[J])}return"className"in z&&typeof z.className=="string"&&(U.className=Be(U.className,z.className)),U})(c,w,F),X=(function(H,z,V,U){return H.generateAndInjectStyles(z,V,U)})(l,D,P.styleSheet,P.stylis);let re=0;for(const H in w)Pr.call(w,H)&&re++;te.current=[w,F,P.styleSheet,P.stylis,re,D,X,l]}}const N=D.as||A,G=(function(te,M,re,H){const z={};for(const V in te)te[V]===void 0||V[0]==="$"||V==="as"||V==="theme"&&te.theme===re||(V==="forwardedAs"?z.as=te.forwardedAs:H&&!H(V,M)||(z[V]=te[V]));return z})(D,N,F,O);let Y=Be(h,_);return X&&(Y+=" "+X),D.className&&(Y+=" "+D.className),G[Nt(N)&&N.includes("-")?"class":"className"]=Y,a&&(G.ref=a),E.createElement(N,G)})(b,k,$)}x.displayName=u;let b=f.forwardRef(x);return b.attrs=m,b.componentStyle=y,b.displayName=u,b.shouldForwardProp=v,b.foldedComponentIds=n?Be(i.foldedComponentIds,i.styledComponentId):"",b.styledComponentId=g,b.target=n?i.target:e,Object.defineProperty(b,"defaultProps",{get(){return this._foldedDefaultProps},set(k){this._foldedDefaultProps=n?(function($,...S){for(const w of S)Mt($,w,!0);return $})({},i.defaultProps,k):k}}),tr(b,()=>`.${b.styledComponentId}`),o&&Cn(b,e,{attrs:!0,componentStyle:!0,displayName:!0,foldedComponentIds:!0,shouldForwardProp:!0,styledComponentId:!0,target:!0}),b}var is=new Set(["a","abbr","address","area","article","aside","audio","b","bdi","bdo","blockquote","body","button","br","canvas","caption","cite","code","col","colgroup","data","datalist","dd","del","details","dfn","dialog","div","dl","dt","em","embed","fieldset","figcaption","figure","footer","form","h1","h2","h3","h4","h5","h6","header","hgroup","hr","html","i","iframe","img","input","ins","kbd","label","legend","li","main","map","mark","menu","meter","nav","object","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","slot","small","span","strong","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","u","ul","var","video","wbr","circle","clipPath","defs","ellipse","feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence","filter","foreignObject","g","image","line","linearGradient","marker","mask","path","pattern","polygon","polyline","radialGradient","rect","stop","svg","switch","symbol","text","textPath","tspan","use"]);function Or(e,t){const r=[e[0]];for(let n=0,i=t.length;n<i;n+=1)r.push(t[n],e[n+1]);return r}const Dr=e=>(Ln.add(e),e);function bt(e,...t){if(vt(e)||Ve(e))return Dr($e(Or(Jt,[e,...t])));const r=e;return t.length===0&&r.length===1&&typeof r[0]=="string"?$e(r):Dr($e(Or(r,t)))}function Bt(e,t,r=Pe){if(!t)throw Ze(1,t);const n=(i,...o)=>e(t,r,bt(i,...o));return n.attrs=i=>Bt(e,t,Object.assign(Object.assign({},r),{attrs:Array.prototype.concat(r.attrs,i).filter(Boolean)})),n.withConfig=i=>Bt(e,t,Object.assign(Object.assign({},r),i)),n}const Tn=e=>Bt(ns,e),C=Tn;is.forEach(e=>{C[e]=Tn(e)});var Nn;class os{constructor(t,r){this[Nn]=!0,this.inject=(n,i=Gt)=>{const o=this.getName(i);if(!n.hasNameForId(this.id,o)){const s=i(this.rules,o,"@keyframes");n.insertRules(this.id,o,s)}},this.name=t,this.id=vn+t,this.rules=r,Ge(this.id),tr(this,()=>{throw Ze(12,String(this.name))})}getName(t=Gt){return t.hash?this.name+er(+t.hash>>>0):this.name}}function Ye(e,...t){const r=Ft(bt(e,...t)),n=wn(r);return new os(n,r)}Nn=kn;var Ht="#121212",Fn="#212121",ss="#3e3e3e",as="#4a4a4a",Mn="#a6a6a6",cs="#ececec",at="#ffffff",rr="#00ccff",jn="#00ff99",Gn="#9933ff",Bn="#ff6666",Hn="#fff35c",ls="#6157ff";function Tr(e,t,r,n){var i,o=!1,s=0;function d(){i&&clearTimeout(i)}function u(){d(),o=!0}typeof t!="boolean"&&(n=r,r=t,t=void 0);function g(){for(var m=arguments.length,v=new Array(m),y=0;y<m;y++)v[y]=arguments[y];var x=this,b=Date.now()-s;if(o)return;function k(){s=Date.now(),r.apply(x,v)}function $(){i=void 0}n&&!i&&k(),d(),n===void 0&&b>e?k():t!==!0&&(i=setTimeout(n?$:k,n===void 0?e-b:e))}return g.cancel=u,g}function nr(e,t,r){return r===void 0?Tr(e,t,!1):Tr(e,r,t!==!1)}var Nr={},Fr;function us(){return Fr||(Fr=1,(function(){if(typeof window!="object")return;if("IntersectionObserver"in window&&"IntersectionObserverEntry"in window&&"intersectionRatio"in window.IntersectionObserverEntry.prototype){"isIntersecting"in window.IntersectionObserverEntry.prototype||Object.defineProperty(window.IntersectionObserverEntry.prototype,"isIntersecting",{get:function(){return this.intersectionRatio>0}});return}function e(a){try{return a.defaultView&&a.defaultView.frameElement||null}catch{return null}}var t=(function(a){for(var c=a,l=e(c);l;)c=l.ownerDocument,l=e(c);return c})(window.document),r=[],n=null,i=null;function o(a){this.time=a.time,this.target=a.target,this.rootBounds=b(a.rootBounds),this.boundingClientRect=b(a.boundingClientRect),this.intersectionRect=b(a.intersectionRect||x()),this.isIntersecting=!!a.intersectionRect;var c=this.boundingClientRect,l=c.width*c.height,p=this.intersectionRect,h=p.width*p.height;l?this.intersectionRatio=Number((h/l).toFixed(4)):this.intersectionRatio=this.isIntersecting?1:0}function s(a,c){var l=c||{};if(typeof a!="function")throw new Error("callback must be a function");if(l.root&&l.root.nodeType!=1&&l.root.nodeType!=9)throw new Error("root must be a Document or Element");this._checkForIntersections=u(this._checkForIntersections.bind(this),this.THROTTLE_TIMEOUT),this._callback=a,this._observationTargets=[],this._queuedEntries=[],this._rootMarginValues=this._parseRootMargin(l.rootMargin),this.thresholds=this._initThresholds(l.threshold),this.root=l.root||null,this.rootMargin=this._rootMarginValues.map(function(p){return p.value+p.unit}).join(" "),this._monitoringDocuments=[],this._monitoringUnsubscribes=[]}s.prototype.THROTTLE_TIMEOUT=100,s.prototype.POLL_INTERVAL=null,s.prototype.USE_MUTATION_OBSERVER=!0,s._setupCrossOriginUpdater=function(){return n||(n=function(a,c){!a||!c?i=x():i=k(a,c),r.forEach(function(l){l._checkForIntersections()})}),n},s._resetCrossOriginUpdater=function(){n=null,i=null},s.prototype.observe=function(a){var c=this._observationTargets.some(function(l){return l.element==a});if(!c){if(!(a&&a.nodeType==1))throw new Error("target must be an Element");this._registerInstance(),this._observationTargets.push({element:a,entry:null}),this._monitorIntersections(a.ownerDocument),this._checkForIntersections()}},s.prototype.unobserve=function(a){this._observationTargets=this._observationTargets.filter(function(c){return c.element!=a}),this._unmonitorIntersections(a.ownerDocument),this._observationTargets.length==0&&this._unregisterInstance()},s.prototype.disconnect=function(){this._observationTargets=[],this._unmonitorAllIntersections(),this._unregisterInstance()},s.prototype.takeRecords=function(){var a=this._queuedEntries.slice();return this._queuedEntries=[],a},s.prototype._initThresholds=function(a){var c=a||[0];return Array.isArray(c)||(c=[c]),c.sort().filter(function(l,p,h){if(typeof l!="number"||isNaN(l)||l<0||l>1)throw new Error("threshold must be a number between 0 and 1 inclusively");return l!==h[p-1]})},s.prototype._parseRootMargin=function(a){var c=a||"0px",l=c.split(/\s+/).map(function(p){var h=/^(-?\d*\.?\d+)(px|%)$/.exec(p);if(!h)throw new Error("rootMargin must be specified in pixels or percent");return{value:parseFloat(h[1]),unit:h[2]}});return l[1]=l[1]||l[0],l[2]=l[2]||l[0],l[3]=l[3]||l[1],l},s.prototype._monitorIntersections=function(a){var c=a.defaultView;if(c&&this._monitoringDocuments.indexOf(a)==-1){var l=this._checkForIntersections,p=null,h=null;this.POLL_INTERVAL?p=c.setInterval(l,this.POLL_INTERVAL):(g(c,"resize",l,!0),g(a,"scroll",l,!0),this.USE_MUTATION_OBSERVER&&"MutationObserver"in c&&(h=new c.MutationObserver(l),h.observe(a,{attributes:!0,childList:!0,characterData:!0,subtree:!0}))),this._monitoringDocuments.push(a),this._monitoringUnsubscribes.push(function(){var R=a.defaultView;R&&(p&&R.clearInterval(p),m(R,"resize",l,!0)),m(a,"scroll",l,!0),h&&h.disconnect()});var _=this.root&&(this.root.ownerDocument||this.root)||t;if(a!=_){var A=e(a);A&&this._monitorIntersections(A.ownerDocument)}}},s.prototype._unmonitorIntersections=function(a){var c=this._monitoringDocuments.indexOf(a);if(c!=-1){var l=this.root&&(this.root.ownerDocument||this.root)||t,p=this._observationTargets.some(function(A){var R=A.element.ownerDocument;if(R==a)return!0;for(;R&&R!=l;){var P=e(R);if(R=P&&P.ownerDocument,R==a)return!0}return!1});if(!p){var h=this._monitoringUnsubscribes[c];if(this._monitoringDocuments.splice(c,1),this._monitoringUnsubscribes.splice(c,1),h(),a!=l){var _=e(a);_&&this._unmonitorIntersections(_.ownerDocument)}}}},s.prototype._unmonitorAllIntersections=function(){var a=this._monitoringUnsubscribes.slice(0);this._monitoringDocuments.length=0,this._monitoringUnsubscribes.length=0;for(var c=0;c<a.length;c++)a[c]()},s.prototype._checkForIntersections=function(){if(!(!this.root&&n&&!i)){var a=this._rootIsInDom(),c=a?this._getRootRect():x();this._observationTargets.forEach(function(l){var p=l.element,h=y(p),_=this._rootContainsTarget(p),A=l.entry,R=a&&_&&this._computeTargetAndRootIntersection(p,h,c),P=null;this._rootContainsTarget(p)?(!n||this.root)&&(P=c):P=x();var O=l.entry=new o({time:d(),target:p,boundingClientRect:h,rootBounds:P,intersectionRect:R});A?a&&_?this._hasCrossedThreshold(A,O)&&this._queuedEntries.push(O):A&&A.isIntersecting&&this._queuedEntries.push(O):this._queuedEntries.push(O)},this),this._queuedEntries.length&&this._callback(this.takeRecords(),this)}},s.prototype._computeTargetAndRootIntersection=function(a,c,l){if(window.getComputedStyle(a).display!="none"){for(var p=c,h=S(a),_=!1;!_&&h;){var A=null,R=h.nodeType==1?window.getComputedStyle(h):{};if(R.display=="none")return null;if(h==this.root||h.nodeType==9)if(_=!0,h==this.root||h==t)n&&!this.root?!i||i.width==0&&i.height==0?(h=null,A=null,p=null):A=i:A=l;else{var P=S(h),O=P&&y(P),F=P&&this._computeTargetAndRootIntersection(P,O,l);O&&F?(h=P,A=k(O,F)):(h=null,p=null)}else{var D=h.ownerDocument;h!=D.body&&h!=D.documentElement&&R.overflow!="visible"&&(A=y(h))}if(A&&(p=v(A,p)),!p)break;h=h&&S(h)}return p}},s.prototype._getRootRect=function(){var a;if(this.root&&!w(this.root))a=y(this.root);else{var c=w(this.root)?this.root:t,l=c.documentElement,p=c.body;a={top:0,left:0,right:l.clientWidth||p.clientWidth,width:l.clientWidth||p.clientWidth,bottom:l.clientHeight||p.clientHeight,height:l.clientHeight||p.clientHeight}}return this._expandRectByRootMargin(a)},s.prototype._expandRectByRootMargin=function(a){var c=this._rootMarginValues.map(function(p,h){return p.unit=="px"?p.value:p.value*(h%2?a.width:a.height)/100}),l={top:a.top-c[0],right:a.right+c[1],bottom:a.bottom+c[2],left:a.left-c[3]};return l.width=l.right-l.left,l.height=l.bottom-l.top,l},s.prototype._hasCrossedThreshold=function(a,c){var l=a&&a.isIntersecting?a.intersectionRatio||0:-1,p=c.isIntersecting?c.intersectionRatio||0:-1;if(l!==p)for(var h=0;h<this.thresholds.length;h++){var _=this.thresholds[h];if(_==l||_==p||_<l!=_<p)return!0}},s.prototype._rootIsInDom=function(){return!this.root||$(t,this.root)},s.prototype._rootContainsTarget=function(a){var c=this.root&&(this.root.ownerDocument||this.root)||t;return $(c,a)&&(!this.root||c==a.ownerDocument)},s.prototype._registerInstance=function(){r.indexOf(this)<0&&r.push(this)},s.prototype._unregisterInstance=function(){var a=r.indexOf(this);a!=-1&&r.splice(a,1)};function d(){return window.performance&&performance.now&&performance.now()}function u(a,c){var l=null;return function(){l||(l=setTimeout(function(){a(),l=null},c))}}function g(a,c,l,p){typeof a.addEventListener=="function"?a.addEventListener(c,l,p):typeof a.attachEvent=="function"&&a.attachEvent("on"+c,l)}function m(a,c,l,p){typeof a.removeEventListener=="function"?a.removeEventListener(c,l,p):typeof a.detachEvent=="function"&&a.detachEvent("on"+c,l)}function v(a,c){var l=Math.max(a.top,c.top),p=Math.min(a.bottom,c.bottom),h=Math.max(a.left,c.left),_=Math.min(a.right,c.right),A=_-h,R=p-l;return A>=0&&R>=0&&{top:l,bottom:p,left:h,right:_,width:A,height:R}||null}function y(a){var c;try{c=a.getBoundingClientRect()}catch{}return c?(c.width&&c.height||(c={top:c.top,right:c.right,bottom:c.bottom,left:c.left,width:c.right-c.left,height:c.bottom-c.top}),c):x()}function x(){return{top:0,bottom:0,left:0,right:0,width:0,height:0}}function b(a){return!a||"x"in a?a:{top:a.top,y:a.top,bottom:a.bottom,left:a.left,x:a.left,right:a.right,width:a.width,height:a.height}}function k(a,c){var l=c.top-a.top,p=c.left-a.left;return{top:l,left:p,height:c.height,width:c.width,bottom:l+c.height,right:p+c.width}}function $(a,c){for(var l=c;l;){if(l==a)return!0;l=S(l)}return!1}function S(a){var c=a.parentNode;return a.nodeType==9&&a!=t?e(a):(c&&c.assignedSlot&&(c=c.assignedSlot.parentNode),c&&c.nodeType==11&&c.host?c.host:c)}function w(a){return a&&a.nodeType===9}window.IntersectionObserver=s,window.IntersectionObserverEntry=o})()),Nr}us();var fs=Object.defineProperty,Mr=Object.getOwnPropertySymbols,ds=Object.prototype.hasOwnProperty,hs=Object.prototype.propertyIsEnumerable,jr=(e,t,r)=>t in e?fs(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,Ne=(e,t)=>{for(var r in t||(t={}))ds.call(t,r)&&jr(e,r,t[r]);if(Mr)for(var r of Mr(t))hs.call(t,r)&&jr(e,r,t[r]);return e},ps=(e,t,r)=>{const n=Rt(e,[r]),i=Rt(t,[r]);return n[r]&&i[r]?Ne(Ne(Ne({},e),t),{[r]:n[r]+", "+i[r]}):Ne(Ne({},e),t)},gs=ps,ir=(typeof window<"u"?window:global)||{},Gr,ms=((Gr=ir)==null?void 0:Gr.GIPHY_PINGBACK_URL)||"https://pingback.giphy.com",vs=`${ms}/v2/pingback?apikey=l0HlIwPWyBBUDAUgM`,ys=e=>{const t=Yt();return t==null||t.set("Content-Type","application/json"),Q.debug("Pingback session",e),e.length?fetch(vs,{method:"POST",body:JSON.stringify({events:e}),headers:t}).catch(r=>{Q.warn(`pingbacks failing to post ${r}`)}):new Promise(r=>r())},Ut=[];ir.giphyRandomId=Zt();var Xe="";function or(){const e=[...Ut];Ut=[],ys(e)}var bs=nr(1e3,or),Br,Hr;(Hr=(Br=ir).addEventListener)==null||Hr.call(Br,"beforeunload",or);var ws=({userId:e,eventType:t,actionType:r,attributes:n,queueEvents:i=!0,analyticsResponsePayload:o})=>{Xe=e?String(e):Xe;const s={ts:Date.now(),attributes:n,action_type:r,user_id:Zt(),analytics_response_payload:o};Xe&&(s.logged_in_user_id=Xe),s.analytics_response_payload&&(s.analytics_response_payload=`${s.analytics_response_payload}${Q.ENABLED?"&mode=verification":""}`),t&&(s.event_type=t),Ut.push(s),i?bs():or()},sr=ws;const _s=ii(oi);var Je={},Ur;function Es(){if(Ur)return Je;Ur=1,Object.defineProperty(Je,"__esModule",{value:!0});var e=qt();function t(r,n){n===void 0&&(n=0);var i=e.useRef(!1),o=e.useRef(),s=e.useRef(r),d=e.useCallback(function(){return i.current},[]),u=e.useCallback(function(){i.current=!1,o.current&&clearTimeout(o.current),o.current=setTimeout(function(){i.current=!0,s.current()},n)},[n]),g=e.useCallback(function(){i.current=null,o.current&&clearTimeout(o.current)},[]);return e.useEffect(function(){s.current=r},[r]),e.useEffect(function(){return u(),g},[n]),[d,g,u]}return Je.default=t,Je}var Cs=Es();const xs=Jr(Cs);var et={},tt={},oe={},zr;function $s(){if(zr)return oe;zr=1,Object.defineProperty(oe,"__esModule",{value:!0}),oe.isNavigator=oe.isBrowser=oe.off=oe.on=oe.noop=void 0;var e=function(){};oe.noop=e;function t(n){for(var i=[],o=1;o<arguments.length;o++)i[o-1]=arguments[o];n&&n.addEventListener&&n.addEventListener.apply(n,i)}oe.on=t;function r(n){for(var i=[],o=1;o<arguments.length;o++)i[o-1]=arguments[o];n&&n.removeEventListener&&n.removeEventListener.apply(n,i)}return oe.off=r,oe.isBrowser=typeof window<"u",oe.isNavigator=typeof navigator<"u",oe}var Vr;function Ls(){if(Vr)return tt;Vr=1,Object.defineProperty(tt,"__esModule",{value:!0});var e=qt(),t=$s(),r=t.isBrowser?e.useLayoutEffect:e.useEffect;return tt.default=r,tt}var qr;function ks(){if(qr)return et;qr=1,Object.defineProperty(et,"__esModule",{value:!0});var e=_s,t=qt(),r=e.__importDefault(Ls()),n=function(i,o){i===void 0&&(i=1e12),o===void 0&&(o=0);var s=t.useState(0),d=s[0],u=s[1];return r.default(function(){var g,m,v,y=function(){var $=Math.min(1,(Date.now()-v)/i);u($),x()},x=function(){g=requestAnimationFrame(y)},b=function(){m=setTimeout(function(){cancelAnimationFrame(g),u(1)},i),v=Date.now(),x()},k=setTimeout(b,o);return function(){clearTimeout(m),clearTimeout(k),cancelAnimationFrame(g)}},[i,o]),d};return et.default=n,et}var Ss=ks();const As=Jr(Ss);var Is=Object.defineProperty,Rs=Object.defineProperties,Ps=Object.getOwnPropertyDescriptors,Wr=Object.getOwnPropertySymbols,Os=Object.prototype.hasOwnProperty,Ds=Object.prototype.propertyIsEnumerable,Zr=(e,t,r)=>t in e?Is(e,t,{enumerable:!0,configurable:!0,writable:!0,value:r}):e[t]=r,me=(e,t)=>{for(var r in t||(t={}))Os.call(t,r)&&Zr(e,r,t[r]);if(Wr)for(var r of Wr(t))Ds.call(t,r)&&Zr(e,r,t[r]);return e},ar=(e,t)=>Rs(e,Ps(t)),cr=(e,t,r)=>new Promise((n,i)=>{var o=u=>{try{d(r.next(u))}catch(g){i(g)}},s=u=>{try{d(r.throw(u))}catch(g){i(g)}},d=u=>u.done?n(u.value):Promise.resolve(u.value).then(o,s);d((r=r.apply(e,t)).next())}),Ts=e=>{var t,r;if(!e)return"";const n=(r=(t=e==null?void 0:e.split("."))==null?void 0:t.pop())==null?void 0:r.toLowerCase();return e.replace(`.${n}`,`/80h.${n}`)},Ns=C.img`
    object-fit: cover;
    width: 32px;
    height: 32px;
    margin-right: 8px;
`,Fs=({user:e,className:t=""})=>{const r=E.useRef(Math.floor(Math.random()*5)+1),n=e.avatar_url?Ts(e.avatar_url):`https://media.giphy.com/avatars/default${r.current}.gif`;return f.createElement(Ns,{src:n,className:t})},wt=Fs,qe=({className:e="",size:t=17,fill:r="#15CDFF"})=>f.createElement("svg",{className:[qe.className,e].join(" "),height:t,width:"19px",viewBox:"0 0 19 17"},f.createElement("path",{className:qe.checkMarkClassName,d:"M9.32727273,9.44126709 L9.32727273,3.03016561 L6.55027155,3.03016561 L6.55027155,10.8150746 L6.55027155,12.188882 L12.1042739,12.188882 L12.1042739,9.44126709 L9.32727273,9.44126709 Z",fill:Ht,transform:"translate(9.327273, 7.609524) scale(-1, 1) rotate(-45.000000) translate(-9.327273, -7.609524) "}),f.createElement("g",{transform:"translate(-532.000000, -466.000000)",fill:r},f.createElement("g",{transform:"translate(141.000000, 235.000000)"},f.createElement("g",{transform:"translate(264.000000, 0.000000)"},f.createElement("g",{transform:"translate(10.000000, 224.000000)"},f.createElement("g",{transform:"translate(114.000000, 2.500000)"},f.createElement("path",{d:"M15.112432,4.80769231 L16.8814194,6.87556817 L19.4157673,7.90116318 L19.6184416,10.6028916 L21.0594951,12.9065042 L19.6184416,15.2101168 L19.4157673,17.9118452 L16.8814194,18.9374402 L15.112432,21.0053161 L12.4528245,20.3611511 L9.79321699,21.0053161 L8.02422954,18.9374402 L5.48988167,17.9118452 L5.28720734,15.2101168 L3.84615385,12.9065042 L5.28720734,10.6028916 L5.48988167,7.90116318 L8.02422954,6.87556817 L9.79321699,4.80769231 L12.4528245,5.4518573 L15.112432,4.80769231 Z M17.8163503,10.8991009 L15.9282384,9.01098901 L11.5681538,13.3696923 L9.68115218,11.4818515 L7.81302031,13.3499833 L9.7011322,15.2380952 L11.5892441,17.1262071 L17.8163503,10.8991009 Z"})))))));qe.className="giphy-verified-badge";qe.checkMarkClassName="giphy-verified-checkmark";var zt=qe,Ms=C.div`
    color: white;
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    -webkit-font-smoothing: antialiased;
`,js=C(zt)`
    margin-left: 4px;
    flex-shrink: 0;
`,Gs=C.div`
    display: flex;
    align-items: center;
    min-width: 0;
`,Bs=({user:e})=>{const{display_name:t,username:r}=e;return f.createElement(Gs,null,f.createElement(Ms,null,t||`@${r}`),e.is_verified?f.createElement(js,{size:14}):null)},Un=Bs,Hs=C.div`
    display: flex;
    align-items: center;
    font-family: interface, helvetica, arial;
`,Us=C(wt)`
    flex-shrink: 0;
`,lr=({gif:e,className:t,onClick:r})=>{const{user:n}=e;return!(n!=null&&n.username)&&!(n!=null&&n.display_name)?null:f.createElement(Hs,{className:[lr.className,t].join(" "),onClick:i=>{if(i.preventDefault(),i.stopPropagation(),r)r(e);else{const o=n.profile_url;o&&window.open(o,"_blank")}}},f.createElement(Us,{user:n}),f.createElement(Un,{user:e.user}))};lr.className="giphy-attribution";var zs=lr,Vs=C.div`
    background: linear-gradient(rgba(0, 0, 0, 0), rgba(18, 18, 18, 0.6));
    cursor: default;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 75px;
    pointer-events: none;
`,qs=C(zs)`
    position: absolute;
    bottom: 10px;
    left: 10px;
    right: 10px;
`,Ws=C.div`
    transition: opacity 150ms ease-in;
`,Zs=({gif:e,isHovered:t,onClick:r})=>{const n=E.useRef(t);return t&&(n.current=!0),e.user&&n.current?f.createElement(Ws,{style:{opacity:t?1:0}},f.createElement(Vs,null),f.createElement(qs,{gif:e,onClick:r})):null},Ys=Zs,Ks=({children:e,className:t,onVisibleChange:r,config:n})=>{const i=E.useRef(null);return E.useEffect(()=>{let o;return i.current&&(o=new IntersectionObserver(([s])=>{r&&r(s.isIntersecting)},n),o.observe(i.current)),()=>o==null?void 0:o.disconnect()},[r,i,n]),f.createElement("div",{ref:i,className:t},e)},zn=Ks,Vn=e=>(t,r,n,i={})=>{t.analytics_response_payload&&sr({analyticsResponsePayload:t.analytics_response_payload,userId:r,actionType:e,attributes:me({position:JSON.stringify(Ci(n))},i)})},Qs=(e,t,r,n={})=>{e.analytics_response_payload&&sr({analyticsResponsePayload:e.analytics_response_payload,userId:t,actionType:"SEEN",attributes:me({position:JSON.stringify(r)},n)})},Xs=Vn("CLICK"),Js=Vn("HOVER");function ea(e){return e=e.replace("%%CACHEBUSTER%%",rn()),e=e.replace("%%TIMESTAMP%%",`${Date.now()}`),e=e.replace("%%APPBUNDLE%%","web"),typeof window<"u"&&(e=e.replace("%%APP_WINDOW_SIZE%%",`${window.innerWidth},${window.innerHeight}`),e=e.replace("%%DEVICE_LANGUAGE%%",`${navigator.language}`)),e}function ta({src:e}){const t=E.useRef(ea(e)),[r,n]=E.useState(!1);return E.useEffect(()=>{n(!0)},[]),r?f.createElement("img",{src:t.current,width:0,height:0}):null}var ra=ta,Vt=E.createContext({}),na=({attributes:e,children:t})=>{const{attributes:r={}}=E.useContext(Vt);return f.createElement(Vt.Provider,{value:{attributes:gs(r,e,"layout_type")}},t)},qn=na,ia=C.div`
    position: relative;
    display: block;
    picture {
        display: block;
        width: 100%;
        height: 100%;
    }
    img {
        display: block;
    }
    .${zt.className} {
        g {
            fill: white;
        }
    }
    .${zt.checkMarkClassName} {
        opacity: 0;
    }
`,Yr=[rr,jn,Gn,Bn,Hn],oa=()=>Yr[Math.round(Math.random()*(Yr.length-1))],sa=200,Kr="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",aa=!!(typeof window<"u"&&window.document&&window.document.createElement),Se=()=>{},ca=({children:e})=>{const[t,r]=E.useState(!1);return E.useEffect(()=>{r(!0)},[]),t?f.createElement(f.Fragment,null,e):null},we=({gif:e,gif:{bottle_data:t={}},width:r,percentWidth:n,percentHeight:i,height:o,onGifRightClick:s=Se,className:d="",onGifClick:u=Se,onGifKeyPress:g=Se,onGifSeen:m=Se,onGifVisible:v=Se,user:y={},backgroundColor:x,overlay:b,hideAttribution:k=!1,noLink:$=!1,borderRadius:S=4,style:w,tabIndex:a,lazyLoad:c=!0})=>{var l;const p=E.useRef(!1),[h,_]=E.useState(!1),[A,R]=E.useState(!aa||!c),[P,O]=E.useState(""),F=E.useRef(oa()),D=E.useRef(null),X=E.useRef(null),N=E.useRef(),G=E.useRef(),Y=E.useRef(),te=E.useRef(Se),M=Object.keys(t).length>0,{attributes:re}=E.useContext(Vt);let H=b;!H&&!k&&(H=Ys);const z=B=>{clearTimeout(Y.current),B.persist(),_(!0),Y.current=window.setTimeout(()=>{Js(e,y==null?void 0:y.id,B.target,re)},sa)},V=()=>{clearTimeout(Y.current),_(!1)},U=B=>{Xs(e,y==null?void 0:y.id,B.target,re),u(e,B)},ae=B=>{g(e,B)};te.current=B=>{p.current=!0,Q.debug(`GIF ${e.id} seen. ${e.title}`),Qs(e,y==null?void 0:y.id,B.boundingClientRect,re),m==null||m(e,B.boundingClientRect),G.current&&G.current.disconnect()};const ne=()=>{G.current||(G.current=new IntersectionObserver(([B])=>{B.isIntersecting&&te.current(B)},{threshold:[.99]})),!p.current&&D.current&&G.current&&G.current.observe(D.current)},de=B=>{ne(),v(e,B),O(we.imgLoadedClassName)};E.useEffect(()=>{var B,_e;(B=G.current)==null||B.disconnect(),p.current=!1,(_e=X.current)!=null&&_e.complete&&(ne(),v(e))},[e.id]),E.useEffect(()=>(N.current=new IntersectionObserver(([B])=>{const{isIntersecting:_e}=B;R(_e),!_e&&G.current&&G.current.disconnect()}),N.current.observe(D.current),()=>{N.current&&N.current.disconnect(),G.current&&G.current.disconnect(),Y.current&&clearTimeout(Y.current)}),[]);const he=ft(e,r);let J=o;!(w!=null&&w.aspectRatio)&&!o&&(J=he);const L=$i(e.images,r,o||he);if(!L)return e.images?console.error(`no rendition for ${e.id}, rendition names: ${Object.keys(e.images).join(", ")}`):console.error(`no rendition for ${e.id} - no images`),null;const ee=e.images[L.renditionName],_t=P===we.imgLoadedClassName&&!e.is_sticker?"unset":x||(e.is_sticker?"url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADgAAAA4AQMAAACSSKldAAAABlBMVEUhIiIWFhYoSqvJAAAAGElEQVQY02MAAv7///8PWxqIPwDZw5UGABtgwz2xhFKxAAAAAElFTkSuQmCC') 0 0":F.current),ni=S?"hidden":"unset";return f.createElement(ia,{as:$?"div":"a",href:$?void 0:e.url,"data-giphy-id":e.id,"data-giphy-is-sticker":e.is_sticker,style:me({width:n||r,height:i||J,overflow:ni,borderRadius:S},w),className:[we.className,d].join(" "),onMouseOver:z,onMouseLeave:V,onClick:U,onContextMenu:B=>s(e,B),onKeyPress:ae,tabIndex:a,ref:D},f.createElement("picture",null,f.createElement("source",{type:"image/webp",srcSet:A?ee.webp:Kr,suppressHydrationWarning:!0}),f.createElement("img",{ref:X,suppressHydrationWarning:!0,className:[we.imgClassName,P].join(" "),src:A?ee.url:Kr,style:{background:_t},width:"100%",height:"100%",alt:ki(e),onLoad:A?de:()=>{}})),M&&((l=t==null?void 0:t.tags)==null?void 0:l.map((B,_e)=>f.createElement(ra,{src:B,key:_e}))),H&&f.createElement(ca,null,A&&f.createElement(H,{gif:e,isHovered:h,width:r,height:J})))};we.className="giphy-gif";we.imgClassName="giphy-gif-img";we.imgLoadedClassName="giphy-img-loaded";var We=we,la=C.div`
    -webkit-overflow-scrolling: touch;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    position: relative;
`,ua=C(We)`
    position: relative;
    display: inline-block;
    list-style: none;
    margin-left: ${e=>e.$ml}px;
    /* make sure gifs are fully visible with a scrollbar */
    margin-bottom: 1px;

    &:first-of-type {
        margin-left: 0;
    }
    .${We.imgClassName} {
        position: absolute;
        top: 0;
        left: 0;
    }
`,fa=C(zn)`
    display: inline-block;
`,da=C.div`
    width: 30px;
    display: inline-block;
    opacity: ${e=>e.$isFirstLoad?0:1};
    height: ${e=>e.$height}px;
`,ha=Object.freeze({gutter:6,user:{},initialGifs:[]}),pa=Object.freeze({isFetching:!1,gifs:[],isLoaderVisible:!1,isDoneFetching:!1}),Wn=class Zn extends E.PureComponent{constructor(){super(...arguments),this.state=ar(me({},pa),{gifs:this.props.initialGifs||[]}),this.unmounted=!1,this.paginator=an(this.props.fetchGifs,this.state.gifs),this.onLoaderVisible=t=>{this.unmounted||this.setState({isLoaderVisible:t},this.onFetch)},this.onFetch=nr(100,()=>cr(this,null,function*(){if(this.unmounted)return;const{isFetching:t,isLoaderVisible:r,gifs:n}=this.state;if(!t&&r){this.setState({isFetching:!0});let i;try{i=yield this.paginator()}catch{this.setState({isFetching:!1})}if(i)if(!!!(i!=null&&i.skipCountCheck)&&n.length===i.length)this.setState({isDoneFetching:!0});else{this.setState({gifs:i,isFetching:!1});const{onGifsFetched:s}=this.props;s&&s(i),this.onFetch()}}}))}componentDidMount(){this.unmounted=!1,this.onFetch()}componentWillUnmount(){this.unmounted=!0}render(){const{onGifVisible:t,onGifRightClick:r,gifHeight:n,gifWidth:i,gutter:o,className:s=Zn.className,onGifSeen:d,onGifClick:u,onGifKeyPress:g,user:m,overlay:v,hideAttribution:y,noLink:x,noResultsMessage:b,backgroundColor:k,borderRadius:$,tabIndex:S=0,loaderConfig:w}=this.props,{gifs:a,isDoneFetching:c}=this.state,l=!c,p=a.length===0;return f.createElement(qn,{attributes:{layout_type:"CAROUSEL"}},f.createElement(la,{className:s},a.map(h=>f.createElement(ua,{gif:h,key:h.id,tabIndex:S,width:i||Li(h,n),height:n,onGifClick:u,onGifKeyPress:g,onGifSeen:d,onGifVisible:t,onGifRightClick:r,user:m,$ml:o,overlay:v,hideAttribution:y,noLink:x,borderRadius:$,backgroundColor:k})),!l&&a.length===0&&b,l&&f.createElement(fa,{onVisibleChange:this.onLoaderVisible,config:w},f.createElement(da,{$isFirstLoad:p,$height:n}))))}};Wn.className="giphy-carousel";Wn.defaultProps=ha;var ga=C.div`
    color: ${Mn};
    display: flex;
    justify-content: center;
    margin: 30px 0;
    font-family: interface, Helvetica Neue, helvetica, sans-serif;
    font-size: 16px;
    font-weight: 600;
    a {
        color: ${rr};
        cursor: pointer;
        &:hover {
            color: white;
        }
    }
`,ma=({onClick:e})=>f.createElement(ga,null,"Error loading GIFs. ",f.createElement("a",{onClick:e},"Try again?")),va=ma,ya=.75;C.div`
    align-items: center;
    background-color: ${({$backgroundColor:e})=>e};
    border-radius: 16px;
    display: flex;
    max-width: fit-content;
    overflow: hidden;
    padding: 4px 5px 5px 6px;
`;C.div`
    overflow-x: auto;
    overflow-y: hidden;
    position: relative;
    -webkit-overflow-scrolling: touch;
`;C.div`
    display: inline-flex;
    justify-content: space-between;
    overflow: hidden;
    white-space: nowrap;
    width: ${({$width:e})=>`${e}px`};
`;C.div`
    background-color: ${({$color:e})=>e};
    box-sizing: border-box;
    height: ${({$gifHeight:e})=>`${Math.round(e*ya)}px`};
    margin: ${({$gutter:e})=>`0 ${e}px`};
    width: 2px;
`;C(We)`
    display: inline-block;
    flex-shrink: 0;
    list-style: none;
    /* make sure gifs are fully visible with a scrollbar */
    margin-bottom: 1px;
    position: relative;

    .${We.imgClassName} {
        position: absolute;
        top: 0;
        left: 0;
    }
`;var ba=Ye`
     to {
    transform: scale(1.75) translateY(-20px);
  }
`,Yn=52,wa=C.div`
    display: flex;
    align-items: center;
    height: ${Yn}px;
    margin: 0 auto;
    text-align: center;
    justify-content: center;
    animation: pulse 0.8s ease-in-out 0s infinite alternate backwards;
`,Fe=C.div`
    display: inline-block;
    height: 10px;
    width: 10px;
    margin: ${Yn}px 10px 10px 10px;
    position: relative;
    box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.3);
    animation: ${ba} cubic-bezier(0.455, 0.03, 0.515, 0.955) 0.75s infinite alternate;
    background: ${e=>e.$color};
    animation-delay: ${e=>e.$delay};
`,_a=({className:e=""})=>f.createElement(wa,{className:e},f.createElement(Fe,{$color:jn,$delay:"0"}),f.createElement(Fe,{$color:rr,$delay:".1s"}),f.createElement(Fe,{$color:Gn,$delay:".2s"}),f.createElement(Fe,{$color:Bn,$delay:".3s"}),f.createElement(Fe,{$color:Hn,$delay:".4s"})),Ea=_a,Ca=C.div`
    opacity: ${e=>e.$isFirstLoad?0:1};
`;function Qr(e,t,r=[]){return Array.apply(null,Array(e)).map((n,i)=>r[i]||t)}function xa(e,t,r,n){const i=Qr(e,[]),o=Qr(e,0,t);return r.forEach(s=>{const d=o.indexOf(Math.min(...o));i[d]=[...i[d],s],o[d]+=ft(s,n)}),i}var $a=Object.freeze({gutter:6,user:{},initialGifs:[]}),La=Object.freeze({isFetching:!1,isError:!1,gifs:[],isLoaderVisible:!1,isDoneFetching:!1}),De=class ct extends E.PureComponent{constructor(){super(...arguments),this.state=ar(me({},La),{gifs:this.props.initialGifs||[]}),this.unmounted=!1,this.paginator=an(this.props.fetchGifs,this.state.gifs),this.onLoaderVisible=t=>{this.unmounted||this.setState({isLoaderVisible:t},this.onFetch)},this.onFetch=nr(ct.fetchDebounce,()=>cr(this,null,function*(){if(this.unmounted)return;const{isFetching:t,isLoaderVisible:r}=this.state,{externalGifs:n}=this.props,i=(n||this.state.gifs).length;if(!t&&r){this.setState({isFetching:!0,isError:!1});let o;try{if(o=yield this.paginator(n),this.unmounted)return}catch(s){if(this.unmounted)return;this.setState({isFetching:!1,isError:!0});const{onGifsFetchError:d}=this.props;d&&d(s)}if(o)if(!!!(o!=null&&o.skipCountCheck)&&i===o.length)this.setState({isDoneFetching:!0});else{this.setState({gifs:o,isFetching:!1});const{onGifsFetched:d}=this.props;d&&d(o),this.onFetch()}}}))}componentDidMount(){this.unmounted=!1,this.onFetch()}componentWillUnmount(){this.unmounted=!0}render(){const{onGifVisible:t,onGifRightClick:r,className:n=ct.className,onGifSeen:i,onGifClick:o,onGifKeyPress:s,user:d,overlay:u,hideAttribution:g,noLink:m,borderRadius:v,noResultsMessage:y,columns:x,width:b,gutter:k,percentWidth:$,columnOffsets:S,backgroundColor:w,loaderConfig:a,tabIndex:c=0,layoutType:l="GRID",loader:p=Ea,eagerIds:h}=this.props,{gifs:_,isError:A,isDoneFetching:R}=this.state,P=!R,O=_.length===0,F=k*(x-1),D=(b-F)/x,X=xa(x,S,_,D);return f.createElement(qn,{attributes:{layout_type:l}},f.createElement("div",{className:n},f.createElement("div",{style:{width:$||b,display:"flex",gap:k}},X.map((N=[],G)=>f.createElement("div",{key:G,style:{display:"flex",flexDirection:"column",gap:k,width:$?"100%":D,marginTop:S==null?void 0:S[G]}},N.map(Y=>f.createElement(We,{style:{aspectRatio:Y.images.original.width/Y.images.original.height},gif:Y,tabIndex:c,key:Y.id,width:D,percentWidth:$?"100%":void 0,onGifClick:o,onGifKeyPress:s,onGifSeen:i,onGifVisible:t,onGifRightClick:r,user:d,overlay:u,backgroundColor:w,hideAttribution:g,noLink:m,borderRadius:v,lazyLoad:!(h!=null&&h.includes(Y.id))}))))),!P&&_.length===0&&y,A?f.createElement(va,{onClick:this.onFetch}):P&&f.createElement(zn,{onVisibleChange:this.onLoaderVisible,config:a},f.createElement(Ca,{$isFirstLoad:O},f.createElement(p,{className:ct.loaderClassName})))))}};De.className="giphy-grid";De.loaderClassName="loader";De.fetchDebounce=250;De.defaultProps=$a;De.getDerivedStateFromProps=({externalGifs:e},t)=>e&&e!==t.gifs?{gifs:e}:null;var ka=De,hc=ka,q={searchbarHeight:"--searchbar-height",bgColor:"--searchbar-bg-color",bgColor2:"--searchbar-bg-color-2",fgColor:"--searchbar-fg-color",cancelButtonDisplay:"--searchbar-cancel-button-display"};C.div`
    ${q.searchbarHeight}: ${e=>e.$searchbarHeight||42}px;
    @media (${e=>e.$mobileMediaQuery}) {
        ${q.searchbarHeight}: ${e=>e.$mobileSearchbarHeight||35}px;
    }
    ${q.bgColor}: ${at};
    ${q.bgColor2}: ${at};
    ${q.fgColor}: ${Ht};
    ${e=>e.$darkMode&&bt`
            ${q.fgColor}: ${at};
            ${q.bgColor}: ${Ht};
            ${q.bgColor2}: ${as};
        `}
    ${q.cancelButtonDisplay}: ${e=>e.$hideCancelButton?"none":"block"};
`;E.createContext({});E.createContext({});C.svg`
    position: relative;
    right: 10px;
    margin-left: 5px;
    cursor: pointer;
    display: var(${q.cancelButtonDisplay});
`;var Kn=6,ur=`calc(var(${q.searchbarHeight}) - ${Kn*2}px)`,Sa=Ye`
to {
    width: ${ur};
}
`;C(wt)`
    height: ${ur};
    margin: 0;
    width: 0;
    animation: ${Sa} 100ms ease-in-out forwards;
`;C.div`
    background: var(${q.bgColor2});
    display: flex;
    align-items: center;
    padding-left: ${Kn}px;
`;C.div`
    background: ${cs};
    display: flex;
    padding: 0 4px;
    color: ${ss};
    font-family: interface, Helvetica Neue, helvetica, sans-serif;
    font-weight: 600;
    font-size: 12px;
    align-items: center;
    height: ${ur};
    @media (max-width: 480px) {
        display: none;
    }
`;var Aa=({className:e=""})=>f.createElement("svg",{viewBox:"0 0 30 30",version:"1.1",className:e},f.createElement("defs",null,f.createElement("path",{d:"M11.5482521,20.4090671 L4.24727698,28.2009189 C3.68084207,28.8054377 2.73159653,28.8363108 2.12707771,28.2698759 C1.5225589,27.703441 1.4916858,26.7541954 2.0581207,26.1496766 L9.40599838,18.3077689 C7.95982241,16.4371424 7.0978836,14.0789715 7.0978836,11.5181818 C7.0978836,5.44914339 11.9392549,0.518181818 17.9252787,0.518181818 C23.9113026,0.518181818 28.7526738,5.44914339 28.7526738,11.5181818 C28.7526738,17.5872202 23.9113026,22.5181818 17.9252787,22.5181818 C15.539851,22.5181818 13.3361963,21.7351359 11.5482521,20.4090671 Z M17.9252787,19.5181818 C22.242011,19.5181818 25.7526738,15.9425536 25.7526738,11.5181818 C25.7526738,7.09381 22.242011,3.51818182 17.9252787,3.51818182 C13.6085464,3.51818182 10.0978836,7.09381 10.0978836,11.5181818 C10.0978836,15.9425536 13.6085464,19.5181818 17.9252787,19.5181818 Z",id:"giphy-search-icon-path-1"})),f.createElement("g",{id:"search",stroke:"none",strokeWidth:"1",fill:"none",fillRule:"evenodd"},f.createElement("g",{id:"icons/search"},f.createElement("mask",{id:"giphy-search-icon-mask-2",fill:"white"},f.createElement("use",{xlinkHref:"#giphy-search-icon-path-1"})),f.createElement("use",{id:"Mask",fill:"#FFFFFF",fillRule:"nonzero",xlinkHref:"#giphy-search-icon-path-1"}),f.createElement("g",{mask:"url(#giphy-search-icon-mask-2)"},f.createElement("g",{transform:"translate(0.250000, 0.250000)"},f.createElement("g",null)))))),Ia=Aa,Ra="2s",It="#E646B6",Xr="#FF6666",Qn="cubic-bezier(0.920, 0.240, 0.185, 0.730)",Pa=Ye`
    0% {
      transform: rotate(34deg) translate(-10px, 80px);
    };
    
    100% {
      transform: rotate(34deg) translate(-10px, -20px);
    }
`,Oa=Ye`
    0% { 
      transform: translate(0px, 0px);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translate(10px, -17px);
      opacity: 0;
    }
`,Da=Ye`
    0% {
      opacity: 0;
      transform: translateX(-400%);
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateX(0);
    }
`;C.div`
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    cursor: pointer;
    @media screen and (-ms-high-contrast: active), screen and (-ms-high-contrast: none) {
        display: none;
    }
    height: var(${q.searchbarHeight});
    width: var(${q.searchbarHeight});
`;C.div`
    position: absolute;
    height: 100%;
    width: 100%;
    background: linear-gradient(45deg, ${It} 0%, ${Xr} 100%);
    border-radius: 0 4px 4px 0;
    overflow: hidden;
    &:before {
        animation: ${Da} ${Ra} linear 0s infinite;
        background-image: linear-gradient(45deg, ${It} 0%, ${Xr} 50%, ${It} 100%);
        background-size: 400%;
        background-position: 0% 100%;
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        width: 400%;
    }
`;C.div`
    width: 100%;
    height: 100%;
    position: absolute;
    overflow: hidden;
    &::after {
        content: '+';
        color: white;
        font-family: 'SS Standard';
        font-size: 8px;
        position: absolute;
        top: 65%;
        left: 66%;
        animation: ${Oa} 1s ${Qn} 0s 1 forwards;
    }
`;C.div`
    position: absolute;
    width: 200%;
    height: 20px;
    background: rgba(255, 255, 255, 0.5);
    transform: rotate(34deg) translate(-10px, -20px);
    animation: ${Pa} 1s ${Qn} 0s 1;
    filter: blur(1px);
`;C(Ia)`
    z-index: 1;
    display: flex;
    width: 50%;
    height: 50%;
`;C.div`
    display: flex;
    background: white;
    align-items: center;
    border-radius: 4px;
    height: var(${q.searchbarHeight});
    background: var(${q.bgColor2});
`;C.input`
    background: inherit;
    box-sizing: border-box;
    border: 0;
    appearance: none;
    font-weight: normal;
    font-family: interface, Helvetica Neue, helvetica, sans-serif;
    outline: 0;
    font-size: 15px;
    padding: 0 10px;
    border-radius: 0;
    text-overflow: ellipsis;
    color: var(${q.fgColor});
    &::placeholder {
        color: ${Mn};
    }
    min-width: 150px;
    flex: 1;
    ${e=>e.$isUsernameSearch&&bt`
            color: ${ls};
        `}
`;var Ta=({size:e=18,className:t})=>f.createElement("svg",{width:e,height:e,viewBox:"0 0 18 16",version:"1.1",xmlns:"http://www.w3.org/2000/svg",className:t},f.createElement("g",{id:"trending",stroke:"none",strokeWidth:"1",fill:"none",fillRule:"evenodd"},f.createElement("g",null,f.createElement("rect",{id:"Rectangle",stroke:"#979797",fill:"#D8D8D8",opacity:"0",x:"0.5",y:"0.5",width:"17",height:"17"}),f.createElement("path",{d:"M12.6093329,3.12057664 L15.156896,3.12057664 L9.64199318,9.04253019 L6.88133868,6.8175119 C6.7544587,6.67603813 6.56616874,6.60087259 6.38404017,6.61897279 C6.2490402,6.63288422 6.11891631,6.69661171 6.02063992,6.79697337 C2.21226835,10.5943119 0.308082561,12.4929812 0.308082561,12.4929812 C0.308082561,12.4929812 0.527106106,12.8074292 0.710953088,13.0215425 C0.833517743,13.1642848 0.975497751,13.3098497 1.13689311,13.4582373 L6.47329888,8.13191205 L9.16381134,10.2953038 C9.40800276,10.5710787 9.68933701,10.7021044 10.019278,10.4570223 L16.0239805,4.04474473 C16.0239805,5.87956383 16.0239805,6.79697337 16.0239805,6.79697337 C16.0239805,6.79697337 16.4320205,6.79697337 17.2481004,6.79697337 L17.2481004,1.80604505 C14.1555887,1.80604505 12.6093329,1.80604505 12.6093329,1.80604505 C12.6093329,1.80604505 12.6093329,2.24422225 12.6093329,3.12057664 Z",id:"Shape",stroke:"#00CCFF",strokeWidth:"0.4",fill:"#00CCFF",fillRule:"nonzero",transform:"translate(8.778091, 7.632141) rotate(-2.000000) translate(-8.778091, -7.632141) "})))),Na=Ta,Xn=9;C.div`
    background: ${Fn};
    display: flex;
    padding-right: 4px;
    align-items: center;
    margin-right: ${Xn}px;
    cursor: pointer;
`;C.div`
    background: ${Fn};
    display: flex;
    padding: 14px;
    align-items: center;
    margin-right: ${Xn}px;
    white-space: nowrap;
    cursor: pointer;
    font-style: italic;
    border-radius: 20px;
`;C(wt)`
    height: var(${q.searchbarHeight});
    width: var(${q.searchbarHeight});
`;C(Na)`
    margin-right: 2px;
`;C.div`
    display: flex;
    color: white;
    flex-direction: row;
    font-family: 'interface';
    font-weight: 600;
    font-size: 14px;
    -webkit-overflow-scrolling: touch;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 10px;
    height: var(${q.searchbarHeight});
`;var Fa=({onClick:e})=>f.createElement("svg",{width:"66px",height:"13px",viewBox:"0 0 66 13",onClick:e},f.createElement("g",{stroke:"none",strokeWidth:1,fill:"none",fillRule:"evenodd"},f.createElement("g",{transform:"translate(-1060.000000, -462.000000)",fill:"#FFFFFF",fillRule:"nonzero"},f.createElement("g",{transform:"translate(931.000000, 286.375671)"},f.createElement("g",{transform:"translate(86.000000, 136.124329)"},f.createElement("path",{d:"M47.968,49.1962322 C49.588,49.1962322 51.052,48.6202322 51.58,47.5522322 L51.58,43.8202322 L47.476,43.8202322 L47.476,45.6802322 L49.6,45.6802322 L49.6,46.7602322 C49.12,47.1082322 48.424,47.1922322 47.98,47.1922322 C46.288,47.1922322 45.724,45.8602322 45.724,44.7802322 C45.724,43.1362322 46.612,42.3202322 47.98,42.3202322 C48.544,42.3202322 49.288,42.4762322 49.9,43.0522322 L51.28,41.6842322 C50.176,40.5682322 49.144,40.3282322 47.98,40.3282322 C44.824,40.3282322 43.384,42.5842322 43.384,44.7802322 C43.384,46.9762322 44.644,49.1962322 47.968,49.1962322 Z M54.928,48.9682322 L54.928,40.5682322 L52.564,40.5682322 L52.564,48.9682322 L54.928,48.9682322 Z M58.648,48.9682322 L58.648,46.7002322 L60.352,46.7002322 C62.596,46.6762322 63.724,45.3442322 63.724,43.6282322 C63.724,41.9842322 62.608,40.5682322 60.352,40.5682322 L56.272,40.5682322 L56.272,48.9682322 L58.648,48.9682322 Z M60.352,44.6962322 L58.648,44.6962322 L58.648,42.6082322 L60.352,42.6082322 C61,42.6082322 61.348,43.1122322 61.348,43.6642322 C61.348,44.2162322 61.012,44.6962322 60.352,44.6962322 Z M66.796,48.9802322 L66.796,45.8002322 L69.82,45.8002322 L69.82,48.9802322 L72.172,48.9802322 L72.172,40.5802322 L69.82,40.5802322 L69.82,43.7722322 L66.796,43.7722322 L66.796,40.5802322 L64.42,40.5802322 L64.42,48.9802322 L66.796,48.9802322 Z M78.16,48.9682322 L78.16,45.6202322 L81.496,40.6762322 L81.496,40.5682322 L78.82,40.5682322 L77.008,43.4482322 L75.268,40.5682322 L72.592,40.5682322 L72.592,40.6642322 L75.784,45.6202322 L75.784,48.9682322 L78.16,48.9682322 Z M87.796,49.1362322 C88.972,49.1362322 90.088,48.7402322 90.952,47.8882322 L90.028,46.9642322 C89.44,47.5522322 88.576,47.8762322 87.796,47.8762322 C85.624,47.8762322 84.712,46.3522322 84.7,44.8162322 C84.688,43.2682322 85.66,41.6962322 87.796,41.6962322 C88.576,41.6962322 89.368,41.9722322 89.968,42.5602322 L90.868,41.6962322 C90.016,40.8442322 88.924,40.4242322 87.796,40.4242322 C84.796,40.4242322 83.356,42.6202322 83.3679256,44.8282322 C83.38,47.0362322 84.748,49.1362322 87.796,49.1362322 Z M93.028,48.9682322 L93.028,40.5802322 L91.792,40.5802322 L91.792,48.9682322 L93.028,48.9682322 Z M94.252,41.3122322 C94.252,42.3322322 95.788,42.3322322 95.788,41.3122322 C95.788,40.3042322 94.252,40.3042322 94.252,41.3122322 Z M95.632,48.9682322 L95.632,43.0282322 L94.396,43.0282322 L94.396,48.9682322 L95.632,48.9682322 Z M98.188,51.7162322 L98.188,48.1042322 C98.632,48.8362322 99.556,49.1002322 100.276,49.1002322 C102.112,49.1002322 103.264,47.8042322 103.264,46.0162322 C103.264,44.2282322 102.04,42.9442322 100.276,42.9322322 C99.484,42.9322322 98.644,43.2922322 98.188,44.0122322 L98.116,43.0522322 L96.952,43.0522322 L96.952,51.7162322 L98.188,51.7162322 Z M100.156,47.9002322 C99.076,47.9002322 98.296,47.0722322 98.296,46.0162322 C98.296,44.9602322 99.016,44.1322322 100.156,44.1322322 C101.284,44.1322322 102.028,44.9002322 102.028,46.0162322 C102.028,47.1202322 101.236,47.9002322 100.156,47.9002322 Z M106.456,49.1482322 C107.992,49.1482322 108.964,48.3802322 108.976,47.2762322 C108.988,45.7522322 107.56,45.5122322 106.468,45.4162322 C105.712,45.3442322 105.196,45.1522322 105.184,44.6602322 C105.184,44.1922322 105.688,43.9402322 106.444,43.9522322 C107.032,43.9522322 107.536,44.0722322 108.004,44.5042322 L108.7,43.6882322 C108.04,43.1002322 107.332,42.8962322 106.42,42.8962322 C105.316,42.8962322 103.96,43.3882322 103.96,44.6962322 C103.972,46.0042322 105.256,46.3642322 106.372,46.4722322 C107.248,46.5562322 107.752,46.7602322 107.74,47.2882322 C107.728,47.8402322 107.068,48.0562322 106.48,48.0562322 C105.784,48.0442322 104.956,47.7922322 104.404,47.1802322 L103.756,48.0562322 C104.536,48.9322322 105.496,49.1482322 106.456,49.1482322 Z",id:"GIPHYClips"})))))),Ma=Fa,ja=C.div`
    display: flex;
    align-items: center;
    font-family: interface, helvetica, arial;
    cursor: pointer;
`,Ga=C(wt)`
    flex-shrink: 0;
`,Ba=C.div`
    display: flex;
    flex-direction: column;
`,fr=({gif:e,className:t,onClick:r})=>{const{user:n}=e;return!(n!=null&&n.username)&&!(n!=null&&n.display_name)?null:f.createElement(ja,{className:[fr.className,t].join(" "),onClick:i=>{if(i.preventDefault(),i.stopPropagation(),r)r(e);else{const o=n.profile_url;o&&window.open(o,"_blank")}}},f.createElement(Ga,{user:n}),f.createElement(Ba,null,f.createElement(Ma,{onClick:i=>{i.preventDefault(),i.stopPropagation(),r?r(e):e.url&&window.open(e.url,"_blank")}}),f.createElement(Un,{user:n})))};fr.className="giphy-attribution";var Ha=fr,Jn=25,Ua=({size:e=Jn,onClick:t=()=>{}})=>f.createElement("svg",{width:e,height:e,viewBox:"0 0 26 23",onClick:t},f.createElement("g",{stroke:"none",strokeWidth:1,fill:"none",fillRule:"evenodd"},f.createElement("g",{transform:"translate(1.000000, 0.000000)",fill:"#FFF",fillRule:"nonzero"},f.createElement("path",{d:"M11.9625091,0.572584405 L11.9625091,22.2272644 C11.9625091,22.4856644 11.8466091,22.6635044 11.6151891,22.7611644 C11.3480491,22.8413444 11.1390491,22.7968844 10.9878091,22.6277844 L4.8732291,15.9143244 L0.573909096,15.9143244 C0.413549096,15.9143244 0.277509096,15.8588444 0.166549096,15.7475044 C0.0573082348,15.6406091 -0.00292164572,15.4933347 -1.77635684e-15,15.3405244 L-1.77635684e-15,7.45058441 C-1.77635684e-15,7.29022441 0.0555890961,7.15456441 0.167309096,7.04322441 C0.278269096,6.93226441 0.414309096,6.87640441 0.573909096,6.87640441 L4.8732291,6.87640441 L10.9874291,0.172064405 C11.1390491,0.00296440549 11.3484291,-0.0414955945 11.6151891,0.0386844055 C11.8466091,0.136344405 11.9621291,0.314564405 11.9621291,0.572584405 L11.9625091,0.572584405 Z"}),f.createElement("path",{d:"M15.7579491,16.0914044 L14.6798891,13.6594044 C15.5739159,13.2635547 16.1503537,12.3776671 16.1501091,11.3999244 C16.150386,10.4242626 15.5763999,9.53983269 14.6852091,9.14272441 L15.7697291,6.71376441 C17.6193585,7.53872062 18.810518,9.37466359 18.8101092,11.3999244 C18.8105521,13.4298903 17.6139475,15.2691931 15.7579491,16.0914044 L15.7579491,16.0914044 Z"}),f.createElement("path",{d:"M18.3647491,20.2619044 L17.2863091,17.8299044 C19.8302925,16.7031661 21.4705725,14.1822599 21.4701091,11.3999244 C21.4701091,8.59818441 19.8167291,6.09892441 17.3022691,4.97678441 L18.3864091,2.54782441 C21.8804724,4.10607079 24.1307363,7.57414217 24.1301093,11.3999244 C24.1308375,15.2343934 21.8705556,18.7086904 18.3647491,20.2619044 Z"})))),za=({size:e=Jn,onClick:t=()=>{}})=>f.createElement("svg",{onClick:t,height:e,width:e,viewBox:"0 0 26 23",version:"1.1",xmlns:"http://www.w3.org/2000/svg"},f.createElement("g",{id:"Page-1",stroke:"none",strokeWidth:1,fill:"none",fillRule:"evenodd"},f.createElement("g",{id:"Group",transform:"translate(1.000000, 0.000000)",fill:"#FFFFFF",fillRule:"nonzero"},f.createElement("path",{d:"M11.9625091,0.572584405 L11.9625091,22.2272644 C11.9625091,22.4856644 11.8466091,22.6635044 11.6151891,22.7611644 C11.3480491,22.8413444 11.1390491,22.7968844 10.9878091,22.6277844 L4.8732291,15.9143244 L0.573909096,15.9143244 C0.413549096,15.9143244 0.277509096,15.8588444 0.166549096,15.7475044 C0.0573082348,15.6406091 -0.00292164572,15.4933347 0,15.3405244 L0,7.45058441 C0,7.29022441 0.0555890961,7.15456441 0.167309096,7.04322441 C0.278269096,6.93226441 0.414309096,6.87640441 0.573909096,6.87640441 L4.8732291,6.87640441 L10.9874291,0.172064405 C11.1390491,0.00296440549 11.3484291,-0.0414955945 11.6151891,0.0386844055 C11.8466091,0.136344405 11.9621291,0.314564405 11.9621291,0.572584405 L11.9625091,0.572584405 Z",id:"Path"})),f.createElement("g",{id:"Group",transform:"translate(14.887009, 6.947630)",fill:"#FFFFFF",fillRule:"nonzero"},f.createElement("path",{d:"M7.88199149,6.27905236 C7.94693088,6.35707599 7.94693088,6.47033309 7.88199149,6.54835671 L6.54835671,7.88199149 C6.47033309,7.94693088 6.35707599,7.94693088 6.27905236,7.88199149 L3.96534802,5.56828715 L1.65164367,7.88199149 C1.57362004,7.94693088 1.46036294,7.94693088 1.38233932,7.88199149 L0.0487045381,6.54835671 C-0.016234846,6.47033309 -0.016234846,6.35707599 0.0487045381,6.27905236 L2.36240889,3.96534802 L0.0487045381,1.65164367 C-0.016234846,1.57362004 -0.016234846,1.46036294 0.0487045381,1.38233932 L1.38233932,0.0487045381 C1.46036294,-0.016234846 1.57362004,-0.016234846 1.65164367,0.0487045381 L3.96534802,2.36240889 L6.27905236,0.0487045381 C6.35707599,-0.016234846 6.47033309,-0.016234846 6.54835671,0.0487045381 L7.88199149,1.38233932 C7.94693088,1.46036294 7.94693088,1.57362004 7.88199149,1.65164367 L5.56828715,3.96534802 L7.88199149,6.27905236 Z",id:"Shape"})))),Va=C.div`
    background: ${at};
    height: ${e=>e.$barHeight}px;
    position: absolute;
    width: 5px;
    bottom: 0;
    left: 0;
    opacity: 0.95;
`,qa=({videoEl:e})=>{As(2147483647,100);const t=(e==null?void 0:e.currentTime)||0,r=(e==null?void 0:e.duration)||0,n=t/r;let i=Math.round(n*100),o=5;return(e==null?void 0:e.height)<200?o=3:(e==null?void 0:e.height)<300&&(o=4),i=r<10&&i>98?100:i,f.createElement(Va,{style:{width:`${i}%`},$barHeight:o,className:"hide-in-percy"})},Wa=qa,Za=(e,t="")=>{switch(e){case 1:return"Aborted. The fetching process for the media resource was aborted by the user agent at the user's request.";case 2:return"Network Error. A network error of some description caused the user agent to stop fetching the media resource, after the resource was established to be usable.";case 3:return"Decode Error. An error of some description occurred while decoding the media resource, after the resource was established to be usable.";case 4:return`Can not play a video of type "${t.split(".").pop()}" on this platform.`;default:return""}},Ya=(e,t,r,n,i)=>{const o=i+e;return!n.has(o)&&r>0&&t>r*e?(n.add(o),!0):!1},Ka=[.25,.5,.75],ei="giphy-video",Qa={IDLE:1},ti=({muted:e,ccEnabled:t=!1,ccLanguage:r="en",loop:n=!0,onStateChange:i,onTimeUpdate:o,onCanPlay:s,onFirstPlay:d,onWaiting:u,onMuted:g,onError:m,onEnded:v,onLoop:y,onQuartile:x,onEndFullscreen:b,setVideoEl:k,gif:$,width:S,percentWidth:w,height:a,volume:c=.7,className:l=ei,isInPlayer:p})=>{var h,_,A;const R=a||ft($,S);let P;w&&(P=`${Math.round(R/S*100)}%`);const[O,F]=E.useState(gr($.video,S,R)),D=E.useRef(0);O||console.warn(`GiphyJS No video content for id: ${$.id}`);const X=E.useRef(Date.now()),N=E.useRef(!1),G=E.useRef(0),Y=E.useRef(0),te=E.useRef(new Set);E.useEffect(()=>{X.current=Date.now(),N.current=!1,G.current=1,Y.current=0,te.current=new Set},[$.id]);const M=E.useRef(null);E.useEffect(()=>{const L=gr($.video,S,R);M.current&&(O!=null&&O.url)&&L.url!==O.url&&(O.url.indexOf(String($.id))!==-1&&(D.current=M.current.currentTime),F(L))},[S,a,$.video,R,O==null?void 0:O.url,$.id]),E.useEffect(()=>{M.current&&(O!=null&&O.url)&&D.current&&(M.current.currentTime=D.current,D.current=0)},[O==null?void 0:O.url,D]);const re=E.useCallback(()=>{var L;const ee=M.current,ve=(L=ee==null?void 0:ee.error)==null?void 0:L.code;if(ve&&(ee!=null&&ee.src)){const _t=Za(ve,ee==null?void 0:ee.src);console.error(_t),m==null||m(ve)}},[m]),H=E.useCallback(()=>{i==null||i("playing"),N.current||(N.current=!0,$.analytics_response_payload&&sr({actionType:"START",analyticsResponsePayload:$.analytics_response_payload}),d==null||d(Date.now()-X.current))},[d,i,$]),z=E.useCallback(()=>i==null?void 0:i("paused"),[i]),V=E.useCallback(()=>{const L=M.current;if(L){const ee=L.currentTime;Ka.some(ve=>Ya(ve,ee,L.duration,te.current,G.current)?(x==null||x(ve),!0):!1),o==null||o(ee||0)}},[x,o]),U=E.useCallback(()=>s==null?void 0:s(),[s]),ae=E.useCallback(()=>{const L=M.current;(L==null?void 0:L.currentTime)!==0&&(L==null?void 0:L.networkState)!==Qa.IDLE&&(u==null||u(++Y.current))},[u]),ne=E.useCallback(()=>{n&&M.current&&M.current.play(),y==null||y(G.current),G.current=G.current+1,N.current&&(v==null||v())},[v,n,y]),de=E.useCallback(()=>b==null?void 0:b(),[b]),he=E.useCallback(L=>cr(void 0,null,function*(){if(L){const ee=L.play();if(ee!==void 0)try{yield ee,g==null||g(!1)}catch{L.muted=!0,g==null||g(!0),L.play()}}}),[g]);E.useEffect(()=>{const L=M.current;L&&(he(L),k==null||k(L),isNaN(c)||(L.volume=c))},[]),E.useEffect(()=>{const L=M.current;return L&&(L.addEventListener("play",H),L.addEventListener("pause",z),L.addEventListener("error",re),L.addEventListener("timeupdate",V),L.addEventListener("canplay",U),L.addEventListener("ended",ne),L.addEventListener("waiting",ae),L.addEventListener("webkitendfullscreen",de)),()=>{L&&(L.removeEventListener("play",H),L.removeEventListener("pause",z),L.removeEventListener("error",re),L.removeEventListener("timeupdate",V),L.removeEventListener("canplay",U),L.removeEventListener("ended",ne),L.removeEventListener("waiting",ae),L.removeEventListener("webkitendfullscreen",de))}},[H,z,re,V,U,ne,ae,de]);const J=(A=(_=(h=$.video)==null?void 0:h.captions)==null?void 0:_[r])==null?void 0:A.vtt;return O!=null&&O.url?f.createElement("video",{crossOrigin:"anonymous",draggable:!0,className:l,width:p?"100%":w||S,height:p?"100%":P||R,muted:e,autoPlay:!0,playsInline:!0,ref:M,src:O==null?void 0:O.url,"data-giphy-id":$.id},t&&J&&f.createElement("track",{label:"English",kind:"subtitles",srcLang:r,src:J,default:!0})):null};ti.className=ei;var ri=ti,Xa=C.div`
    position: relative;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: black;
    font-family: interface, helvetica, arial;
    -webkit-font-smoothing: antialiased;
`,Ja=C.div`
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    cursor: pointer;
`,ec=C.div`
    position: absolute;
    top: 10px;
    right: 10px;
    left: 10px;
    bottom: 0;
    display: flex;
    justify-content: space-between;
    opacity: ${e=>e.$isHovered?1:0};
    transition: opacity ease-out 250ms;
    align-items: flex-start;
`,tc=C.div`
    font-size: 22px;
    color: white;
    margin-bottom: 5px;
    font-weight: bold;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    user-select: none;
    cursor: pointer;
`,rc=C.div`
    position: relative;
    min-width: 0;
`,nc=C.div`
    &:before {
        background: linear-gradient(rgba(18, 18, 18, 0.6), rgba(0, 0, 0, 0));
        content: '';
        height: ${e=>e.$isLargePlayer?125:75}px;
        left: 0;
        pointer-events: none;
        position: absolute;
        top: 0;
        width: 100%;
    }
    &:after {
        background: linear-gradient(rgba(0, 0, 0, 0), rgba(18, 18, 18, 0.6));
        content: '';
        height: ${e=>e.$isLargePlayer?125:75}px;
        left: 0;
        pointer-events: none;
        position: absolute;
        bottom: 0;
        width: 100%;
    }
`,ic=300,oc=4e3,sc=e=>{const{style:t,width:r,percentWidth:n,hideMute:i,hideAttribution:o,hideProgressBar:s,hideTitle:d,className:u,persistentControls:g,gif:m,overlay:v}=e,[y,x]=E.useState(!1),[b,k]=E.useState(null),[$,S]=E.useState(e.muted),[w,a]=E.useState(!1),{setVideoEl:c,onMuted:l,onUserMuted:p}=e,h=e.height||ft(m,r);let _;n&&(_=`${Math.round(h/r*100)}%`);const[,A,R]=xs(()=>{x(!1)},oc),P=E.useCallback(N=>{l==null||l(N),a(N)},[a,l]),O=E.useCallback(N=>{c==null||c(N),k(N)},[c,k]),F=()=>{w?(a(!1),S(!1)):S(!$)};E.useEffect(()=>{S(e.muted)},[e.muted]);const D=g||y,X=h>=ic;return E.useEffect(()=>(D?R():A(),()=>A()),[D,A,R]),f.createElement(Xa,{className:u,style:me({width:n||r,height:_||h},t),onMouseOver:()=>x(!0),onMouseLeave:()=>x(!1),onMouseMove:()=>{x(!0),R()},onClick:N=>{p==null||p(!($||w)),b==null||b.play(),N.preventDefault(),F()}},f.createElement(ri,ar(me({},e),{isInPlayer:!0,onMuted:P,setVideoEl:O,muted:$})),D&&f.createElement(nc,{$isLargePlayer:X}),f.createElement(ec,{$isHovered:D},f.createElement(rc,null,!d&&X&&f.createElement(tc,{onClick:N=>{N.preventDefault(),N.stopPropagation(),window.open(m.url,"_blank")}},m.title),b&&!o?f.createElement(Ha,{gif:m}):null),!i&&f.createElement(Ja,null,$||w?f.createElement(za,null):f.createElement(Ua,null))),D&&!s&&b?f.createElement(Wa,{videoEl:b}):null,v&&f.createElement(v,{gif:m,isHovered:y,width:r,height:h}))},ac=e=>(e.overlay&&!e.controls&&console.warn(`${Q.PREFIX}: Overlays only work when controls are enabled`),e.controls?f.createElement(sc,me({},e)):f.createElement(ri,me({},e))),cc=ac;C.div`
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
    height: 100%;
    width: 100%;
`;C(cc)`
    height: 100%;
    display: inline-block;
    object-fit: fill;
    pointer-events: none;
    background: rgb(0, 0, 0, 0);
`;C.div`
    position: absolute;
    top: 6px;
    right: 6px;
    cursor: pointer;
    opacity: ${e=>e.$isHovered?1:.8};
    transition: opacity ease-out 800ms;
`;Pt("X-GIPHY-SDK-NAME","ReactSDK");export{dc as a,hc as g};
