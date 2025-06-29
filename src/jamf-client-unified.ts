import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import https from 'https';

export interface JamfApiClientConfig {
  baseUrl: string;
  // OAuth2 credentials (for Modern API)
  clientId?: string;
  clientSecret?: string;
  // Basic Auth credentials (for Classic API)
  username?: string;
  password?: string;
  readOnlyMode?: boolean;
}

export interface JamfAuthToken {
  token: string;
  expires: Date;
}

// Computer schemas
const ComputerSchema = z.object({
  id: z.string(),
  name: z.string(),
  udid: z.string(),
  serialNumber: z.string(),
  lastContactTime: z.string().optional(),
  lastReportDate: z.string().optional(),
  osVersion: z.string().optional(),
  ipAddress: z.string().optional(),
  macAddress: z.string().optional(),
  assetTag: z.string().optional(),
  modelIdentifier: z.string().optional(),
});

const ComputerDetailSchema = ComputerSchema.extend({
  general: z.object({
    name: z.string(),
    lastIpAddress: z.string().optional(),
    platform: z.string().optional(),
    assetTag: z.string().optional(),
    remoteManagement: z.object({
      managed: z.boolean(),
      managementUsername: z.string().optional(),
    }).optional(),
    supervised: z.boolean().optional(),
  }).optional(),
  hardware: z.object({
    model: z.string().optional(),
    modelIdentifier: z.string().optional(),
    osVersion: z.string().optional(),
    processorType: z.string().optional(),
    totalRamMegabytes: z.number().optional(),
    batteryCapacityPercent: z.number().optional(),
    appleSilicon: z.boolean().optional(),
  }).optional(),
  userAndLocation: z.object({
    username: z.string().optional(),
    realname: z.string().optional(),
    email: z.string().optional(),
    position: z.string().optional(),
    departmentId: z.string().optional(),
    buildingId: z.string().optional(),
  }).optional(),
  storage: z.object({
    bootDriveAvailableSpaceMegabytes: z.number().optional(),
    disks: z.array(z.object({
      id: z.string(),
      device: z.string(),
      model: z.string().optional(),
      sizeMegabytes: z.number(),
      partitions: z.array(z.object({
        name: z.string(),
        sizeMegabytes: z.number(),
        availableMegabytes: z.number(),
        percentUsed: z.number(),
        fileVault2State: z.string().optional(),
        partitionType: z.string().optional(),
      })).optional(),
    })).optional(),
  }).optional(),
});

export type Computer = z.infer<typeof ComputerSchema>;
export type ComputerDetail = z.infer<typeof ComputerDetailSchema>;

/**
 * Unified Jamf API Client that supports both Modern (OAuth2) and Classic (Basic Auth) APIs
 */
export class JamfApiClientUnified {
  private modernAxios: AxiosInstance | null = null;
  private classicAxios: AxiosInstance | null = null;
  private authToken: JamfAuthToken | null = null;
  private readOnlyMode: boolean;
  private config: JamfApiClientConfig;
  
  // Capabilities flags
  private hasOAuth2: boolean;
  private hasBasicAuth: boolean;
  private modernApiAvailable: boolean | null = null;
  private classicApiAvailable: boolean | null = null;
  
  // Cache
  private cachedSearchData: Map<string, any> = new Map();
  private cachedSearchId: number | null = null;

