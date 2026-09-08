import { UPLOAD_MAX_SIDE, fitDimensionsPure } from "../storage/localStore";

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Could not process the image."));
        }, type, quality);
    });
}

export async function downscaleImageFile(file: File, maxSide: number = UPLOAD_MAX_SIDE): Promise<Blob> {
    if (file.type === "image/gif") return file;
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error("Could not read that image file.");
    }
    try {
        const { width, height } = fitDimensionsPure(bitmap.width, bitmap.height, maxSide);
        if (width === 0 || height === 0) throw new Error("Could not read that image file.");
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not process the image.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(bitmap, 0, 0, width, height);
        return await canvasToBlob(canvas, "image/jpeg", 0.85);
    } finally {
        bitmap.close();
    }
}
