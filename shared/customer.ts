export const MAX_CUSTOMER_FULL_NAME_LENGTH = 120;
export const MAX_CUSTOMER_EMAIL_LENGTH = 254;
export const MAX_CUSTOMER_PHONE_LENGTH = 32;
export const MAX_CUSTOMER_ADDRESS_LINE1_LENGTH = 160;
export const MAX_CUSTOMER_CITY_LENGTH = 120;
export const MAX_CUSTOMER_POSTCODE_LENGTH = 20;
export const MAX_CUSTOMER_COUNTRY_LENGTH = 60;

// Deliberately permissive: real customers type real names, addresses and phone
// numbers, so this only rejects the empty string and control characters, not any
// particular script or format. Email keeps a conservative shape check because it
// is also used as the JazzCash bill reference correlation point.
export const CUSTOMER_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+[.][^\s@]+$/;
const CONTROL_CHARACTER_CODE_POINT_MAX = 0x1f;
const DELETE_CHARACTER_CODE_POINT = 0x7f;

export interface CustomerDetails {
  readonly fullName: string;
  readonly email: string;
  readonly phone: string;
  readonly addressLine1: string;
  readonly city: string;
  readonly postcode: string;
  readonly country: string;
}

interface CustomerFieldRule {
  readonly key: keyof CustomerDetails;
  readonly maxLength: number;
}

export const CUSTOMER_FIELD_RULES: readonly CustomerFieldRule[] = [
  { key: "fullName", maxLength: MAX_CUSTOMER_FULL_NAME_LENGTH },
  { key: "email", maxLength: MAX_CUSTOMER_EMAIL_LENGTH },
  { key: "phone", maxLength: MAX_CUSTOMER_PHONE_LENGTH },
  { key: "addressLine1", maxLength: MAX_CUSTOMER_ADDRESS_LINE1_LENGTH },
  { key: "city", maxLength: MAX_CUSTOMER_CITY_LENGTH },
  { key: "postcode", maxLength: MAX_CUSTOMER_POSTCODE_LENGTH },
  { key: "country", maxLength: MAX_CUSTOMER_COUNTRY_LENGTH },
];

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index) ?? 0;
    if (
      codePoint <= CONTROL_CHARACTER_CODE_POINT_MAX ||
      codePoint === DELETE_CHARACTER_CODE_POINT
    ) {
      return true;
    }
  }
  return false;
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !containsControlCharacter(value)
  );
}

/** Validate a plain object as real (non-demo) customer contact and billing details. */
export function isValidCustomerDetails(value: unknown): value is CustomerDetails {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record);
  const expectedKeys = CUSTOMER_FIELD_RULES.map((rule) => rule.key);
  if (
    actualKeys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => actualKeys.includes(key))
  ) {
    return false;
  }

  return (
    CUSTOMER_FIELD_RULES.every((rule) =>
      isNonEmptyBoundedString(record[rule.key], rule.maxLength),
    ) && CUSTOMER_EMAIL_PATTERN.test(record.email as string)
  );
}
