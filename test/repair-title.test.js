const test = require("node:test");
const assert = require("node:assert/strict");

const { repairTitle } = require("../classes/repairTitle");

test("Latin-accented and Arabic live names are not re-decoded as Hebrew", () => {
    assert.equal(repairTitle("i24 Français"), "i24 Français");
    assert.equal(repairTitle("i24 News Français en direct"), "i24 News Français en direct");
    assert.equal(repairTitle("i24 العربية"), "i24 العربية");
    assert.equal(repairTitle("Café"), "Café");
    assert.equal(repairTitle("élève"), "élève");
    assert.equal(repairTitle("קשת 12"), "קשת 12");
    assert.equal(repairTitle("i24 English"), "i24 English");
});

test("Windows-1255 Hebrew that was read as Latin-1 is still repaired", () => {
    // Bytes E7 E3 F9 E5 FA are חדשות. Stored as Latin-1 they look like çãùåú.
    assert.equal(repairTitle("çãùåú"), "חדשות");
    assert.equal(repairTitle("12 çãùåú"), "12 חדשות");
    // Geresh fragments from the other scraper corruption.
    assert.equal(repairTitle("׳”׳ž"), "המ");
});
