import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';

export interface JamfApiClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  readOnlyMode?: boolean;
}

export interface JamfAuthToken {
  token: string;
  expires: Date;
}

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

export class JamfApiClient {
  private axios: AxiosInstance;
  private authToken: JamfAuthToken | null = null;
  private readonly readOnlyMode: boolean;

  constructor(private config: JamfApiClientConfig) {
    this.readOnlyMode = config.readOnlyMode || false;
    this.axios = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

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

    this.axios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.authToken = null;
          await this.ensureAuthenticated();
          const originalRequest = error.config as InternalAxiosRequestConfig | undefined;
          if (originalRequest && this.authToken) {
            const token = this.authToken as JamfAuthToken;
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token.token}`;
            return this.axios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.authToken && this.authToken.expires > new Date()) {
      return;
    }

    try {
      // Use OAuth2 client credentials flow
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_id', this.config.clientId);
      params.append('client_secret', this.config.clientSecret);

      const response = await axios.post(
        `${this.config.baseUrl}/api/oauth/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // OAuth2 tokens typically have expires_in field (in seconds)
      const expiresIn = response.data.expires_in 
        ? response.data.expires_in * 1000 
        : 20 * 60 * 1000; // Default to 20 minutes if not provided
      
      this.authToken = {
        token: response.data.access_token,
        expires: new Date(Date.now() + expiresIn),
      };
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Jamf Pro API using OAuth2');
    }
  }

  async keepAlive(): Promise<void> {
    // OAuth2 doesn't support keep-alive, must request new token
    // Force re-authentication by clearing current token
    this.authToken = null;
    await this.ensureAuthenticated();
  }

  async searchComputers(query: string, limit: number = 100): Promise<Computer[]> {
    try {
      const response = await this.axios.get('/api/v1/computers-inventory', {
        params: {
          'page-size': limit,
          'filter': query ? `general.name=="*${query}*",general.lastReportedIp=="*${query}*",general.serialNumber=="*${query}*",general.udid=="*${query}*",general.macAddress=="*${query}*",userAndLocation.username=="*${query}*",userAndLocation.email=="*${query}*"` : undefined,
        },
      });

      return response.data.results.map((computer: any) => ComputerSchema.parse(computer));
    } catch (error) {
      console.error('Failed to search computers:', error);
      throw error;
    }
  }

  async getComputerDetails(id: string): Promise<ComputerDetail> {
    try {
      const response = await this.axios.get(`/api/v1/computers-inventory-detail/${id}`);
      return ComputerDetailSchema.parse(response.data);
    } catch (error) {
      console.error(`Failed to get computer details for ${id}:`, error);
      throw error;
    }
  }

  async executePolicy(policyId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot execute policies in read-only mode');
    }

    try {
      for (const deviceId of deviceIds) {
        await this.axios.post(`/api/v1/policies/${policyId}/retry/${deviceId}`);
      }
    } catch (error) {
      console.error('Failed to execute policy:', error);
      throw error;
    }
  }

  async deployScript(scriptId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot deploy scripts in read-only mode');
    }

    try {
      for (const deviceId of deviceIds) {
        await this.axios.post(`/api/v1/scripts/${scriptId}/run`, {
          computerIds: [deviceId],
        });
      }
    } catch (error) {
      console.error('Failed to deploy script:', error);
      throw error;
    }
  }

  async updateInventory(deviceId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update inventory in read-only mode');
    }

    try {
      await this.axios.post(`/api/v1/computers-inventory/${deviceId}/update-inventory`);
    } catch (error) {
      console.error('Failed to update inventory:', error);
      throw error;
    }
  }

  async getScriptDetails(scriptId: string): Promise<any> {
    try {
      const response = await this.axios.get(`/api/v1/scripts/${scriptId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get script details for ${scriptId}:`, error);
      throw error;
    }
  }

  async getComplianceReport(days: number = 30): Promise<any> {
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
      console.error('Failed to generate compliance report:', error);
      throw error;
    }
  }

  /**
   * List all packages
   */
  async listPackages(limit: number = 100): Promise<any[]> {
    try {
      const response = await this.axios.get('/api/v1/packages', {
        params: {
          'page-size': limit,
        },
      });
      return response.data.results || [];
    } catch (error) {
      console.error('Failed to list packages:', error);
      throw error;
    }
  }

  /**
   * Get package details
   */
  async getPackageDetails(packageId: string): Promise<any> {
    try {
      const response = await this.axios.get(`/api/v1/packages/${packageId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get package details for ${packageId}:`, error);
      throw error;
    }
  }

  /**
   * Search packages by name
   */
  async searchPackages(query: string, limit: number = 100): Promise<any[]> {
    try {
      // Modern API doesn't have direct search, so get all and filter
      const response = await this.axios.get('/api/v1/packages', {
        params: {
          'page-size': 1000, // Get more to search through
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
      console.error('Failed to search packages:', error);
      throw error;
    }
  }

  /**
   * Get package deployment history
   */
  async getPackageDeploymentHistory(packageId: string): Promise<any> {
    try {
      // Package deployment history is typically tracked through policies
      // First get the package details to understand its usage
      const packageDetails = await this.getPackageDetails(packageId);
      
      // Modern API doesn't have a direct way to get policies using a package
      // This would typically require Classic API access
      return {
        package: {
          id: packageDetails.id,
          name: packageDetails.name || packageDetails.fileName,
          category: packageDetails.category,
          size: packageDetails.size,
        },
        deploymentInfo: {
          note: 'Deployment history requires Classic API access for policy information',
        },
      };
    } catch (error) {
      console.error('Failed to get package deployment history:', error);
      throw error;
    }
  }

  /**
   * Get policies using a specific package
   */
  async getPoliciesUsingPackage(packageId: string): Promise<any[]> {
    // Modern API doesn't have a direct way to get policies
    // This would typically require Classic API access
    console.warn('Getting policies using package requires Classic API access');
    return [];
  }

  /**
   * Search mobile devices
   */
  async searchMobileDevices(query: string, limit: number = 100): Promise<any[]> {
    try {
      const response = await this.axios.get('/api/v2/mobile-devices', {
        params: {
          'page-size': limit,
          'filter': query ? `name=="*${query}*",serialNumber=="*${query}*",udid=="*${query}*"` : undefined,
        },
      });
      
      return response.data.results || [];
    } catch (error) {
      console.error('Failed to search mobile devices:', error);
      throw error;
    }
  }

  /**
   * Get mobile device details
   */
  async getMobileDeviceDetails(deviceId: string): Promise<any> {
    try {
      const response = await this.axios.get(`/api/v2/mobile-devices/${deviceId}/detail`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get mobile device details for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * List all mobile devices
   */
  async listMobileDevices(limit: number = 100): Promise<any[]> {
    return this.searchMobileDevices('', limit);
  }

  /**
   * Update mobile device inventory
   */
  async updateMobileDeviceInventory(deviceId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update mobile device inventory in read-only mode');
    }
    
    try {
      await this.axios.post(`/api/v2/mobile-devices/${deviceId}/update-inventory`);
      console.error(`Mobile device inventory update requested for device ${deviceId}`);
    } catch (error) {
      console.error('Failed to update mobile device inventory:', error);
      throw error;
    }
  }

  /**
   * Send MDM command to mobile device
   */
  async sendMDMCommand(deviceId: string, command: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot send MDM commands in read-only mode');
    }
    
    // Validate command
    const validCommands = [
      'DeviceLock',
      'EraseDevice',
      'ClearPasscode',
      'RestartDevice',
      'ShutDownDevice',
      'EnableLostMode',
      'DisableLostMode',
      'PlayLostModeSound',
      'UpdateInventory',
      'ClearRestrictionsPassword',
      'SettingsEnableBluetooth',
      'SettingsDisableBluetooth',
      'SettingsEnableWiFi',
      'SettingsDisableWiFi',
      'SettingsEnableDataRoaming',
      'SettingsDisableDataRoaming',
      'SettingsEnableVoiceRoaming',
      'SettingsDisableVoiceRoaming',
      'SettingsEnablePersonalHotspot',
      'SettingsDisablePersonalHotspot'
    ];
    
    if (!validCommands.includes(command)) {
      throw new Error(`Invalid MDM command: ${command}. Valid commands are: ${validCommands.join(', ')}`);
    }
    
    try {
      // Modern API uses different endpoints for different commands
      if (command === 'DeviceLock') {
        await this.axios.post(`/api/v2/mobile-devices/${deviceId}/lock`);
      } else if (command === 'EraseDevice') {
        await this.axios.post(`/api/v2/mobile-devices/${deviceId}/erase`);
      } else if (command === 'ClearPasscode') {
        await this.axios.post(`/api/v2/mobile-devices/${deviceId}/clear-passcode`);
      } else {
        // Generic command endpoint
        await this.axios.post(`/api/v2/mobile-devices/${deviceId}/commands`, {
          commandType: command,
        });
      }
      
      console.error(`Successfully sent MDM command '${command}' to device ${deviceId}`);
    } catch (error) {
      console.error('Failed to send MDM command:', error);
      throw error;
    }
  }

  /**
   * List mobile device groups
   */
  async getMobileDeviceGroups(type: 'smart' | 'static' | 'all' = 'all'): Promise<any[]> {
    try {
      const response = await this.axios.get('/api/v1/mobile-device-groups', {
        params: {
          'page-size': 1000,
        },
      });
      
      let groups = response.data.results || [];
      
      // Filter by type if requested
      if (type !== 'all') {
        groups = groups.filter((g: any) => g.isSmart === (type === 'smart'));
      }
      
      return groups;
    } catch (error) {
      console.error('Failed to list mobile device groups:', error);
      throw error;
    }
  }

  /**
   * Get mobile device group details
   */
  async getMobileDeviceGroupDetails(groupId: string): Promise<any> {
    try {
      const response = await this.axios.get(`/api/v1/mobile-device-groups/${groupId}`);
      return response.data;
    } catch (error) {
      console.error(`Failed to get mobile device group details for ${groupId}:`, error);
      throw error;
    }
  }
}