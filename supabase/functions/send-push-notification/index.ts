// @ts-nocheck
// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// @ts-ignore
import { JWT } from "https://esm.sh/google-auth-library@9"

// 🔒 SECRETS ab Environment Variables se aayenge (Secure!)
const SERVICE_ACCOUNT = {
  project_id: Deno.env.get('FIREBASE_PROJECT_ID'),
  client_email: Deno.env.get('FIREBASE_CLIENT_EMAIL'),
  private_key: Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n'),
};

serve(async (req: any) => {
  try {
    // 1. Check Payload
    const payload = await req.json();
    const record = payload.record;

    if (!record) {
      return new Response("No record found", { status: 400 });
    }

    // 💡 NOTE: Rate Limiting yahan hatani hai!
    // Kyunki ye function tabhi call hoga jab Message DB me save ho chuka hai.
    // Humne SQL Policy me already INSERT par Rate Limit laga diya hai.
    // Agar user block hai, to Message save hi nahi hoga, aur ye function call hi nahi hoga.
    // So, Double Rate Limiting is not needed here.

    const receiverId = record.receiver_id;
    // const senderId = record.sender_id; // Agar limit lagani hi hai, to senderId par lagao, IP par nahi.
    const messageText = record.content || record.text || "New Message";

    // 2. Setup Supabase Client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Service Role chahiye Users table read karne ke liye
    );

    // 3. Get Receiver's FCM Token
    const { data: userData, error: userError } = await supabase
      .from('users') // Apni table ka naam check karlena 'profiles' ya 'users'
      .select('fcm_token_android, fcm_token_web')
      .eq('id', receiverId)
      .single();

    if (userError || !userData?.fcm_token_android) {
      console.log("No token found for user:", receiverId);
      return new Response("User has no token", { status: 200 }); // 200 OK return karo taaki Webhook retry na kare
    }

    // 4. Authenticate with Google (Firebase)
    const jwtClient = new JWT(
      SERVICE_ACCOUNT.client_email,
      undefined,
      SERVICE_ACCOUNT.private_key,
      ['https://www.googleapis.com/auth/cloud-platform']
    );
    const authTokens = await jwtClient.authorize();

    // 5. Send Notification
    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${SERVICE_ACCOUNT.project_id}/messages:send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authTokens.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: userData.fcm_token_android,
          notification: {
            title: "New Message",
            body: messageText
          },
          data: {
            chatId: String(record.chat_id || ""),
            type: "chat_message"
          }
        }
      })
    });

    const result = await fcmRes.json();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err) {
    console.error("Function Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});