  constructor(config: JamfApiClientConfig) {
    this.config = config;
    this.readOnlyMode = config.readOnlyMode ?? false;
    
    // Check available auth methods
    this.hasOAuth2 = !!(config.clientId && config.clientSecret);
    this.hasBasicAuth = !!(config.username && config.password);
    
    if (!this.hasOAuth2 && !this.hasBasicAuth) {
      throw new Error('No authentication credentials provided. Need either OAuth2 (clientId/clientSecret) or Basic Auth (username/password)');
    }
    
    // Initialize axios instances
    if (this.hasOAuth2) {
      this.modernAxios = axios.create({
        baseURL: config.baseUrl,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      this.setupModernInterceptors();
    }
    
    if (this.hasBasicAuth) {
      this.classicAxios = axios.create({
        baseURL: config.baseUrl,
        auth: {
          username: config.username!,
          password: config.password!,
        },
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: 10000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
    }
    
    console.log(`Jamf Unified Client initialized with:`);
    console.log(`  - OAuth2 (Modern API): ${this.hasOAuth2 ? 'Available' : 'Not configured'}`);
    console.log(`  - Basic Auth (Classic API): ${this.hasBasicAuth ? 'Available' : 'Not configured'}`);
  }

  private setupModernInterceptors(): void {
    if (!this.modernAxios) return;
    
    this.modernAxios.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        await this.ensureOAuth2Authenticated();
        if (this.authToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.authToken.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.modernAxios.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401 && this.modernAxios) {
          this.authToken = null;
          await this.ensureOAuth2Authenticated();
          const originalRequest = error.config as InternalAxiosRequestConfig | undefined;
          if (originalRequest && this.authToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${(this.authToken as JamfAuthToken).token}`;
            return this.modernAxios(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async ensureOAuth2Authenticated(): Promise<void> {
    if (!this.hasOAuth2) return;
    
    if (this.authToken && this.authToken.expires > new Date()) {
      return;
    }

    try {
      // Use URLSearchParams to properly encode the body
      const params = new URLSearchParams({
        'grant_type': 'client_credentials',
        'client_id': this.config.clientId!,
        'client_secret': this.config.clientSecret!
      });

      const response = await axios.post(
        `${this.config.baseUrl}/api/oauth/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }
      );

      const expiresIn = response.data.expires_in 
        ? response.data.expires_in * 1000 
        : 20 * 60 * 1000;
      
      this.authToken = {
        token: response.data.access_token,
        expires: new Date(Date.now() + expiresIn),
      };
    } catch (error: any) {
      console.error('OAuth2 authentication failed:', error.message);
      // Don't disable OAuth2 here - let checkApiAvailability handle it
    }
  }

  // Check which APIs are available
  private async checkApiAvailability(): Promise<void> {
    // Check Modern API
    if (this.modernApiAvailable === null && this.hasOAuth2) {
      try {
        await this.ensureOAuth2Authenticated();
        if (this.authToken && this.modernAxios) {
          await this.modernAxios.get('/api/v1/auth');
          this.modernApiAvailable = true;
          console.log('✅ Modern Jamf Pro API is available');
        } else {
          this.modernApiAvailable = false;
          console.log('⚠️ Modern API auth failed (invalid credentials)');
        }
      } catch (error: any) {
        this.modernApiAvailable = false;
        console.log('⚠️ Modern API not available:', error.message);
      }
    }
    
    // Check Classic API
    if (this.classicApiAvailable === null && this.classicAxios) {
      try {
        await this.classicAxios.get('/JSSResource/categories');
        this.classicApiAvailable = true;
        console.log('✅ Classic Jamf API is available');
      } catch (error: any) {
        this.classicApiAvailable = false;
        console.log('⚠️ Classic API not available:', error.message);
      }
    }
    
    // If neither API is available, use Advanced Search as fallback
    if (!this.modernApiAvailable && !this.classicApiAvailable) {
      console.log('⚠️ Neither API authenticated successfully');
      if (this.hasOAuth2 || this.hasBasicAuth) {
        console.log('🔄 Will use Advanced Search as fallback for computer operations');
      } else {
        throw new Error('No working authentication method available');
      }
    }
  }

  async keepAlive(): Promise<void> {
    if (this.hasOAuth2) {
      this.authToken = null;
      await this.ensureOAuth2Authenticated();
    }
    // Basic Auth doesn't need keep-alive
  }

  // Transform Classic API computer to standard format
  private transformClassicComputer(classicComputer: any): Computer {
    return {
      id: String(classicComputer.id),
      name: classicComputer.name || '',
      udid: classicComputer.udid || '',
      serialNumber: classicComputer.serial_number || '',
      lastContactTime: classicComputer.last_contact_time,
      lastReportDate: classicComputer.report_date,
      osVersion: classicComputer.os_version,
      ipAddress: classicComputer.ip_address,
      macAddress: classicComputer.mac_address,
      assetTag: classicComputer.asset_tag,
      modelIdentifier: classicComputer.model_identifier,
    };
  }

  // Transform Modern API computer to standard format
  private transformModernComputer(modernComputer: any): Computer {
    return {
      id: modernComputer.id,
      name: modernComputer.general?.name || '',
      udid: modernComputer.general?.udid || '',
      serialNumber: modernComputer.general?.serialNumber || '',
      lastContactTime: modernComputer.general?.lastContactTime,
      lastReportDate: modernComputer.general?.lastReportDate,
      osVersion: modernComputer.operatingSystem?.version,
      ipAddress: modernComputer.general?.lastIpAddress,
      macAddress: modernComputer.general?.macAddress,
      assetTag: modernComputer.general?.assetTag,
      modelIdentifier: modernComputer.hardware?.modelIdentifier,
    };
  }

  async searchComputers(query: string, limit: number = 100): Promise<Computer[]> {
    await this.checkApiAvailability();
    
    // Try Modern API first if available
    if (this.modernApiAvailable && this.modernAxios) {
      try {
        console.log('Searching computers using Modern API...');
        const response = await this.modernAxios.get('/api/v1/computers-inventory', {
          params: {
            'page-size': limit,
            'filter': query ? `general.name=="*${query}*",general.lastReportedIp=="*${query}*",general.serialNumber=="*${query}*"` : undefined,
          },
        });
        return response.data.results.map((computer: any) => this.transformModernComputer(computer));
      } catch (error) {
        console.error('Modern API search failed, trying Classic API...', error);
      }
    }
    
    // Try Classic API
    if (this.classicApiAvailable && this.classicAxios) {
      try {
        console.log('Searching computers using Classic API...');
        if (query) {
          // Classic API search
          const response = await this.classicAxios.get(`/JSSResource/computers/match/*${query}*`);
          const computers = response.data.computers || [];
          return computers.slice(0, limit).map((c: any) => this.transformClassicComputer(c));
        } else {
          // Get all computers
          const response = await this.classicAxios.get('/JSSResource/computers');
          const computers = response.data.computers || [];
          return computers.slice(0, limit).map((c: any) => this.transformClassicComputer(c));
        }
      } catch (error) {
        console.error('Classic API search failed:', error);
      }
    }
    
    // Fallback to Advanced Search if both fail
    console.log('Falling back to Advanced Search...');
    return this.searchComputersViaAdvancedSearch(query, limit);
  }

  // Advanced Search fallback (similar to previous implementation)
  private async searchComputersViaAdvancedSearch(query: string, limit: number): Promise<Computer[]> {
    const searchId = await this.findBestAdvancedSearch();
    
    // Try to use whichever axios instance is available, preferring OAuth2 if Classic fails
    let response;
    let lastError;
    
    // Try Classic API first if available
    if (this.classicAxios) {
      try {
        response = await this.classicAxios.get(`/JSSResource/advancedcomputersearches/id/${searchId}`);
      } catch (error: any) {
        lastError = error;
        console.log('Classic API failed for Advanced Search, trying OAuth2...');
      }
    }
    
    // If Classic failed or not available, try OAuth2
    if (!response && this.modernAxios) {
      try {
        await this.ensureOAuth2Authenticated();
        response = await this.modernAxios.get(`/JSSResource/advancedcomputersearches/id/${searchId}`);
      } catch (error: any) {
        lastError = error;
        console.error('OAuth2 also failed for Advanced Search');
      }
    }
    
    if (!response) {
      throw lastError || new Error('No API client available for Advanced Search');
    }
    
    const allComputers = response.data.advanced_computer_search?.computers || [];
    
    let filteredComputers = allComputers;
    if (query) {
      const lowerQuery = query.toLowerCase();
      filteredComputers = allComputers.filter((c: any) => {
        const searchableFields = [
          c.name, c.Computer_Name, c.Serial_Number, c.IP_Address
        ].filter(Boolean).map(f => f.toLowerCase());
        return searchableFields.some(field => field.includes(lowerQuery));
      });
    }
    
    return filteredComputers.slice(0, limit).map((c: any) => ({
      id: String(c.id),
      name: c.name || c.Computer_Name || '',
      udid: c.udid || '',
      serialNumber: c.Serial_Number || '',
      lastContactTime: c.Last_Check_in,
      lastReportDate: c.Last_Inventory_Update,
      osVersion: c.Operating_System_Version,
      ipAddress: c.IP_Address,
      macAddress: c.MAC_Address,
      assetTag: c.Asset_Tag,
      modelIdentifier: c.Model,
    }));
  }

  private async findBestAdvancedSearch(): Promise<number> {
    if (this.cachedSearchId) return this.cachedSearchId;
    
    // Try to use whichever axios instance is available, preferring OAuth2 if Classic fails
    let response;
    let lastError;
    
    // Try Classic API first if available
    if (this.classicAxios) {
      try {
        response = await this.classicAxios.get('/JSSResource/advancedcomputersearches');
      } catch (error: any) {
        lastError = error;
        console.log('Classic API failed for listing Advanced Searches, trying OAuth2...');
      }
    }
    
    // If Classic failed or not available, try OAuth2
    if (!response && this.modernAxios) {
      try {
        await this.ensureOAuth2Authenticated();
        response = await this.modernAxios.get('/JSSResource/advancedcomputersearches');
      } catch (error: any) {
        lastError = error;
        console.error('OAuth2 also failed for listing Advanced Searches');
      }
    }
    
    if (!response) {
      throw lastError || new Error('No API client available for listing Advanced Searches');
    }
    
    const searches = response.data.advanced_computer_searches || [];
    
    const candidateSearches = searches.filter((s: any) => 
      s.name.toLowerCase().includes('all') ||
      s.name.toLowerCase().includes('inventory') ||
      s.name.toLowerCase().includes('applications')
    );
    
    if (candidateSearches.length > 0) {
      this.cachedSearchId = Number(candidateSearches[0].id);
      console.log(`Using Advanced Search: "${candidateSearches[0].name}" (ID: ${this.cachedSearchId})`);
      return this.cachedSearchId;
    }
    
    // If no good candidates, just use the first available search
    if (searches.length > 0) {
      this.cachedSearchId = Number(searches[0].id);
      console.log(`Using first available Advanced Search: "${searches[0].name}" (ID: ${this.cachedSearchId})`);
      return this.cachedSearchId;
    }
    
    throw new Error('No advanced searches found');
  }

  async getComputerDetails(id: string): Promise<ComputerDetail> {
    await this.checkApiAvailability();
    
    // Try Modern API first
    if (this.modernApiAvailable && this.modernAxios) {
      try {
        console.log(`Getting computer details for ${id} using Modern API...`);
        const response = await this.modernAxios.get(`/api/v1/computers-inventory-detail/${id}`);
        return ComputerDetailSchema.parse(response.data);
      } catch (error) {
        console.error('Modern API details failed, trying Classic API...', error);
      }
    }
    
    // Try Classic API
    if (this.classicApiAvailable && this.classicAxios) {
      try {
        console.log(`Getting computer details for ${id} using Classic API...`);
        const response = await this.classicAxios.get(`/JSSResource/computers/id/${id}`);
        const computer = response.data.computer;
        
        // Transform classic response to match expected format
        return {
          id: String(computer.general?.id || id),
          name: computer.general?.name || '',
          udid: computer.general?.udid || '',
          serialNumber: computer.general?.serial_number || '',
          lastContactTime: computer.general?.last_contact_time,
          lastReportDate: computer.general?.report_date,
          osVersion: computer.hardware?.os_version,
          ipAddress: computer.general?.ip_address,
          macAddress: computer.general?.mac_address,
          assetTag: computer.general?.asset_tag,
          modelIdentifier: computer.hardware?.model_identifier,
          general: {
            name: computer.general?.name || '',
            lastIpAddress: computer.general?.ip_address,
            platform: computer.hardware?.os_name,
            assetTag: computer.general?.asset_tag,
            remoteManagement: computer.general?.remote_management ? {
              managed: computer.general.remote_management.managed === 'true',
              managementUsername: computer.general.remote_management.management_username,
            } : undefined,
            supervised: computer.general?.supervised === 'true',
          },
          hardware: {
            model: computer.hardware?.model,
            modelIdentifier: computer.hardware?.model_identifier,
            osVersion: computer.hardware?.os_version,
            processorType: computer.hardware?.processor_type,
            totalRamMegabytes: computer.hardware?.total_ram,
            batteryCapacityPercent: computer.hardware?.battery_capacity,
            appleSilicon: computer.hardware?.is_apple_silicon === 'true',
          },
          userAndLocation: computer.location ? {
            username: computer.location.username,
            realname: computer.location.real_name,
            email: computer.location.email_address,
            position: computer.location.position,
            departmentId: computer.location.department,
            buildingId: computer.location.building,
          } : undefined,
          storage: computer.hardware?.storage ? {
            bootDriveAvailableSpaceMegabytes: computer.hardware.boot_drive_available_mb,
            disks: computer.hardware.storage.map((disk: any) => ({
              id: disk.disk?.id || '0',
              device: disk.disk?.device || 'Unknown',
              model: disk.disk?.model,
              sizeMegabytes: disk.disk?.size || 0,
              partitions: disk.disk?.partitions?.map((p: any) => ({
                name: p.name,
                sizeMegabytes: p.size || 0,
                availableMegabytes: p.available || 0,
                percentUsed: p.percentage_full || 0,
                fileVault2State: p.filevault2_status,
                partitionType: p.type,
              })),
            })),
          } : undefined,
        };
      } catch (error) {
        console.error('Classic API details failed:', error);
      }
    }
    
    throw new Error(`Unable to get details for computer ${id}`);
  }

  async getAllComputers(limit: number = 1000): Promise<any[]> {
    const computers = await this.searchComputers('', limit);
    return computers.map(c => ({
      id: c.id,
      name: c.name,
      general: {
        name: c.name,
        serial_number: c.serialNumber,
        last_contact_time: c.lastContactTime,
        last_contact_time_utc: c.lastContactTime,
      }
    }));
  }

  async executePolicy(policyId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot execute policies in read-only mode');
    }

    // Policy execution typically uses Modern API
    if (!this.modernApiAvailable || !this.modernAxios) {
      throw new Error('Policy execution requires Modern API access');
    }

    try {
      for (const deviceId of deviceIds) {
        await this.modernAxios.post(`/api/v1/policies/${policyId}/retry/${deviceId}`);
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

    // Script deployment typically uses Modern API
    if (!this.modernApiAvailable || !this.modernAxios) {
      throw new Error('Script deployment requires Modern API access');
    }

    try {
      for (const deviceId of deviceIds) {
        await this.modernAxios.post(`/api/v1/scripts/${scriptId}/run`, {
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

    // Try Modern API first
    if (this.modernApiAvailable && this.modernAxios) {
      try {
        await this.modernAxios.post(`/api/v1/computers/${deviceId}/inventory-update`);
        return;
      } catch (error) {
        console.error('Modern API inventory update failed:', error);
      }
    }

    // Try Classic API
    if (this.classicApiAvailable && this.classicAxios) {
      try {
        await this.classicAxios.put(`/JSSResource/computers/id/${deviceId}`, {
          computer: {
            general: {
              remote_management: {
                management_command: 'update_inventory'
              }
            }
          }
        });
        return;
      } catch (error) {
        console.error('Classic API inventory update failed:', error);
      }
    }

    throw new Error('Unable to update inventory - no API access');
  }
}