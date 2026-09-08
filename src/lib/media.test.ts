import { describe, expect, it, vi } from "vitest";
import {
    loadExportMediaImages,
    mediaLoadWarningPure,
    revokeExportObjectUrls,
    youtubeShortlinkPure,
    youtubeVideoIdPure,
} from "./media";

function fakeImage(): HTMLImageElement {
    return {} as HTMLImageElement;
}

describe("loadExportMediaImages", () => {
    it("loads image media and skips video and bare nodes", async () => {
        const nodes = [
            { id: "a", media: { kind: "image" as const, src: "https://example.com/a.png", uploadId: null } },
            { id: "b", media: { kind: "video" as const, src: "https://example.com/v.mp4", uploadId: null } },
            { id: "c", media: null },
        ];
        const seen: string[] = [];
        const res = await loadExportMediaImages(nodes, {
            loadOne: (src) => {
                seen.push(src);
                return Promise.resolve(fakeImage());
            },
        });
        expect(seen).toEqual(["https://example.com/a.png"]);
        expect([...res.images.keys()]).toEqual(["a"]);
        expect(res.failedIds).toEqual([]);
    });
    it("collects failures instead of rejecting", async () => {
        const nodes = [
            { id: "good", media: { kind: "image" as const, src: "https://example.com/ok.png", uploadId: null } },
            { id: "bad", media: { kind: "image" as const, src: "https://example.com/missing.png", uploadId: null } },
        ];
        const res = await loadExportMediaImages(nodes, {
            loadOne: (src) =>
                src.includes("missing") ? Promise.reject(new Error("nope")) : Promise.resolve(fakeImage()),
        });
        expect([...res.images.keys()]).toEqual(["good"]);
        expect(res.failedIds).toEqual(["bad"]);
    });
    it("times out slow hosts", async () => {
        const nodes = [{ id: "slow", media: { kind: "image" as const, src: "https://example.com/slow.png", uploadId: null } }];
        const res = await loadExportMediaImages(nodes, {
            timeoutMs: 10,
            loadOne: () => new Promise<never>(() => undefined),
        });
        expect(res.images.size).toBe(0);
        expect(res.failedIds).toEqual(["slow"]);
    });
    it("resolves upload refs to object urls and tracks them", async () => {
        const nodes = [
            { id: "up", media: { kind: "image" as const, src: "", uploadId: "blob-1" } },
            { id: "gone", media: { kind: "image" as const, src: "", uploadId: "blob-2" } },
        ];
        const seen: string[] = [];
        const res = await loadExportMediaImages(nodes, {
            loadOne: (src) => {
                seen.push(src);
                return Promise.resolve(fakeImage());
            },
            resolveUpload: (uploadId) =>
                uploadId === "blob-1" ? Promise.resolve("blob:upload-1") : Promise.reject(new Error("missing")),
        });
        expect(seen).toEqual(["blob:upload-1"]);
        expect([...res.images.keys()]).toEqual(["up"]);
        expect(res.failedIds).toEqual(["gone"]);
        expect(res.objectUrls).toEqual(["blob:upload-1"]);
    });
});

describe("revokeExportObjectUrls", () => {
    it("revokes every url and tolerates an empty list", () => {
        const revoked: string[] = [];
        const original = URL.revokeObjectURL;
        URL.revokeObjectURL = (url: string) => {
            revoked.push(url);
        };
        try {
            revokeExportObjectUrls(["blob:a", "blob:b"]);
            expect(revoked).toEqual(["blob:a", "blob:b"]);
            revokeExportObjectUrls([]);
            expect(revoked).toEqual(["blob:a", "blob:b"]);
        } finally {
            URL.revokeObjectURL = original;
        }
        expect(vi.isMockFunction(URL.revokeObjectURL)).toBe(false);
    });
});

describe("mediaLoadWarningPure", () => {    it("returns null with no names", () => {
        expect(mediaLoadWarningPure([])).toBeNull();
        expect(mediaLoadWarningPure(["  "])).toBeNull();
    });
    it("names one node and suggests manual add", () => {
        const warning = mediaLoadWarningPure(["Sunset"])!;
        expect(warning).toContain('"Sunset"');
        expect(warning).toContain("placeholder instead");
        expect(warning).toContain("adding it to the project manually");
    });
    it("truncates long name lists", () => {
        const warning = mediaLoadWarningPure(["a", "b", "c", "d", "e"])!;
        expect(warning).toContain("and 2 more");
    });
});

describe("youtubeVideoIdPure", () => {
    it("extracts ids from watch, short, embed, live, and youtu.be forms", () => {
        expect(youtubeVideoIdPure("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
        expect(youtubeVideoIdPure("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
        expect(youtubeVideoIdPure("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
        expect(youtubeVideoIdPure("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
        expect(youtubeVideoIdPure("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
        expect(youtubeVideoIdPure("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    });
    it("rejects non-youtube, bad ids, and non-urls", () => {
        expect(youtubeVideoIdPure("https://example.com/v.mp4")).toBeNull();
        expect(youtubeVideoIdPure("https://www.youtube.com/watch")).toBeNull();
        expect(youtubeVideoIdPure("https://www.youtube.com/watch?v=ab")).toBeNull();
        expect(youtubeVideoIdPure("not a url")).toBeNull();
        expect(youtubeVideoIdPure(null)).toBeNull();
    });
    it("builds shortlinks", () => {
        expect(youtubeShortlinkPure("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
            "https://youtu.be/dQw4w9WgXcQ",
        );
        expect(youtubeShortlinkPure("https://youtu.be/dQw4w9WgXcQ")).toBe("https://youtu.be/dQw4w9WgXcQ");
        expect(youtubeShortlinkPure("https://example.com/v.mp4")).toBeNull();
    });
});
