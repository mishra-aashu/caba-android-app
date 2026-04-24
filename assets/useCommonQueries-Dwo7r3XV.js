import{u as d,a as l,b as f}from"./vendor-query-Dlt_da-g.js";import{s,c as m}from"./index-D1ZepQ4L.js";import{z as a}from"./vendor-ui-extras-CSImfmXj.js";import"./AuthenticatedApp-DPIBAAbF.js";const _=async t=>{if(!t)return[];const{data:e,error:r}=await s.from("contacts").select(`
      *,
      contact_user:contact_user_id (
        id,
        name,
        avatar,
        phone,
        is_online,
        last_seen
      )
    `).eq("user_id",t).order("contact_name",{ascending:!0});if(r)throw r;return m(e||[])},q=t=>d({queryKey:["contacts",t],queryFn:()=>_(t),enabled:!!t,staleTime:1e3*60*5,gcTime:1e3*60*30,refetchOnWindowFocus:!1}),w=()=>{const t=l();return f({mutationFn:async({userId:e,contactUserId:r,contactName:i})=>{const{data:n,error:o}=await s.from("contacts").select("id").eq("user_id",e).eq("contact_user_id",r).maybeSingle();if(o)throw o;if(n)return a.error("Contact already exists"),n;const{data:u,error:c}=await s.from("contacts").insert([{user_id:e,contact_user_id:r,contact_name:i}]).select().single();if(c)throw c;return u},onSuccess:(e,r)=>{t.invalidateQueries({queryKey:["contacts",r.userId]}),a.success("Contact added successfully!")},onError:e=>{console.error("Error adding contact:",e),a.error("Failed to add contact")}})};export{w as a,q as u};
