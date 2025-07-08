import { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { 
  JamfAPIError, 
  AuthenticationError, 
  ValidationError,
  ConfigurationError 
} from './utils/errors.js';
import { 
  createAxiosInstanceWithInterceptors, 
  createRateLimitedAxios,
  InterceptorOptions 
} from './utils/axios-interceptors.js';
import { 
  RetryableCircuitBreaker, 
  withRetry,
  getRetryConfig 
} from './utils/retry.js';

export interface JamfApiClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  readOnlyMode?: boolean;
  enableRetry?: boolean;
  enableRateLimiting?: boolean;
  enableCircuitBreaker?: boolean;
  interceptorOptions?: InterceptorOptions;
}

export interface JamfAuthToken {
  token: string;
  expires: Date;
}

// Reuse the same schemas from the original client
const ComputerSchema = z.object({
  id: z.string(),
  name: z.string(),
  udid: z.string(),
  serialNumber: z.string(),
  lastContactTime: z.string().optional(),
  lastReportDate: z.string().optional(),
  managementId: z.string().optional(),
  platform: z.string().optional(),
  osVersion: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  assetTag: z.string().optional(),
  modelIdentifier: z.string().optional(),
  mdmAccessRights: z.number().optional(),
  lastEnrolledDate: z.string().optional(),
  userApprovedMdm: z.boolean().optional(),
});

const ComputerDetailSchema = ComputerSchema.extend({
  general: z.object({
    name: z.string(),
    lastIpAddress: z.string().optional(),
    lastReportedIp: z.string().optional(),
    jamfBinaryVersion: z.string().optional(),
    platform: z.string().optional(),
    barcode1: z.string().optional(),
    barcode2: z.string().optional(),
    assetTag: z.string().optional(),
    remoteManagement: z.object({
      managed: z.boolean(),
      managementUsername: z.string().optional(),
    }).optional(),
    supervised: z.boolean().optional(),
    mdmCapable: z.object({
      capable: z.boolean(),
      capableUsers: z.array(z.string()),
    }).optional(),
  }).optional(),
  hardware: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    modelIdentifier: z.string().optional(),
    osName: z.string().optional(),
    osVersion: z.string().optional(),
    osBuild: z.string().optional(),
    processorSpeedMhz: z.number().optional(),
    processorCount: z.number().optional(),
    coreCount: z.number().optional(),
    processorType: z.string().optional(),
    processorArchitecture: z.string().optional(),
    busSpeedMhz: z.number().optional(),
    cacheSizeKilobytes: z.number().optional(),
    networkAdapterType: z.string().optional(),
    macAddress: z.string().optional(),
    altNetworkAdapterType: z.string().optional(),
    altMacAddress: z.string().optional(),
    totalRamMegabytes: z.number().optional(),
    openRamSlots: z.number().optional(),
    batteryCapacityPercent: z.number().optional(),
    smcVersion: z.string().optional(),
    nicSpeed: z.string().optional(),
    opticalDrive: z.string().optional(),
    bootRom: z.string().optional(),
    bleCapable: z.boolean().optional(),
    supportsIosAppInstalls: z.boolean().optional(),
    appleSilicon: z.boolean().optional(),
    extensionAttributes: z.array(z.any()).optional(),
  }).optional(),
  userAndLocation: z.object({
    username: z.string().optional(),
    realname: z.string().optional(),
    email: z.string().optional(),
    position: z.string().optional(),
    phone: z.string().optional(),
    departmentId: z.string().optional(),
    buildingId: z.string().optional(),
    room: z.string().optional(),
  }).optional(),
  storage: z.object({
    bootDriveAvailableSpaceMegabytes: z.number().optional(),
    disks: z.array(z.object({
      id: z.string(),
      device: z.string(),
      model: z.string().optional(),
      revision: z.string().optional(),
      serialNumber: z.string().optional(),
      sizeMegabytes: z.number(),
      smartStatus: z.string().optional(),
      type: z.string().optional(),
      partitions: z.array(z.object({
        name: z.string(),
        sizeMegabytes: z.number(),
        availableMegabytes: z.number(),
        partitionType: z.string(),
        percentUsed: z.number(),
        fileVault2State: z.string().optional(),
        fileVault2ProgressPercent: z.number().optional(),
        lvgUuid: z.string().optional(),
        lvUuid: z.string().optional(),
        pvUuid: z.string().optional(),
      })).optional(),
    })).optional(),
  }).optional(),
});

export type Computer = z.infer<typeof ComputerSchema>;
export type ComputerDetail = z.infer<typeof ComputerDetailSchema>;

/**
 * Enhanced Jamf API Client with retry, circuit breaker, and improved error handling
 */
