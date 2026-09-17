import { isQuotaError } from "../storage/operations";

export function toUserError(e: unknown, fallbackMsg: string): string {
    if (isQuotaError(e)) return "Storage full — delete a project or clear data.";
    return e instanceof Error ? e.message : fallbackMsg;
}
