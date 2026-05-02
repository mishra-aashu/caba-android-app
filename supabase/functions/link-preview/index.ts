import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const response = await fetch(url);
    const html = await response.text();

    const getMetaTag = (name: string) => {
      const regex = new RegExp(
        `<meta(?:\\s+[^>]*?['"]?property['"]?\\s*=\\s*['"]?${name}['"]?[^>]*?|\\s+[^>]*?['"]?name['"]?\\s*=\\s*['"]?${name}['"]?[^>]*?)content\\s*=\\s*['"]?([^'"]+)['"]?[^>]*?>`,
        'i'
      );
      const match = regex.exec(html);
      return match ? match[1] : null;
    };

    const title = getMetaTag('og:title') || getMetaTag('twitter:title') || html.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const description = getMetaTag('og:description') || getMetaTag('twitter:description') || getMetaTag('description') || '';
    const image = getMetaTag('og:image') || getMetaTag('twitter:image') || '';

    const domain = new URL(url).hostname;

    return new Response(
      JSON.stringify({
        url,
        domain,
        title: title.trim(),
        description: description.trim(),
        image,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
