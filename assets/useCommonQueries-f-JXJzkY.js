import{u as d,a as l,b as m}from"./vendor-query-DrdG__HH.js";import{s as o,a as f}from"./index-D4IKFgwI.js";import{z as a}from"./vendor-ui-Dc0hOKOO.js";import"./AuthenticatedApp-B6nZAF7Z.js";import"./PublicApp-CyHzLK_q.js";const _=async t=>{if(!t)return[];const{data:e,error:r}=await o.from("contacts").select(`
      *,
      contact_user:contact_user_id (
        id,
        name,
        avatar,
        phone,
        is_online,
        last_seen
      )
    `).eq("user_id",t).order("contact_name",{ascending:!0});if(r)throw r;return f(e||[])},w=t=>d({queryKey:["contacts",t],queryFn:()=>_(t),enabled:!!t,staleTime:1e3*60*5,gcTime:1e3*60*30,refetchOnWindowFocus:!1}),g=()=>{const t=l();return m({mutationFn:async({userId:e,contactUserId:r,contactName:i})=>{const{data:s,error:n}=await o.from("contacts").select("id").eq("user_id",e).eq("contact_user_id",r).maybeSingle();if(n)throw n;if(s)return a.error("Contact already exists"),s;const{data:u,error:c}=await o.from("contacts").insert([{user_id:e,contact_user_id:r,contact_name:i}]).select().single();if(c)throw c;return u},onSuccess:(e,r)=>{t.invalidateQueries({queryKey:["contacts",r.userId]}),a.success("Contact added successfully!")},onError:e=>{console.error("Error adding contact:",e),a.error("Failed to add contact")}})};export{g as a,w as u};
