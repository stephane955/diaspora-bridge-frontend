/**
 * Cameroon Mobile Money: validate MTN MoMo and Orange Money phone prefixes.
 * MTN MoMo: 65x, 67x, 68x, 69x (9 digits total typically).
 * Orange Money: 65x, 67x, 69x (carrier-specific).
 */

const MTN_PREFIXES = ['65', '67', '68', '69'];
const ORANGE_PREFIXES = ['65', '67', '69'];

export function normalizePhone(phone: string): string {
    return phone.replace(/\s+/g, '').replace(/^\+237/, '');
}

export function getMomoPrefix(digits: string): string | null {
    if (digits.length < 2) return null;
    const two = digits.slice(0, 2);
    return MTN_PREFIXES.includes(two) ? two : null;
}

export function getOrangePrefix(digits: string): string | null {
    if (digits.length < 2) return null;
    const two = digits.slice(0, 2);
    return ORANGE_PREFIXES.includes(two) ? two : null;
}

export function validateMomoNumber(phone: string): { valid: boolean; error?: string } {
    const digits = normalizePhone(phone);
    if (digits.length < 9) return { valid: false, error: 'Phone number too short' };
    const prefix = getMomoPrefix(digits);
    if (!prefix) return { valid: false, error: 'MTN MoMo numbers must start with 65, 67, 68, or 69' };
    return { valid: true };
}

export function validateOrangeNumber(phone: string): { valid: boolean; error?: string } {
    const digits = normalizePhone(phone);
    if (digits.length < 9) return { valid: false, error: 'Phone number too short' };
    const prefix = getOrangePrefix(digits);
    if (!prefix) return { valid: false, error: 'Orange Money numbers must start with 65, 67, or 69' };
    return { valid: true };
}

export function validateCarrierNumber(method: 'MOMO' | 'OM', phone: string): { valid: boolean; error?: string } {
    return method === 'MOMO' ? validateMomoNumber(phone) : validateOrangeNumber(phone);
}
