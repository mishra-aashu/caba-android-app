async function checkProxy() {
    const url = 'https://listen-together-steel.vercel.app/api/search?query=Kesariya';
    console.log(`Checking proxy: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        const firstResult = data.data?.results?.[0];
        
        if (!firstResult) {
            console.log("No results found.");
            return;
        }

        console.log("Response fields:", Object.keys(firstResult));
        console.log("Debug field present:", !!firstResult.debug);
        console.log("DownloadUrl field present:", !!firstResult.downloadUrl);
        
        if (!firstResult.debug) {
            console.log("❌ CRITICAL: The proxy is running an OLD version of the code.");
        } else {
            console.log("✅ SUCCESS: The proxy is running the NEW version.");
            console.log("Decryption result:", firstResult.decryptedUrl ? "WORKING" : "FAILED");
        }
    } catch (e) {
        console.error("Fetch failed:", e.message);
    }
}

checkProxy();
