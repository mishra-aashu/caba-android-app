/**
 * Semantic version comparison utility
 * Returns true if local version is older than server version
 */
export const isOlderVersion = (local, server) => {
    if (!server || !local) return false;

    // Clean versions of any 'v' prefix
    const cleanLocal = local.startsWith('v') ? local.slice(1) : local;
    const cleanServer = server.startsWith('v') ? server.slice(1) : server;

    const localParts = cleanLocal.split('.').map(Number);
    const serverParts = cleanServer.split('.').map(Number);

    for (let i = 0; i < Math.max(localParts.length, serverParts.length); i++) {
        const l = localParts[i] || 0;
        const s = serverParts[i] || 0;
        if (l < s) return true;
        if (l > s) return false;
    }
    return false;
};
