/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OneTimePurchaseOfferDetails {
  formattedPrice: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
}

export interface ProductDetails {
  productId: string;
  type: 'inapp' | 'subs';
  title: string;
  description: string;
  oneTimePurchaseOfferDetails?: OneTimePurchaseOfferDetails;
}

export interface BillingEvent {
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  purchaseToken?: string;
  error?: string;
}

// Native Microsoft Store Mock API Elements
export enum StorePurchaseStatus {
  succeeded = 'succeeded',
  alreadyPurchased = 'alreadyPurchased',
  notPurchased = 'notPurchased',
  networkError = 'networkError',
  serverError = 'serverError'
}

export interface StorePurchaseResult {
  status: StorePurchaseStatus;
  extendedError?: string;
}

// Native Mobile Money Gateway Response Type
export interface MoMoPaymentResponse {
  status: 'success' | 'failed' | 'pending';
  transactionId?: string;
  errorMessage?: string;
}

/**
 * Enterprise-grade Mock Google Play Billing, Microsoft Store, and Local MoMo (Mobile Money) SDK Service.
 * Allows querying digital catalog details and triggers native billing handshakes.
 */
class MockStoreBillingService {
  private listeners: ((event: BillingEvent) => void)[] = [];

  /**
   * Register store transactions status listener for purchases
   */
  registerTransactionListener(callback: (event: BillingEvent) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Simulates Play Billing 'queryProductDetails' dynamically resolving localized offer pricing tags
   */
  async queryProductDetails(productId: string): Promise<ProductDetails> {
    // Simulate brief network/API service delay
    await new Promise(resolve => setTimeout(resolve, 600));

    // Dynamic localization check for Ghana West Africa district profile
    let formattedPrice = "$19.99";
    let currencyCode = "USD";
    let amountMicros = 19990000;

    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      const lang = navigator.language || "";
      
      // West Africa timezone or Language localization detection
      if (
        tz.includes('Africa') || 
        tz.includes('Accra') || 
        tz.includes('Lagos') || 
        lang.includes('-GH') || 
        lang.includes('-NG')
      ) {
        formattedPrice = "GH₵ 250";
        currencyCode = "GHS";
        amountMicros = 250000000;
      }
    } catch {
      // Fallback stays USD $19.99
    }

    if (productId === "premium_upgrade_pro") {
      return {
        productId,
        type: 'inapp',
        title: "Unlock Pro Reporting & Automation",
        description: "Generate unlimited automated terminal reports, access high-speed grading grids, and activate parent SMS features.",
        oneTimePurchaseOfferDetails: {
          formattedPrice,
          priceAmountMicros: amountMicros,
          priceCurrencyCode: currencyCode
        }
      };
    }

    throw new Error(`Product mapping offline: ${productId}`);
  }

  /**
   * Launch native billing overlay dialog and return resolution
   */
  async launchBillingFlow(productId: string): Promise<boolean> {
    if (productId !== "premium_upgrade_pro") {
      return false;
    }

    // Simulate merchant payment gateway authorization delay (e.g. 1.2s spinner)
    await new Promise(resolve => setTimeout(resolve, 1400));

    const token = `gplay_gp_token_${Math.floor(Math.random() * 90000 + 10000)}_${Date.now()}`;
    
    // Notify all registered transaction subscribers of Success
    this.listeners.forEach(listener => {
      try {
        listener({
          status: 'SUCCESS',
          purchaseToken: token
        });
      } catch (e) {
        console.error("Transaction subscription listener threw error:", e);
      }
    });

    return true;
  }

  /**
   * Native Microsoft Store purchasing mechanism
   */
  async requestPurchaseAsync(productId: string): Promise<StorePurchaseResult> {
    // Simulate Windows Store payment modal rendering and authorization handshake
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (productId === "premium_upgrade_pro") {
      return {
        status: StorePurchaseStatus.succeeded
      };
    }
    
    return {
      status: StorePurchaseStatus.notPurchased,
      extendedError: "Unsupported digital product identifier."
    };
  }

  /**
   * Mobile Money Payment Channel Processing (MoMo/Paystack/Flutterwave gateway emulator)
   */
  async processMoMoPayment(phoneNumber: string, provider: string): Promise<MoMoPaymentResponse> {
    // Simulate regional USSD prompt validation and parent/registrar device verification
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simple verification check to ensure valid phone context
    if (!phoneNumber || phoneNumber.replace(/\s+/g, '').length < 8) {
      return {
        status: 'failed',
        errorMessage: "Invalid Mobile Money number length or prefix structure."
      };
    }

    return {
      status: 'success',
      transactionId: `momo_txr_${Math.floor(Math.random() * 89999 + 10000)}_${Date.now().toString().slice(-4)}`
    };
  }
}

export const billingService = new MockStoreBillingService();
