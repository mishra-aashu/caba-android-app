import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { JWT } from "https://esm.sh/google-auth-library@9"

const serviceAccount = {
  project_id: "caba-13cf1",
  client_email: "firebase-adminsdk-fbsvc@caba-13cf1.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDTiuvNEnLIibAB\nFszin4vVh1hViXESCgu1yyhygrEvHFBCBnrp/GtoBvIUhqYm6K6qLYGRvDSgdr1U\nIQpXo3ByM9eohLsny9JwsQuvwFcN07if4PMHfW6a6VzWomJInGlK9cXdm97/dtpD\nmlVMxBM65wL0MPYuXVJi4PmosQb4wsY7VBgXe539uXXepN0N9TMxceI5JUjDg1Bu\nu9yw/9aTtbsygA8UCLsr0C+2HcbepIP1AScj3mhxSVNL5YUdyLIFIDvAcAhFMhMh\nxLMXPSwdUnS26o1GWpqk0kFIrM8V3TUG/FBZ7KOcwup6PRzhMgggw1/Q+lpVL+7e\nBftP88fxAgMBAAECggEALBI9pPgqdLAGvHtZDP+rPL2ZQBzFsznnjaS5FP44VrXB\n3LeH5PaDE+Wain8w31tLhEW9wDRjDGkgcYX+pxp0Qz6ct82LRjO28GZaJm/eUxGg\nXaKaTx2pLNngTxD+g90eLJE+ezhNgZBr0Xi2O6t/zB4zpdcLesZTcykmqifTaYCd\nM9R7SYaLFe0k7kg77jx2ChEgbzhfUfebySl1daDYLFTszxpbTIKqAJElYR9GS0Cl\nB+czS4S6O9SobSQUv5n+qlnLWsakq+NPzQeFjS5sIOq/l8TkaL0/3fYdQj0IQCLE\nOxjB7f7H3Xr3+icJcFcZ0Z9LIRdxJsrGIZ8QZ5fVPwKBgQD/eBw6OGwGBL7HGU1L\nrVDT5uX2ItMb5SaXjuYakCRn9HvfMc7a98NPLb86Gh17Pw9HqF6gE3U/wRTV8CQO\n/qhu9A4zsVCHna6YKkmttpvToYdDYGT5YHB1YaH5gHMJerMaZj4H58C37YKK/jhM\noUtHqMFgk/l+RLmkxSL8n8fRawKBgQDT+3IB7VBc1hwWjV7ziHpeGZ2toA0SfZ1d\n257/UQw5Bb93tavXzGXZbjcY8pp8WBnA7MqEY15kT71PsnbBSTb2g6aqm+CsTaCk\nXoOM9m6aWsJJUZAQnBgDzxS7nJIclUk9khcvPdZGOOpXKENoamptsZh6XF7RzcVB\nawQzQnP3EwKBgQC0zR69HZ1mDQmwAvovavPfZHSv5Cmgfmb3sEyt1AHQCLl6Vtfd\nJKh3axsBVeYziYeY4VJG3D6I5m+GkbQTYKt4CwXaE824jSI50wPeC3TxLEp8psYP\nr+8nQ/fMitnfhZUoQ9/23FAKW++dyxmxMh4DEy342gEjGiSAtnxyaeqTDQKBgEIs\n7dNSLVM99/jGW0z1XxX/My0fmNUb58OEKyeTOpiWhcYuLZ4pjeYJtSORoM6OhkOm\n6DXZ+36fMf8uPEpsu77LLH14OfQwK6UEaFbaG38ONDbFQo8c25Zc0CEdaLOJmxqg\nf6Jc0IaNgAKDbD+tcNobpfkU2vjuHtUkPmRuK1uHAoGAVkCwHRVbVPCh/tdpo2TU\nuGMT7SfuI67i4Vl/8JoF+FD0FQ/aYLuPctjQGejCdGFkps+cXvB54I3zR7Gmk2V0\nwhG8v/uI5xH48krIfgrdp0RjP0ScN8/Kp2eoy2DJb36o9ZzZkpQq1TdgIZ63Gi/W\nKDZYsgrcJfIp+z0+VXoVd2U=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
};

serve(async (req: Request) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    
    const receiverId = record.receiver_id;
    const messageText = record.content || record.text || "New Message";

    const supabase = createClient(
      Deno.env.get('MY_SUPABASE_URL') ?? '',
      Deno.env.get('MY_SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('fcm_token_android, fcm_token_web')
      .eq('id', receiverId)
      .single();

    if (userError || !userData?.fcm_token_android) {
      console.error("Token Error:", userError);
      return new Response("No token found", { status: 200 });
    }

    const jwtClient = new JWT(
      serviceAccount.client_email,
      undefined,
      serviceAccount.private_key,
      ['https://www.googleapis.com/auth/cloud-platform']
    );
    const authTokens = await jwtClient.authorize();

    const fcmRes = await fetch(`https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`, {
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
            chatId: String(record.chat_id || "")
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
    return new Response(err.message, { status: 500 });
  }
});