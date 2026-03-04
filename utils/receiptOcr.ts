/**
 * Placeholder for receipt OCR. Replace with Google Cloud Vision or a local OCR library.
 * Returns extracted total amount in CFA (or null if unavailable).
 */
export async function extractAmountFromReceiptImage(_imageUri: string): Promise<number | null> {
    // TODO: Integrate Google Cloud Vision API or expo-image-manipulator + Tesseract/local OCR
    // Example Vision: const [result] = await visionClient.textDetection(imageBuffer);
    // Parse "Total" / "TOTAL" line and numeric value.
    return null;
}
