export function openNodeUrl(url: string): void {
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
        win.opener = null;
        return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
}
