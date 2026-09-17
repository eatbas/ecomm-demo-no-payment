export type JazzCashTxnType = "MPAY" | "MWALLET" | (string & {});

export type PaymentTransactionStatus =
  | "initiated"
  | "pending"
  | "paid"
  | "failed";

export interface JazzCashRedirectParameters extends Record<string, string> {
  readonly pp_Version: "1.1";
  readonly pp_TxnType: "MPAY";
  readonly pp_Language: "EN";
  readonly pp_MerchantID: string;
  readonly pp_Password: string;
  readonly pp_TxnRefNo: string;
  readonly pp_Amount: string;
  readonly pp_TxnCurrency: "PKR";
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
  pp_SecureHash: string;
}

export interface JazzCashIpnNotification {
  readonly pp_Version?: string;
  readonly pp_TxnType?: string;
  readonly pp_BankID?: string | null;
  readonly pp_ProductID?: string | null;
  readonly pp_Password?: string;
  readonly pp_TxnRefNo: string;
  readonly pp_TxnDateTime?: string;
  readonly pp_ResponseCode: string;
  readonly pp_ResponseMessage?: string;
  readonly pp_AuthCode?: string;
  readonly pp_SettlementExpiry?: string | null;
  readonly pp_RetreivalReferenceNo?: string;
  readonly pp_SecureHash: string;
  readonly [key: string]: unknown;
}

export interface JazzCashIpnAcknowledgement {
  readonly pp_ResponseCode: "000";
  readonly pp_ResponseMessage: "IPN received successfully";
  readonly pp_SecureHash: string;
}

export interface JazzCashReturnPayload {
  readonly pp_ResponseCode?: string;
  readonly pp_ResponseMessage?: string;
  readonly pp_TxnRefNo?: string;
  readonly pp_RetreivalReferenceNo?: string;
  readonly pp_AuthCode?: string;
  readonly pp_SecureHash?: string;
  readonly [key: string]: unknown;
}

export interface PaymentTransactionRecord {
  readonly id: string;
  readonly orderId: string;
  readonly txnRefNo: string;
  readonly txnType: JazzCashTxnType;
  readonly amountPaisa: number;
  readonly currency: "PKR";
  readonly status: PaymentTransactionStatus;
  readonly responseCode?: string;
  readonly responseMessage?: string;
  readonly retrievalRefNo?: string;
  readonly authCode?: string;
  readonly txnDatetime?: string;
  readonly rawIpnPayload?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}
