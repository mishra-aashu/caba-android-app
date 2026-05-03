async function inspectJioSaavn() {
    const query = "Kesariya";
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=20&p=1&_marker=0&ctx=web64bit&api_version=4&q=${encodeURIComponent(query)}`;
    
    console.log(`Fetching: ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    
    console.log("Total results:", data.results.length);
    
    data.results.forEach((song, i) => {
        const singers = song.more_info?.singers || song.primary_artists || song.singers || '';
        console.log(`[${i+1}] ${song.title} -> ${singers}`);
    });
}

inspectJioSaavn();
