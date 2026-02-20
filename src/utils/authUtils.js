/**
 * Generates the correct redirect URL for Supabase OAuth.
 * Handles both GitHub Pages deployment and local development.
 */
export const getRedirectUrl = () => {
    // If we are on GitHub Pages, the origin + pathname (which includes the repo name) is the root
    // e.g., https://mishra-aashu.github.io/caba-android-app/
    const url = window.location.origin + window.location.pathname;

    // For Supabase "Redirect URLs" whitelist, the trailing slash can be important.
    // We ensure it ends with what the user likely configured in Supabase.
    return url.endsWith('/') ? url : `${url}/`;
};
