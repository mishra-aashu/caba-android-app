import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { videoId } = await req.json()
    if (!videoId) throw new Error("Video ID missing hai!")

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    let finalStreamUrl = null;
    let finalTitle = "Elevengram Track";

    console.log(`[Cobalt v10] Fetching: ${videoUrl}`);

    try {
      const response = await fetch("https://api.cobalt.tools/api/json", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          // 2026 Best Practice: Add a custom User-Agent to avoid generic bot detection
          "User-Agent": "ElevengramApp/2.0 (Social Media Integration)"
        },
        body: JSON.stringify({
          url: videoUrl,
          downloadMode: "audio",
          audioFormat: "mp3",
          audioBitrate: "128", // Balance between quality and fast loading
          filenameStyle: "basic"
        })
      });

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(`Cobalt v10 Error: ${data.text}`);
      }

      if (data.status === "redirect" || data.status === "stream") {
        finalStreamUrl = data.url;
        finalTitle = data.filename || finalTitle;
        console.log(`[Cobalt v10] Success`);
      }
    } catch (e) {
      console.log(`[Cobalt v10] Failed: ${e.message}`);
    }

    // Engineering Flex: Fallback to Invidious
    if (!finalStreamUrl) {
      console.log(`[Invidious Fallback] Attempting iv.melmac.space`);
      const invRes = await fetch(`https://iv.melmac.space/api/v1/videos/${videoId}`);
      if (invRes.ok) {
        const invData = await invRes.json();
        const audioFormats = (invData.adaptiveFormats || []).filter((f: any) => f.type?.startsWith("audio/"));
        if (audioFormats.length > 0) {
          audioFormats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
          finalStreamUrl = audioFormats[0].url;
          finalTitle = invData.title || finalTitle;
          console.log(`[Invidious Fallback] Success`);
        }
      }
    }

    if (!finalStreamUrl) {
       throw new Error("All extraction methods failed");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        streamUrl: finalStreamUrl, 
        title: finalTitle
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error) {
    console.error("LOGS:", error.message)
    return new Response(
      JSON.stringify({ error: "Sync Service Unavailable", detail: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    )
  }
})