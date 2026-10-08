/**
 * Repair Hebrew titles that were stored as Windows-1255 bytes read as Latin-1.
 *
 * That corruption looks like "çãùåú" (the bytes of חדשות). A Latin name with
 * one accent, such as "Français", shares a single one of those bytes (ç is
 * U+00E7, which is ח in Windows-1255). Re-decoding any non-Hebrew string
 * turns that accent into ח. Only strings whose non-ASCII letters are a run
 * of those Windows-1255 bytes are repaired. Arabic and other non-Latin-1
 * text is left as-is.
 */

const CP1255_HEBREW_AS_LATIN1 = /[\u00E0-\u00FA]/;
const HEBREW = /[֐-׿]/;

function isWindows1255Mojibake(title) {
    // Real Hebrew, Arabic, and any other non-Latin-1 character cannot be
    // this byte-for-byte misread.
    if (/[^\u0000-\u00FF]/.test(title)) return false;

    let mojibakeLetters = 0;
    let asciiLetters = 0;
    for (let i = 0; i < title.length; i++) {
        const code = title.charCodeAt(i);
        if (code >= 0xE0 && code <= 0xFA) mojibakeLetters++;
        else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) asciiLetters++;
    }
    // A French word is mostly ASCII letters plus an accent. A broken Hebrew
    // title is mostly the high bytes themselves.
    return mojibakeLetters >= 2 && mojibakeLetters > asciiLetters && CP1255_HEBREW_AS_LATIN1.test(title);
}

function repairTitle(title) {
    if (!title || typeof title !== "string") return title;

    if (isWindows1255Mojibake(title)) {
        try {
            const bytes = Buffer.from(title, "latin1");
            const recovered = new TextDecoder("windows-1255").decode(bytes);
            if (HEBREW.test(recovered)) return recovered;
        } catch (e) {
            // Keep the original title when the decode fails.
        }
    }

    // Geresh-prefixed fragments from another scraper corruption.
    if (title.includes("׳")) {
        return title
            .replace(/׳”/g, "ה")
            .replace(/׳ž/g, "מ")
            .replace(/׳¢/g, "ע")
            .replace(/׳‘/g, "ב")
            .replace(/׳¨/g, "ר")
            .replace(/׳–/g, "נ")
            .replace(/׳/g, "");
    }

    return title;
}

module.exports = {
    repairTitle,
    isWindows1255Mojibake
};
