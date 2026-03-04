/** In-memory result from verification scan screen (expo-camera). Verification screen reads this on focus. */
export type VerificationScanResult = { type: 'front' | 'back'; uri: string } | null;
let scanResult: VerificationScanResult = null;

export function setVerificationScanResult(result: VerificationScanResult): void {
    scanResult = result;
}

export function getAndClearVerificationScanResult(): VerificationScanResult {
    const out = scanResult;
    scanResult = null;
    return out;
}
