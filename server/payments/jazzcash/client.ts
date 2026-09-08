import { randomBytes } from "node:crypto";
import type { JazzCashConfig } from "../../config.js";
import { buildSecureHash } from "./hash.js";
import { addOneDay, formatPktTimestamp } from "./pkt-time.js";

// Both documented as path segments on the same JazzCash host (Environment and
// endpoints, card-page-redirection / status-inquiry). The host itself is never
// a literal string in source: it comes from config.jazzcash.baseUrl at runtime.
export const CARD_PAGE_REDIRECTION_PATH =
  "/payment-orchestrator/CustomerPortal/transactionmanagement/merchantform";
export const STATUS_INQUIRY_V2_PATH =
  "/payment-orchestrator/api/v2/rest/payments/status/inquiry";

const TXN_REF_RANDOM_SUFFIX_BYTES = 4;

/**
 * Every card (MPAY) page-redirection field, unsigned. Field order here is
 * cosmetic (the hash sorts by name independently); it exists for readability
 * and to keep the rendered form's field order stable.
 */
export interface CardRedirectionFields {
  readonly pp_Version: string;
  readonly pp_TxnType: string;
  readonly pp_Language: string;
  readonly pp_MerchantID: string;
  readonly pp_Password: string;
  readonly pp_TxnRefNo: string;
  readonly pp_Amount: string;
  readonly pp_TxnCurrency: string;
  readonly pp_TxnDateTime: string;
  readonly pp_BillReference: string;
  readonly pp_Description: string;
  readonly pp_TxnExpiryDateTime: string;
  readonly pp_ReturnURL: string;
  readonly pp_SubMerchantID: string;
  readonly pp_BankID: string;
  readonly pp_ProductID: string;
  readonly ppmpf_1: string;
  readonly ppmpf_2: string;
  readonly ppmpf_3: string;
  readonly ppmpf_4: string;
  readonly ppmpf_5: string;
  readonly pp_SecureHash: string;
}

/**
 * A merchant transaction reference, unique per payment *attempt* (not per
 * order — a retried attempt gets a fresh reference; card-page-redirection's
 * gotchas state retry semantics for a reused reference are undocumented).
 * The PKT timestamp keeps references sortable and traceable; the random
 * suffix (not the sample PDF's millisecond suffix) guards uniqueness under
 * concurrency without relying on clock resolution.
 */
export function createTxnRefNo(now: Date): string {
  const pktStamp = formatPktTimestamp(now);
  const randomSuffix = randomBytes(TXN_REF_RANDOM_SUFFIX_BYTES)
    .toString("hex")
    .toUpperCase();
  return `TRN${pktStamp}${randomSuffix}`;
}

/**
 * `&` is the hash's own delimiter and JazzCash's documents specify no escaping
 * rule for a value that contains one (card-page-redirection gotcha #13), so
 * strip it (and any control character) rather than let it make the signed
 * string ambiguous.
 */
export function sanitizeFreeText(value: string): string {
  // eslint-disable-next-line no-control-regex -- deliberately stripping control characters
  return value.replaceAll("&", "and").replace(/[\x00-\x1f\x7f]/g, "").trim();
}

export interface BuildCardRedirectionFieldsParams {
  readonly amountPaisa: number;
  readonly billReference: string;
  readonly description: string;
  readonly txnRefNo: string;
  readonly config: JazzCashConfig;
  readonly now: Date;
}

/** Build and sign the full card (MPAY) page-redirection field set. */
export function buildCardRedirectionFields(
  params: BuildCardRedirectionFieldsParams,
): CardRedirectionFields {
  const { amountPaisa, billReference, description, txnRefNo, config, now } =
    params;

  if (!Number.isSafeInteger(amountPaisa) || amountPaisa <= 0) {
    throw new RangeError(
      "amountPaisa must be a positive integer number of paisa.",
    );
  }

  const unsigned: Omit<CardRedirectionFields, "pp_SecureHash"> = {
    pp_Version: "1.1",
    pp_TxnType: "MPAY",
    pp_Language: "EN",
    pp_MerchantID: config.merchantId,
    pp_Password: config.password,
    pp_TxnRefNo: txnRefNo,
    pp_Amount: String(amountPaisa),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: formatPktTimestamp(now),
    pp_BillReference: sanitizeFreeText(billReference),
    pp_Description: sanitizeFreeText(description),
    pp_TxnExpiryDateTime: formatPktTimestamp(addOneDay(now)),
    pp_ReturnURL: config.returnUrl,
    pp_SubMerchantID: "",
    pp_BankID: "",
    pp_ProductID: "",
    ppmpf_1: "",
    ppmpf_2: "",
    ppmpf_3: "",
    ppmpf_4: "",
    ppmpf_5: "",
  };

  return {
    ...unsigned,
    pp_SecureHash: buildSecureHash(unsigned, config.integritySalt),
  };
}
