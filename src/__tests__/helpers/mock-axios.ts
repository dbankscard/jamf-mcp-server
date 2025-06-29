import { jest } from '@jest/globals';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { mockAuthTokenResponse } from '../fixtures/auth-responses';

export interface MockAxiosOptions {
  baseURL?: string;
  defaultHeaders?: Record<string, string>;
  autoAuth?: boolean;
}

export interface MockRequest {
  method: string;
  url: string;
  data?: any;
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

export interface MockResponse {
  status: number;
  data: any;
  headers?: Record<string, string>;
}

export class MockAxiosAdapter {
  private mockResponses: Map<string, MockResponse | ((req: MockRequest) => MockResponse)> = new Map();
  private requestHistory: MockRequest[] = [];
  private authToken: string | null = null;

  constructor(private options: MockAxiosOptions = {}) {
    if (options.autoAuth) {
      this.setupDefaultAuthMocks();
    }
  }

  private setupDefaultAuthMocks() {
    // Mock authentication endpoint
    this.mockResponses.set('POST /api/v1/auth/token', {
      status: 200,
      data: mockAuthTokenResponse
    });

    // Mock keep-alive endpoint
    this.mockResponses.set('POST /api/v1/auth/keep-alive', {
      status: 200,
      data: { message: 'Token extended successfully' }
    });
  }

  public addMockResponse(method: string, url: string, response: MockResponse | ((req: MockRequest) => MockResponse)) {
    const key = `${method.toUpperCase()} ${url}`;
    this.mockResponses.set(key, response);
  }

  public getRequestHistory(): MockRequest[] {
    return [...this.requestHistory];
  }

  public clearHistory() {
    this.requestHistory = [];
  }

  public reset() {
    this.mockResponses.clear();
    this.requestHistory = [];
    this.authToken = null;
    if (this.options.autoAuth) {
      this.setupDefaultAuthMocks();
    }
  }

  public createMockAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      baseURL: this.options.baseURL || 'https://jamf.example.com',
      headers: this.options.defaultHeaders || {}
    });

    // Override the request method
    instance.request = jest.fn(async (config: AxiosRequestConfig): Promise<AxiosResponse> => {
      const method = config.method?.toUpperCase() || 'GET';
      const url = config.url || '';
      const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
      
      // Record the request
      const request: MockRequest = {
        method,
        url: fullUrl,
        data: config.data,
        headers: config.headers as Record<string, string>,
        params: config.params
      };
      this.requestHistory.push(request);

      // Check for auth header
      if (config.headers?.Authorization) {
        this.authToken = (config.headers.Authorization as string).replace('Bearer ', '');
      }

      // Find matching mock
      const key = `${method} ${url}`;
      const mockResponse = this.mockResponses.get(key);

      if (!mockResponse) {
        throw new Error(`No mock response configured for ${key}`);
      }

      // Get response (handle function or static response)
      const response = typeof mockResponse === 'function' ? mockResponse(request) : mockResponse;

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 10));

      // Return axios-like response
      return {
        data: response.data,
        status: response.status,
        statusText: this.getStatusText(response.status),
        headers: response.headers || {},
        config: config as any,
        request: {}
      };
    });

    // Set up convenience methods
    instance.get = jest.fn((url: string, config?: AxiosRequestConfig) => 
      instance.request({ ...config, method: 'GET', url }));
    
    instance.post = jest.fn((url: string, data?: any, config?: AxiosRequestConfig) => 
      instance.request({ ...config, method: 'POST', url, data }));
    
    instance.put = jest.fn((url: string, data?: any, config?: AxiosRequestConfig) => 
      instance.request({ ...config, method: 'PUT', url, data }));
    
    instance.delete = jest.fn((url: string, config?: AxiosRequestConfig) => 
      instance.request({ ...config, method: 'DELETE', url }));

    return instance;
  }

  private getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error'
    };
    return statusTexts[status] || 'Unknown';
  }

  // Helper methods for common scenarios
  public expectAuth(): void {
    const authRequest = this.requestHistory.find(req => 
      req.url.includes('/api/v1/auth/token') && req.method === 'POST'
    );
    expect(authRequest).toBeDefined();
  }

  public expectRequest(method: string, urlPattern: string | RegExp): MockRequest | undefined {
    return this.requestHistory.find(req => {
      const methodMatch = req.method === method.toUpperCase();
      const urlMatch = typeof urlPattern === 'string' 
        ? req.url.includes(urlPattern)
        : urlPattern.test(req.url);
      return methodMatch && urlMatch;
    });
  }

  public getLastRequest(): MockRequest | undefined {
    return this.requestHistory[this.requestHistory.length - 1];
  }
}

// Factory function to create a mocked axios instance
export function createMockAxios(options: MockAxiosOptions = {}): {
  axios: AxiosInstance;
  adapter: MockAxiosAdapter;
} {
  const adapter = new MockAxiosAdapter(options);
  const axiosInstance = adapter.createMockAxiosInstance();
  
  return {
    axios: axiosInstance,
    adapter
  };
}