export class JamfApiClientEnhanced {
  private axios: AxiosInstance;
  private authToken: JamfAuthToken | null = null;
  private readonly readOnlyMode: boolean;
  private circuitBreaker?: RetryableCircuitBreaker;
  private retryConfig = getRetryConfig();
  
  constructor(private config: JamfApiClientConfig) {
    // Validate configuration
    this.validateConfig(config);
    
    this.readOnlyMode = config.readOnlyMode || false;
    
    // Create axios instance with interceptors
    if (config.enableRateLimiting) {
      const { instance } = createRateLimitedAxios(
        {
          baseURL: config.baseUrl,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
        {
          minRequestInterval: 100,
          maxConcurrent: 5
        },
        config.interceptorOptions
      );
      this.axios = instance;
    } else {
      this.axios = createAxiosInstanceWithInterceptors(
        {
          baseURL: config.baseUrl,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        },
        config.interceptorOptions
      );
    }
    
    // Initialize circuit breaker if enabled
    if (config.enableCircuitBreaker) {
      this.circuitBreaker = new RetryableCircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 60 seconds
        halfOpenRequests: 3
      });
    }
    
    // Override authentication interceptor
    this.setupAuthenticationInterceptor();
  }

  private validateConfig(config: JamfApiClientConfig): void {
    if (!config.baseUrl) {
      throw new ConfigurationError('baseUrl is required', { config });
    }
    
    if (!config.clientId || !config.clientSecret) {
      throw new ConfigurationError('clientId and clientSecret are required for OAuth2 authentication', { config });
    }
    
    try {
      new URL(config.baseUrl);
    } catch {
      throw new ConfigurationError('Invalid baseUrl format', { baseUrl: config.baseUrl });
    }
  }

  private setupAuthenticationInterceptor(): void {
    // Clear default interceptors and add our custom ones
    (this.axios.interceptors.request as any).handlers = [];
    (this.axios.interceptors.response as any).handlers = [];
    
    // Add authentication to requests
    this.axios.interceptors.request.use(
      async (config) => {
        await this.ensureAuthenticated();
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Handle 401 responses
    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && !(error.config as any)?.isRetry) {
          this.authToken = null;
          
          try {
            await this.ensureAuthenticated();
            const originalRequest = error.config as InternalAxiosRequestConfig & { isRetry?: boolean };
            if (originalRequest && this.authToken) {
              const token = this.authToken as JamfAuthToken;
              originalRequest.headers.Authorization = `Bearer ${token.token}`;
              originalRequest.isRetry = true;
              return this.axios(originalRequest);
            }
          } catch (authError) {
            throw new AuthenticationError('Failed to re-authenticate after 401 response');
          }
        }
        
        throw error;
      }
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.authToken && this.authToken.expires > new Date()) {
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.config.clientId);
      params.append('client_secret', this.config.clientSecret);

      // Use a separate axios instance for auth to avoid circular dependencies
      const authResponse = await createAxiosInstanceWithInterceptors({
        baseURL: this.config.baseUrl,
        timeout: 10000,
      }).post('/api/oauth/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const expiresIn = authResponse.data.expires_in 
        ? authResponse.data.expires_in * 1000 
        : 20 * 60 * 1000; // Default to 20 minutes
      
      this.authToken = {
        token: authResponse.data.access_token,
        expires: new Date(Date.now() + expiresIn - 60000), // Subtract 1 minute for safety
      };
      
      if (this.retryConfig.debugMode) {
        console.error('[Auth] Successfully authenticated, token expires at:', this.authToken.expires);
      }
    } catch (error) {
      throw new AuthenticationError(
        `Failed to authenticate with Jamf Pro API: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { clientId: this.config.clientId }
      );
    }
  }

  /**
   * Execute API request with circuit breaker if enabled
   */
  private async executeRequest<T>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    if (this.circuitBreaker) {
      return this.circuitBreaker.executeWithRetry(key, requestFn);
    }
    
    return this.config.enableRetry !== false 
      ? withRetry(requestFn)()
      : requestFn();
  }

  async keepAlive(): Promise<void> {
    this.authToken = null;
    await this.ensureAuthenticated();
  }

  async searchComputers(query: string, limit: number = 100): Promise<Computer[]> {
    return this.executeRequest('searchComputers', async () => {
      try {
        const response = await this.axios.get('/api/v1/computers-inventory', {
          params: {
            'page-size': limit,
            'filter': query ? `general.name=="*${query}*",general.lastReportedIp=="*${query}*",general.serialNumber=="*${query}*",general.udid=="*${query}*",general.macAddress=="*${query}*",userAndLocation.username=="*${query}*",userAndLocation.email=="*${query}*"` : undefined,
          },
        });

        return response.data.results.map((computer: any) => {
          try {
            return ComputerSchema.parse(computer);
          } catch (parseError) {
            const fieldErrors = parseError instanceof z.ZodError 
              ? { computer: parseError.errors.map(e => e.message) }
              : undefined;
            throw new ValidationError(
              'Failed to parse computer data from API response',
              fieldErrors
            );
          }
        });
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { query, limit });
      }
    });
  }

  async getComputerDetails(id: string): Promise<ComputerDetail> {
    return this.executeRequest(`getComputerDetails-${id}`, async () => {
      try {
        const response = await this.axios.get(`/api/v1/computers-inventory-detail/${id}`);
        
        try {
          return ComputerDetailSchema.parse(response.data);
        } catch (parseError) {
          const fieldErrors = parseError instanceof z.ZodError 
            ? { detail: parseError.errors.map(e => e.message) }
            : undefined;
          throw new ValidationError(
            'Failed to parse computer detail data from API response',
            fieldErrors
          );
        }
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { computerId: id });
      }
    });
  }

  async executePolicy(policyId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new JamfAPIError(
        'Cannot execute policies in read-only mode',
        403,
        'READ_ONLY_MODE',
        ['Disable read-only mode to execute policies']
      );
    }

    return this.executeRequest(`executePolicy-${policyId}`, async () => {
      try {
        for (const deviceId of deviceIds) {
          await this.axios.post(`/api/v1/policies/${policyId}/retry/${deviceId}`);
        }
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { policyId, deviceIds });
      }
    });
  }

  async deployScript(scriptId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new JamfAPIError(
        'Cannot deploy scripts in read-only mode',
        403,
        'READ_ONLY_MODE',
        ['Disable read-only mode to deploy scripts']
      );
    }

    return this.executeRequest(`deployScript-${scriptId}`, async () => {
      try {
        for (const deviceId of deviceIds) {
          await this.axios.post(`/api/v1/scripts/${scriptId}/run`, {
            computerIds: [deviceId],
          });
        }
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { scriptId, deviceIds });
      }
    });
  }

  async updateInventory(deviceId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new JamfAPIError(
        'Cannot update inventory in read-only mode',
        403,
        'READ_ONLY_MODE',
        ['Disable read-only mode to update inventory']
      );
    }

    return this.executeRequest(`updateInventory-${deviceId}`, async () => {
      try {
        await this.axios.post(`/api/v1/computers-inventory/${deviceId}/update-inventory`);
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { deviceId });
      }
    });
  }

  async getScriptDetails(scriptId: string): Promise<any> {
    return this.executeRequest(`getScriptDetails-${scriptId}`, async () => {
      try {
        const response = await this.axios.get(`/api/v1/scripts/${scriptId}`);
        return response.data;
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { scriptId });
      }
    });
  }

  async getComplianceReport(days: number = 30): Promise<any> {
    return this.executeRequest('getComplianceReport', async () => {
      try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        const response = await this.axios.get('/api/v1/computers-inventory', {
          params: {
            'page-size': 1000,
            'sort': 'general.lastContactTime:desc',
          },
        });

        const computers = response.data.results;
        const compliance = {
          total: computers.length,
          compliant: 0,
          nonCompliant: 0,
          notReporting: 0,
          issues: [] as any[],
        };

        for (const computer of computers) {
          const lastContact = computer.general?.lastContactTime ? new Date(computer.general.lastContactTime) : null;
          
          if (!lastContact || lastContact < cutoffDate) {
            compliance.notReporting++;
            compliance.issues.push({
              computerId: computer.id,
              computerName: computer.general?.name || 'Unknown',
              issue: 'Not reporting',
              lastContact: lastContact?.toISOString() || 'Never',
            });
          } else {
            compliance.compliant++;
          }
        }

        compliance.nonCompliant = compliance.total - compliance.compliant;

        return compliance;
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { days });
      }
    });
  }

  // Include all other methods from the original client with enhanced error handling...
  async listPackages(limit: number = 100): Promise<any[]> {
    return this.executeRequest('listPackages', async () => {
      try {
        const response = await this.axios.get('/api/v1/packages', {
          params: {
            'page-size': limit,
          },
        });
        return response.data.results || [];
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { limit });
      }
    });
  }

  async getPackageDetails(packageId: string): Promise<any> {
    return this.executeRequest(`getPackageDetails-${packageId}`, async () => {
      try {
        const response = await this.axios.get(`/api/v1/packages/${packageId}`);
        return response.data;
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { packageId });
      }
    });
  }

  async searchPackages(query: string, limit: number = 100): Promise<any[]> {
    return this.executeRequest('searchPackages', async () => {
      try {
        const response = await this.axios.get('/api/v1/packages', {
          params: {
            'page-size': 1000,
          },
        });
        
        const packages = response.data.results || [];
        if (!query) {
          return packages.slice(0, limit);
        }
        
        const lowerQuery = query.toLowerCase();
        const filtered = packages.filter((p: any) => 
          p.fileName?.toLowerCase().includes(lowerQuery) ||
          p.name?.toLowerCase().includes(lowerQuery) ||
          p.category?.toLowerCase().includes(lowerQuery)
        );
        
        return filtered.slice(0, limit);
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { query, limit });
      }
    });
  }

  async searchMobileDevices(query: string, limit: number = 100): Promise<any[]> {
    return this.executeRequest('searchMobileDevices', async () => {
      try {
        const response = await this.axios.get('/api/v2/mobile-devices', {
          params: {
            'page-size': limit,
            'filter': query ? `name=="*${query}*",serialNumber=="*${query}*",udid=="*${query}*"` : undefined,
          },
        });
        
        return response.data.results || [];
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { query, limit });
      }
    });
  }

  async getMobileDeviceDetails(deviceId: string): Promise<any> {
    return this.executeRequest(`getMobileDeviceDetails-${deviceId}`, async () => {
      try {
        const response = await this.axios.get(`/api/v2/mobile-devices/${deviceId}/detail`);
        return response.data;
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { deviceId });
      }
    });
  }

  async updateMobileDeviceInventory(deviceId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new JamfAPIError(
        'Cannot update mobile device inventory in read-only mode',
        403,
        'READ_ONLY_MODE',
        ['Disable read-only mode to update mobile device inventory']
      );
    }
    
    return this.executeRequest(`updateMobileDeviceInventory-${deviceId}`, async () => {
      try {
        await this.axios.post(`/api/v2/mobile-devices/${deviceId}/update-inventory`);
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { deviceId });
      }
    });
  }

  async sendMDMCommand(deviceId: string, command: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new JamfAPIError(
        'Cannot send MDM commands in read-only mode',
        403,
        'READ_ONLY_MODE',
        ['Disable read-only mode to send MDM commands']
      );
    }
    
    const validCommands = [
      'DeviceLock', 'EraseDevice', 'ClearPasscode', 'RestartDevice',
      'ShutDownDevice', 'EnableLostMode', 'DisableLostMode', 'PlayLostModeSound',
      'UpdateInventory', 'ClearRestrictionsPassword', 'SettingsEnableBluetooth',
      'SettingsDisableBluetooth', 'SettingsEnableWiFi', 'SettingsDisableWiFi',
      'SettingsEnableDataRoaming', 'SettingsDisableDataRoaming',
      'SettingsEnableVoiceRoaming', 'SettingsDisableVoiceRoaming',
      'SettingsEnablePersonalHotspot', 'SettingsDisablePersonalHotspot'
    ];
    
    if (!validCommands.includes(command)) {
      throw new ValidationError(
        `Invalid MDM command: ${command}`,
        { command: [`Must be one of: ${validCommands.join(', ')}`] }
      );
    }
    
    return this.executeRequest(`sendMDMCommand-${deviceId}`, async () => {
      try {
        if (command === 'DeviceLock') {
          await this.axios.post(`/api/v2/mobile-devices/${deviceId}/lock`);
        } else if (command === 'EraseDevice') {
          await this.axios.post(`/api/v2/mobile-devices/${deviceId}/erase`);
        } else if (command === 'ClearPasscode') {
          await this.axios.post(`/api/v2/mobile-devices/${deviceId}/clear-passcode`);
        } else {
          await this.axios.post(`/api/v2/mobile-devices/${deviceId}/commands`, {
            commandType: command,
          });
        }
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { deviceId, command });
      }
    });
  }

  async getMobileDeviceGroups(type: 'smart' | 'static' | 'all' = 'all'): Promise<any[]> {
    return this.executeRequest('getMobileDeviceGroups', async () => {
      try {
        const response = await this.axios.get('/api/v1/mobile-device-groups', {
          params: {
            'page-size': 1000,
          },
        });
        
        let groups = response.data.results || [];
        
        if (type !== 'all') {
          groups = groups.filter((g: any) => g.isSmart === (type === 'smart'));
        }
        
        return groups;
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { type });
      }
    });
  }

  async getMobileDeviceGroupDetails(groupId: string): Promise<any> {
    return this.executeRequest(`getMobileDeviceGroupDetails-${groupId}`, async () => {
      try {
        const response = await this.axios.get(`/api/v1/mobile-device-groups/${groupId}`);
        return response.data;
      } catch (error) {
        if (error instanceof JamfAPIError) throw error;
        throw JamfAPIError.fromAxiosError(error as AxiosError, { groupId });
      }
    });
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getCircuitBreakerStatus(): Record<string, any> | undefined {
    if (!this.circuitBreaker) return undefined;
    
    return {
      enabled: true,
      // Add more status info as needed
    };
  }
}