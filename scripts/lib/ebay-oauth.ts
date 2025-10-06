import crypto from 'crypto';

interface EBayOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class EBayOAuth {
  private appId: string;
  private certId: string;
  private devId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private environment: 'production' | 'sandbox';

  constructor(environment: 'production' | 'sandbox' = 'production') {
    const envPrefix = environment === 'production' ? 'EBAY_PROD' : 'EBAY';

    this.appId = process.env[`${envPrefix}_APP_ID`] || process.env.EBAY_APP_ID || '';
    this.certId = process.env[`${envPrefix}_CERT_ID`] || process.env.EBAY_CERT_ID || '';
    this.devId = process.env[`${envPrefix}_DEV_ID`] || process.env.EBAY_DEV_ID || '';
    this.environment = environment;

    if (!this.appId || !this.certId || !this.devId) {
      throw new Error(
        `Missing eBay ${environment} credentials. Required: ${envPrefix}_APP_ID, ${envPrefix}_CERT_ID, ${envPrefix}_DEV_ID`
      );
    }

    // Check if using sandbox credentials in production mode
    if (environment === 'production' && this.appId.includes('SBX')) {
      throw new Error(
        '⚠️  Sandbox credentials detected in production mode!\n' +
        '   Get production credentials at: https://developer.ebay.com/my/keys\n' +
        '   Set environment variables: EBAY_PROD_APP_ID, EBAY_PROD_CERT_ID, EBAY_PROD_DEV_ID'
      );
    }
  }

  /**
   * Get OAuth 2.0 access token using Client Credentials flow
   * @returns Access token
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const baseUrl = this.environment === 'production'
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    const authString = Buffer.from(`${this.appId}:${this.certId}`).toString('base64');

    const response = await fetch(`${baseUrl}/identity/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`eBay OAuth failed: ${error}`);
    }

    const data: EBayOAuthTokenResponse = await response.json();

    this.accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

    return this.accessToken;
  }

  /**
   * Make authenticated request to eBay API
   */
  async request(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const token = await this.getAccessToken();

    const baseUrl = this.environment === 'production'
      ? 'https://svcs.ebay.com'
      : 'https://svcs.sandbox.ebay.com';

    const queryParams = new URLSearchParams({
      ...params,
      'OPERATION-NAME': params['OPERATION-NAME'] || 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': this.appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': '',
    });

    const url = `${baseUrl}/services/search/FindingService/v1?${queryParams}`;

    const response = await fetch(url, {
      headers: {
        'X-EBAY-SOA-SECURITY-TOKEN': token,
      },
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Search for completed (sold) items
   */
  async findCompletedItems(keywords: string, options: {
    minPrice?: number;
    maxPrice?: number;
    pageNumber?: number;
    entriesPerPage?: number;
    soldItemsOnly?: boolean;
  } = {}): Promise<any> {
    const {
      minPrice,
      maxPrice,
      pageNumber = 1,
      entriesPerPage = 100,
      soldItemsOnly = true,
    } = options;

    const itemFilters: any[] = [];

    // Filter for sold items only
    if (soldItemsOnly) {
      itemFilters.push({
        name: 'SoldItemsOnly',
        value: 'true',
      });
    }

    // Price range filter
    if (minPrice !== undefined) {
      itemFilters.push({
        name: 'MinPrice',
        value: minPrice.toString(),
      });
    }

    if (maxPrice !== undefined) {
      itemFilters.push({
        name: 'MaxPrice',
        value: maxPrice.toString(),
      });
    }

    // Add Pokemon category filter (183454 = Pokemon Trading Card Game)
    itemFilters.push({
      name: 'CategoryId',
      value: '183454',
    });

    const params: Record<string, string> = {
      'OPERATION-NAME': 'findCompletedItems',
      keywords,
      'paginationInput.pageNumber': pageNumber.toString(),
      'paginationInput.entriesPerPage': entriesPerPage.toString(),
      'sortOrder': 'EndTimeSoonest',
    };

    // Add item filters
    itemFilters.forEach((filter, index) => {
      params[`itemFilter(${index}).name`] = filter.name;
      params[`itemFilter(${index}).value`] = filter.value;
    });

    return await this.request('', params);
  }
}
