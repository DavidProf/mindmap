import { describe, expect, it } from "vitest";
import { formatZoomPct } from "./zoom";

describe("formatZoomPct", () => {
    it("formats in-range zoom as a percent", () => {
        expect(formatZoomPct(1)).toBe("100%");
        expect(formatZoomPct(0.25)).toBe("25%");
        expect(formatZoomPct(3)).toBe("300%");
    });
    it("rounds fractional zoom", () => {
        expect(formatZoomPct(1.234)).toBe("123%");
    });
    it("clamps out-of-range zoom", () => {
        expect(formatZoomPct(0.1)).toBe("25%");
        expect(formatZoomPct(99)).toBe("300%");
    });
    it("falls back for non-finite input", () => {
        expect(formatZoomPct(NaN)).toBe("100%");
        expect(formatZoomPct(Infinity)).toBe("100%");
    });
});
