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

// Schema for computers returned by Advanced Search
const AdvancedSearchComputerSchema = z.object({
  id: z.number(),
  name: z.string(),
  udid: z.string().optional(),
  Computer_Name: z.string().optional(),
  Serial_Number: z.string().optional(),
  Last_Check_in: z.string().optional(),
  Last_Inventory_Update: z.string().optional(),
  Last_Enrollment: z.string().optional(),
  Operating_System_Version: z.string().optional(),
  IP_Address: z.string().optional(),
  Model: z.string().optional(),
  Full_Name: z.string().optional(),
  Building: z.string().optional(),
  Department: z.string().optional(),
  Asset_Tag: z.string().optional(),
  Managed: z.string().optional(),
}).passthrough();

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

export class JamfApiClientAdvancedSearch {
  private axios: AxiosInstance;
  private authToken: JamfAuthToken | null = null;
  private readOnlyMode: boolean;
  private config: JamfApiClientConfig;
  private cachedSearchId: number | null = null;
  private classicApiAvailable: boolean | null = false; // Default to false for OAuth2 clients
  private cachedSearchData: Map<string, any> = new Map();

  constructor(config: JamfApiClientConfig) {
    this.config = config;
    this.readOnlyMode = config.readOnlyMode ?? false;
    
    this.axios = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10 second timeout
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.axios.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        await this.ensureAuthenticated();
        if (this.authToken && config.headers) {
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

      const expiresIn = response.data.expires_in 
        ? response.data.expires_in * 1000 
        : 20 * 60 * 1000;
      
      this.authToken = {
        token: response.data.access_token,
        expires: new Date(Date.now() + expiresIn),
      };
    } catch (error) {
      console.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Jamf Pro API using OAuth2');
    }
  }

  // Check if Classic API is available (cached)
  private async checkClassicApiAvailability(): Promise<boolean> {
    if (this.classicApiAvailable !== null) {
      return this.classicApiAvailable;
    }

    try {
      // Try a simple Classic API call with very short timeout
      await this.axios.get('/JSSResource/categories', { 
        timeout: 2000,
        validateStatus: (status) => status < 500 // Don't throw on 4xx
      });
      this.classicApiAvailable = true;
      console.log('Classic API is available');
    } catch (error: any) {
      // Any error means Classic API is not available
      this.classicApiAvailable = false;
      console.log('Classic API is not available');
    }

    return this.classicApiAvailable;
  }

  async keepAlive(): Promise<void> {
    this.authToken = null;
    await this.ensureAuthenticated();
  }

  // Find the best advanced search for general computer inventory
  private async findBestAdvancedSearch(): Promise<number> {
    if (this.cachedSearchId) {
      return this.cachedSearchId;
    }

    try {
      const response = await this.axios.get('/JSSResource/advancedcomputersearches');
      const searches = response.data.advanced_computer_searches || [];
      
      // Look for searches that seem to return all computers
      const candidateSearches = searches.filter((s: any) => 
        s.name.toLowerCase().includes('all') ||
        s.name.toLowerCase().includes('inventory') ||
        s.name.toLowerCase().includes('compliance') ||
        s.name.toLowerCase().includes('applications')
      );

      if (candidateSearches.length > 0) {
        this.cachedSearchId = Number(candidateSearches[0].id);
        console.log(`Using advanced search: "${candidateSearches[0].name}" (ID: ${this.cachedSearchId})`);
        return this.cachedSearchId;
      }

      // Otherwise, check each search to find one with the most computers
      let bestSearchId: number | null = null;
      let maxComputers = 0;

      for (const search of searches.slice(0, 10)) {
        try {
          const detailResponse = await this.axios.get(`/JSSResource/advancedcomputersearches/id/${search.id}`);
          const computerCount = detailResponse.data.advanced_computer_search?.computers?.length || 0;
          
          if (computerCount > maxComputers) {
            maxComputers = computerCount;
            bestSearchId = search.id;
          }
        } catch (error) {
          // Skip searches we can't access
        }
      }

      if (!bestSearchId) {
        throw new Error('No suitable advanced search found for computer inventory');
      }

      this.cachedSearchId = bestSearchId;
      return this.cachedSearchId;
    } catch (error) {
      console.error('Failed to find advanced search:', error);
      throw new Error('Unable to find a suitable advanced search for computer inventory');
    }
  }

