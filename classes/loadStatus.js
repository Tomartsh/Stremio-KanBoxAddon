/**
 * In-memory record of whether this process loaded the catalog from Supabase
 * or fell back to the ZIP exports.
 *
 * Render's free tier idles and starts a new process, so the counters are for
 * the current process only. This module does not read environment values.
 * Error text is redacted before it is stored or returned.
 */

const MAX_FALLBACKS = 20;
const REDACTED = "[redacted]";

function toMs(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? NaN : parsed;
}

function errorText(error) {
    if (error == null) return "Unknown error";
    if (typeof error === "string") return error;
    if (typeof error.message === "string" && error.message.length > 0) return error.message;
    return "Unknown error";
}

function replaceWithTrail(pattern, text) {
    return text.replace(pattern, (match) => {
        const trimmed = match.replace(/[),.;:!?]+$/g, "");
        return REDACTED + match.slice(trimmed.length);
    });
}

/**
 * Remove URLs, hostnames, IP addresses, JWT-like strings, and
 * sb_publishable_ / sb_secret_ tokens from a load error.
 * @param {unknown} value
 * @returns {string}
 */
function redact(value) {
    if (value == null) return "";
    let text = String(value);

    // scheme:// URLs, including userinfo, paths, and query strings.
    text = replaceWithTrail(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, text);
    // Percent-encoded http(s) URLs that never contained a literal "://".
    text = replaceWithTrail(/\bhttps?%3A%2F%2F[^\s"'<>]+/gi, text);
    text = text.replace(/\bsb_(?:publishable|secret)_[A-Za-z0-9_-]*/gi, REDACTED);
    // JWT-like: three base64url segments, header beginning with eyJ ("{").
    text = text.replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, REDACTED);
    text = text.replace(
        /\b(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}|localhost)(?::\d{2,5})?\b/gi,
        (match) => {
            const host = match.replace(/:\d{2,5}$/, "");
            if (/\.(?:js|mjs|cjs|ts|tsx|jsx|json|md|zip|jpg|jpeg|png|svg|html|css|map|txt|log)$/i.test(host)) {
                return match;
            }
            return REDACTED;
        }
    );
    text = text.replace(
        /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?::\d{2,5})?\b/g,
        REDACTED
    );
    return text;
}

function createLoadStatus(options = {}) {
    const now = options.now || (() => Date.now());
    const initialMs = options.startedAt != null ? toMs(options.startedAt) : toMs(now());
    const startedMs = Number.isFinite(initialMs) ? initialMs : Date.now();
    let version = options.version != null && options.version !== "" ? String(options.version) : null;
    let source = "loading";
    let lastDatabaseLoadAt = null;
    let lastLoadAttemptAt = null;
    let lastLoadError = null;
    const fallbacks = [];
    let fallbackCount = 0;

    function stamp() {
        const ms = toMs(now());
        return new Date(Number.isFinite(ms) ? ms : startedMs).toISOString();
    }

    return {
        setVersion(value) {
            if (value != null && value !== "") version = String(value);
        },
        noteAttempt() {
            try {
                lastLoadAttemptAt = stamp();
            } catch {
                // Recording must not change catalog loading.
            }
        },
        noteDatabaseSuccess() {
            try {
                const at = stamp();
                if (lastLoadAttemptAt == null) lastLoadAttemptAt = at;
                lastDatabaseLoadAt = at;
                lastLoadError = null;
                source = "supabase";
            } catch {
                // Recording must not change catalog loading.
            }
        },
        noteFallback(error) {
            try {
                const at = stamp();
                if (lastLoadAttemptAt == null) lastLoadAttemptAt = at;
                const message = redact(errorText(error));
                fallbackCount += 1;
                fallbacks.push({ at, error: message });
                if (fallbacks.length > MAX_FALLBACKS) fallbacks.shift();
                lastLoadError = message;
                source = "zip";
            } catch {
                // Recording must not change catalog loading.
            }
        },
        snapshot() {
            const elapsed = Math.floor((toMs(now()) - startedMs) / 1000);
            return {
                source,
                lastDatabaseLoadAt,
                lastLoadAttemptAt,
                lastLoadError,
                fallbacks: fallbacks.map((event) => ({ at: event.at, error: event.error })),
                fallbackCount,
                startedAt: new Date(startedMs).toISOString(),
                uptimeSeconds: Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0,
                version
            };
        }
    };
}

const loadStatus = createLoadStatus();

function sendStatus(res, status) {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json((status || loadStatus).snapshot());
}

function mountStatusRoute(app, status) {
    const current = status || loadStatus;
    app.get("/status", (_req, res) => {
        sendStatus(res, current);
    });
}

module.exports = {
    MAX_FALLBACKS,
    redact,
    createLoadStatus,
    loadStatus,
    sendStatus,
    mountStatusRoute
};
