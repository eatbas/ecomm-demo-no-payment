import type { JazzCashConfig } from "../config.js";
import { hashAdminPassword } from "../auth/admin-session.js";

export const TEST_ADMIN_PASSWORD = "correct-horse-battery-staple";
export const TEST_ADMIN_PASSWORD_HASH = hashAdminPassword(TEST_ADMIN_PASSWORD);
export const TEST_ADMIN_SESSION_SECRET = "test-admin-session-secret";

export const TEST_JAZZCASH_CONFIG: JazzCashConfig = {
  baseUrl: "https://onlinepayments.jazzcash.example.test",
  merchantId: "MC00001",
  password: "merchant-password",
  integritySalt: "integrity-salt",
  returnUrl: "https://shop.example.test/checkout/return",
};

export function createTestCustomer() {
  return {
    fullName: "Zara Khan",
    email: "zara@example.test",
    phone: "+92 300 1234567",
    addressLine1: "12 Model Town",
    city: "Lahore",
    postcode: "54700",
    country: "Pakistan",
  };
}