  // Cache and get all computers from advanced search
  private async getCachedSearchData(): Promise<any[]> {
    const cacheKey = 'all_computers';
    const cached = this.cachedSearchData.get(cacheKey);
    
    // Cache for 5 minutes
    if (cached && cached.timestamp > Date.now() - 300000) {
      return cached.data;
    }

    const searchId = await this.findBestAdvancedSearch();
    const response = await this.axios.get(`/JSSResource/advancedcomputersearches/id/${searchId}`);
    const computers = response.data.advanced_computer_search?.computers || [];
    
    this.cachedSearchData.set(cacheKey, {
      data: computers,
      timestamp: Date.now()
    });

    return computers;
  }

  // Transform advanced search computer to standard format
  private transformComputer(advancedComputer: any): Computer {
    return {
      id: String(advancedComputer.id),
      name: advancedComputer.name || advancedComputer.Computer_Name || '',
      udid: advancedComputer.udid || '',
      serialNumber: advancedComputer.Serial_Number || advancedComputer.serial_number || '',
      lastContactTime: advancedComputer.Last_Check_in || advancedComputer.Last_Contact_Time,
      lastReportDate: advancedComputer.Last_Inventory_Update,
      osVersion: advancedComputer.Operating_System_Version || advancedComputer.OS_Version,
      ipAddress: advancedComputer.IP_Address || advancedComputer.ip_address,
      macAddress: advancedComputer.MAC_Address || advancedComputer.mac_address,
      assetTag: advancedComputer.Asset_Tag || advancedComputer.asset_tag,
      modelIdentifier: advancedComputer.Model || advancedComputer.model,
    };
  }

  async searchComputers(query: string, limit: number = 100): Promise<Computer[]> {
    try {
      const allComputers = await this.getCachedSearchData();
      
      // Filter computers based on query
      let filteredComputers = allComputers;
      if (query) {
        const lowerQuery = query.toLowerCase();
        filteredComputers = allComputers.filter((c: any) => {
          const searchableFields = [
            c.name,
            c.Computer_Name,
            c.Serial_Number,
            c.IP_Address,
            c.Full_Name,
            c.Department,
            c.Building,
            c.Asset_Tag,
            c.Model,
          ].filter(Boolean).map(f => f.toLowerCase());
          
          return searchableFields.some(field => field.includes(lowerQuery));
        });
      }

      // Apply limit and transform
      const limitedComputers = filteredComputers.slice(0, limit);
      return limitedComputers.map((c: any) => this.transformComputer(c));
    } catch (error) {
      console.error('Failed to search computers:', error);
      throw error;
    }
  }

  async getComputerDetails(id: string): Promise<ComputerDetail> {
    // First check if Classic API is available
    const hasClassicApi = await this.checkClassicApiAvailability();
    
    if (!hasClassicApi) {
      // Return limited details from advanced search cache
      console.log('Classic API not available, using cached advanced search data');
      const allComputers = await this.getCachedSearchData();
      const computer = allComputers.find((c: any) => String(c.id) === id);
      
      if (!computer) {
        throw new Error(`Computer ${id} not found`);
      }

      // Return minimal details from advanced search
      const transformed = this.transformComputer(computer);
      return {
        ...transformed,
        general: {
          name: transformed.name,
          lastIpAddress: transformed.ipAddress,
          last_contact_time: computer.Last_Check_in,
          last_contact_time_utc: computer.Last_Check_in,
          serial_number: transformed.serialNumber,
        },
        hardware: {
          model: computer.Model,
          osVersion: transformed.osVersion,
        },
        userAndLocation: {
          username: computer.Username,
          realname: computer.Full_Name,
        },
      } as any;
    }

    // Classic API is available, get full details
    try {
      const response = await this.axios.get(`/JSSResource/computers/id/${id}`);
      const computer = response.data.computer;
      
      // Transform classic API response
      const detail: ComputerDetail = {
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

      return detail;
    } catch (error) {
      console.error(`Failed to get computer details for ${id}:`, error);
      throw error;
    }
  }

  // Optimized getAllComputers that doesn't fetch individual details
  async getAllComputers(limit: number = 1000): Promise<any[]> {
    try {
      const allComputers = await this.getCachedSearchData();
      
      // Return in a format compatible with the compliance check
      return allComputers.slice(0, limit).map((c: any) => ({
        id: c.id,
        name: c.name || c.Computer_Name,
        username: c.Full_Name || c.username,
        general: {
          name: c.name || c.Computer_Name,
          serial_number: c.Serial_Number || c.serial_number,
          last_contact_time: c.Last_Check_in || c.Last_Contact_Time,
          last_contact_time_epoch: null,
          last_contact_time_utc: c.Last_Check_in || c.Last_Contact_Time,
        }
      }));
    } catch (error) {
      console.error('Failed to get all computers:', error);
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
      await this.axios.post(`/api/v1/computers/${deviceId}/inventory-update`);
    } catch (error) {
      console.error('Failed to update inventory:', error);
      throw error;
    }
  }
}