/**
 * Rewrite every URI in an HLS playlist to an absolute URL.
 *
 * A playlist served from this addon's /play/ route lives at a different
 * address from the CDN it came from, so its relative entries (Mako uses
 * "../550/hdntl=.../index_550.m3u8") would resolve against the addon.
 * Resolving them against the CDN URL keeps them pointing at the CDN.
 */

function absolutizePlaylist(text, baseUrl) {
    return String(text)
        .split(/\r?\n/)
        .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith("#")) {
                return line.replace(/URI="([^"]+)"/g, (_, uri) => 'URI="' + new URL(uri, baseUrl).href + '"');
            }
            return new URL(trimmed, baseUrl).href;
        })
        .join("\n");
}

module.exports = { absolutizePlaylist };
