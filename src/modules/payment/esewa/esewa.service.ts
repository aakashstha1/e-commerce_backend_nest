/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  BadGatewayException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  generateEsewaSignature,
  verifyEsewaSignature,
} from './esewa-signature.util';

export interface EsewaFormPayload {
  action: string;
  fields: Record<string, string>;
}

export interface EsewaDecodedResult {
  transaction_code: string;
  status:
    | 'COMPLETE'
    | 'PENDING'
    | 'FULL_REFUND'
    | 'PARTIAL_REFUND'
    | 'AMBIGUOUS'
    | 'NOT_FOUND'
    | 'CANCELED';
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
}

export interface EsewaStatusResult {
  product_code: string;
  transaction_uuid: string;
  total_amount: number;
  status: EsewaDecodedResult['status'];
  ref_id?: string;
}

/**
 * Talks to eSewa's official RC (test/UAT) merchant sandbox — the "dummy" eSewa
 * payment page used for development. Same shapes work against production by
 * swapping the URLs/product code/secret key for live merchant credentials.
 *
 * Flow (eSewa's standard v2 ePay integration):
 * 1. We build a signed set of form fields and hand them to the frontend, which
 *    auto-submits a real <form> POST to eSewa's payment page (this "redirects"
 *    the user into eSewa).
 * 2. eSewa redirects the browser back to our success_url/failure_url (GET) with
 *    a base64-encoded `data` query param.
 * 3. We decode + verify the signature on that payload before trusting it.
 */
@Injectable()
export class EsewaService {
  private readonly logger = new Logger(EsewaService.name);

  constructor(private readonly configService: ConfigService) {}

  private get productCode() {
    return this.configService.getOrThrow<string>('esewa.productCode');
  }
  private get secretKey() {
    return this.configService.getOrThrow<string>('esewa.secretKey');
  }
  private get paymentUrl() {
    return this.configService.getOrThrow<string>('esewa.paymentUrl');
  }
  private get statusUrl() {
    return this.configService.getOrThrow<string>('esewa.statusUrl');
  }
  private get successUrl() {
    return this.configService.getOrThrow<string>('esewa.successUrl');
  }
  private get failureUrl() {
    return this.configService.getOrThrow<string>('esewa.failureUrl');
  }

  get frontendSuccessUrl() {
    return this.configService.getOrThrow<string>('esewa.frontendSuccessUrl');
  }
  get frontendFailureUrl() {
    return this.configService.getOrThrow<string>('esewa.frontendFailureUrl');
  }

  /**
   * Builds the signed hidden-form fields the frontend needs to POST the user's
   * browser straight to eSewa's payment page — this is the actual "redirect to
   * eSewa" step. No API call happens here; eSewa's form flow is a browser POST.
   */
  buildPaymentForm({
    amount,
    transactionUuid,
  }: {
    amount: number;
    transactionUuid: string;
  }): EsewaFormPayload {
    const taxAmount = 0;
    const productServiceCharge = 0;
    const productDeliveryCharge = 0;
    const totalAmount = amount;

    const fields = {
      amount: String(amount),
      tax_amount: String(taxAmount),
      total_amount: String(totalAmount),
      transaction_uuid: transactionUuid,
      product_code: this.productCode,
      product_service_charge: String(productServiceCharge),
      product_delivery_charge: String(productDeliveryCharge),
      success_url: this.successUrl,
      failure_url: this.failureUrl,
      signed_field_names: 'total_amount,transaction_uuid,product_code',
    };

    const signature = generateEsewaSignature(
      {
        total_amount: totalAmount,
        transaction_uuid: transactionUuid,
        product_code: this.productCode,
      },
      ['total_amount', 'transaction_uuid', 'product_code'],
      this.secretKey,
    );

    return {
      action: this.paymentUrl,
      fields: { ...fields, signature },
    };
  }

  /**
   * Decodes the base64 `data` query param eSewa sends back to success_url/failure_url
   * and verifies its signature. Throws if the signature doesn't match — this endpoint
   * is public (no JWT), so signature verification IS the authentication.
   */
  decodeAndVerify(base64Data: string): EsewaDecodedResult {
    let decoded: EsewaDecodedResult;
    try {
      const json = Buffer.from(base64Data, 'base64').toString('utf-8');
      decoded = JSON.parse(json);
    } catch {
      throw new BadRequestException('Malformed eSewa response payload');
    }

    const signedFieldNames = decoded.signed_field_names?.split(',') ?? [];
    const fields: Record<string, string> = {};
    for (const name of signedFieldNames) {
      fields[name] = (decoded as unknown as Record<string, string>)[name];
    }

    const isValid = verifyEsewaSignature(
      fields,
      signedFieldNames,
      this.secretKey,
      decoded.signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid eSewa signature');
    }

    return decoded;
  }

  /** Reconciliation fallback per eSewa's docs, in case a redirect never lands. */
  async checkStatus(
    transactionUuid: string,
    totalAmount: number,
  ): Promise<EsewaStatusResult> {
    try {
      const { data } = await axios.get(this.statusUrl, {
        params: {
          product_code: this.productCode,
          total_amount: totalAmount,
          transaction_uuid: transactionUuid,
        },
      });
      return data;
    } catch (error) {
      this.logger.error('eSewa checkStatus failed', error as Error);
      throw new BadGatewayException('Failed to check eSewa payment status');
    }
  }
}
