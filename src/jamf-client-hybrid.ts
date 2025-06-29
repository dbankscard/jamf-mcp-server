import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { z } from 'zod';

export interface JamfApiClientConfig {
  baseUrl: string;
  // OAuth2 credentials (for Modern API)
  clientId?: string;
  clientSecret?: string;
  // Basic Auth credentials (for getting Bearer token)
  username?: string;
  password?: string;
  readOnlyMode?: boolean;
}

export interface JamfAuthToken {
  token: string;
  expires: Date;
}

// Computer schemas (same as unified client)
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

export type Computer = z.infer<typeof ComputerSchema>;

/**
 * Hybrid Jamf API Client that uses the correct authentication methods:
 * 1. OAuth2 client credentials for Modern API token
 * 2. Basic Auth to get Bearer token (which works on Classic API)
 * 3. Intelligent fallback to whichever method works
 */
export class JamfApiClientHybrid {
  private axiosInstance: AxiosInstance;
  private oauth2Token: JamfAuthToken | null = null;
  private bearerToken: JamfAuthToken | null = null;
  private readOnlyMode: boolean;
  private config: JamfApiClientConfig;
  
  // Capabilities flags
  private hasOAuth2: boolean;
  private hasBasicAuth: boolean;
  private oauth2Available: boolean = false;
  private bearerTokenAvailable: boolean = false;
  
  // Cache
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
    
    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    
    console.error(`Jamf Hybrid Client initialized with:`);
    console.error(`  - OAuth2 (Client Credentials): ${this.hasOAuth2 ? 'Available' : 'Not configured'}`);
    console.error(`  - Basic Auth (Bearer Token): ${this.hasBasicAuth ? 'Available' : 'Not configured'}`);
  }

  /**
   * Get OAuth2 token using client credentials flow
   */
  private async getOAuth2Token(): Promise<void> {
    if (!this.hasOAuth2) return;
    
    try {
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

      const expiresIn = response.data.expires_in ? response.data.expires_in * 1000 : 20 * 60 * 1000;
      
      this.oauth2Token = {
        token: response.data.access_token,
        expires: new Date(Date.now() + expiresIn),
      };
      
      this.oauth2Available = true;
      console.error('✅ OAuth2 token obtained successfully');
    } catch (error: any) {
      console.error('⚠️ OAuth2 authentication failed:', error.message);
      this.oauth2Available = false;
    }
  }

  /**
   * Get Bearer token using Basic Auth credentials
   */
  private async getBearerTokenWithBasicAuth(): Promise<void> {
    if (!this.hasBasicAuth) return;
    
    try {
      const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
      
      const response = await axios.post(
        `${this.config.baseUrl}/api/v1/auth/token`,
        null,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }
      );

      // Assume token expires in 30 minutes (Jamf default)
      this.bearerToken = {
        token: response.data.token,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      };
      
      this.bearerTokenAvailable = true;
      console.error('✅ Bearer token obtained using Basic Auth');
    } catch (error: any) {
      console.error('⚠️ Basic Auth to Bearer token failed:', error.message);
      this.bearerTokenAvailable = false;
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureAuthenticated(): Promise<void> {
    // Try Bearer token from Basic Auth first (it works on Classic API)
    if (this.hasBasicAuth) {
      if (!this.bearerToken || this.bearerToken.expires <= new Date()) {
        await this.getBearerTokenWithBasicAuth();
      }
    }
    
    // Try OAuth2 if Bearer token failed
    if (!this.bearerTokenAvailable && this.hasOAuth2) {
      if (!this.oauth2Token || this.oauth2Token.expires <= new Date()) {
        await this.getOAuth2Token();
      }
    }
    
    // Set the appropriate authorization header
    if (this.bearerTokenAvailable && this.bearerToken) {
      this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${this.bearerToken.token}`;
    } else if (this.oauth2Available && this.oauth2Token) {
      this.axiosInstance.defaults.headers['Authorization'] = `Bearer ${this.oauth2Token.token}`;
    } else {
      throw new Error('No valid authentication token available');
    }
  }

  /**
   * Test which APIs are accessible
   */
  async testApiAccess(): Promise<void> {
    await this.ensureAuthenticated();
    
    console.error('\nTesting API access:');
    
    // Test Modern API
    try {
      await this.axiosInstance.get('/api/v1/auth');
      console.error('  ✅ Modern API: Accessible');
    } catch (error) {
      console.error('  ❌ Modern API: Not accessible');
    }
    
    // Test Classic API
    try {
      await this.axiosInstance.get('/JSSResource/categories');
      console.error('  ✅ Classic API: Accessible');
    } catch (error) {
      console.error('  ❌ Classic API: Not accessible');
    }
  }

  /**
   * Transform Classic API computer to standard format
   */
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

  /**
   * Search computers
   */
  async searchComputers(query: string, limit: number = 100): Promise<Computer[]> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      console.error('Searching computers using Modern API...');
      const response = await this.axiosInstance.get('/api/v1/computers-inventory', {
        params: {
          'page-size': limit,
          'filter': query ? `general.name=="*${query}*",general.serialNumber=="*${query}*"` : undefined,
        },
      });
      
      // Transform modern response
      return response.data.results.map((computer: any) => ({
        id: computer.id,
        name: computer.general?.name || '',
        udid: computer.general?.udid || '',
        serialNumber: computer.general?.serialNumber || '',
        lastContactTime: computer.general?.lastContactTime,
        lastReportDate: computer.general?.lastReportDate,
        osVersion: computer.operatingSystem?.version,
        ipAddress: computer.general?.lastIpAddress,
        macAddress: computer.general?.macAddress,
        assetTag: computer.general?.assetTag,
        modelIdentifier: computer.hardware?.modelIdentifier,
      }));
    } catch (error: any) {
      if (error.response?.status === 403) {
        console.error('Modern API search returned 403, trying Classic API...');
      } else {
        console.error('Modern API search failed:', error.message);
      }
    }
    
    // Try Classic API
    try {
      console.error('Searching computers using Classic API...');
      if (query) {
        const response = await this.axiosInstance.get(`/JSSResource/computers/match/*${query}*`);
        const computers = response.data.computers || [];
        return computers.slice(0, limit).map((c: any) => this.transformClassicComputer(c));
      } else {
        const response = await this.axiosInstance.get('/JSSResource/computers');
        const computers = response.data.computers || [];
        return computers.slice(0, limit).map((c: any) => this.transformClassicComputer(c));
      }
    } catch (error) {
      console.error('Classic API search failed:', error);
    }
    
    // Fall back to Advanced Search
    console.error('Falling back to Advanced Search...');
    return this.searchComputersViaAdvancedSearch(query, limit);
  }

  /**
   * Search computers via Advanced Search
   */
  private async searchComputersViaAdvancedSearch(query: string, limit: number): Promise<Computer[]> {
    const searchId = await this.findBestAdvancedSearch();
    
    const response = await this.axiosInstance.get(`/JSSResource/advancedcomputersearches/id/${searchId}`);
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

  /**
   * Find the best Advanced Search to use
   */
  private async findBestAdvancedSearch(): Promise<number> {
    if (this.cachedSearchId) return this.cachedSearchId;
    
    const response = await this.axiosInstance.get('/JSSResource/advancedcomputersearches');
    const searches = response.data.advanced_computer_searches || [];
    
    // Look for searches with good names
    const candidateSearches = searches.filter((s: any) => 
      s.name.toLowerCase().includes('all') ||
      s.name.toLowerCase().includes('inventory') ||
      s.name.toLowerCase().includes('applications')
    );
    
    if (candidateSearches.length > 0) {
      this.cachedSearchId = Number(candidateSearches[0].id);
      console.error(`Using Advanced Search: "${candidateSearches[0].name}" (ID: ${this.cachedSearchId})`);
      return this.cachedSearchId;
    }
    
    // Use first available search
    if (searches.length > 0) {
      this.cachedSearchId = Number(searches[0].id);
      console.error(`Using first available Advanced Search: "${searches[0].name}" (ID: ${this.cachedSearchId})`);
      return this.cachedSearchId;
    }
    
    throw new Error('No advanced searches found');
  }

  /**
   * Get computer details
   */
  async getComputerDetails(id: string): Promise<any> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      console.error(`Getting computer details for ${id} using Modern API...`);
      const response = await this.axiosInstance.get(`/api/v1/computers-inventory-detail/${id}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status !== 403) {
        throw error;
      }
      console.error('Modern API returned 403, trying Classic API...');
    }
    
    // Try Classic API
    console.error(`Getting computer details for ${id} using Classic API...`);
    const response = await this.axiosInstance.get(`/JSSResource/computers/id/${id}`);
    return response.data.computer;
  }

  /**
   * Get all computers (for compatibility)
   */
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

  // Keep-alive method
  async keepAlive(): Promise<void> {
    await this.ensureAuthenticated();
    
    // If using Bearer token from Basic Auth, we can refresh it
    if (this.bearerTokenAvailable && this.hasBasicAuth) {
      try {
        await this.axiosInstance.post('/api/v1/auth/keep-alive');
        console.error('✅ Token refreshed');
      } catch (error) {
        // Re-authenticate if keep-alive fails
        await this.getBearerTokenWithBasicAuth();
      }
    }
  }

  // Execute policy (if not in read-only mode)
  async executePolicy(policyId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot execute policies in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    for (const deviceId of deviceIds) {
      await this.axiosInstance.post(`/api/v1/policies/${policyId}/retry/${deviceId}`);
    }
  }

  // Deploy script (if not in read-only mode)
  async deployScript(scriptId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot deploy scripts in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    for (const deviceId of deviceIds) {
      await this.axiosInstance.post(`/api/v1/scripts/${scriptId}/run`, {
        computerIds: [deviceId],
      });
    }
  }

  // Update inventory (if not in read-only mode)
  async updateInventory(deviceId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update inventory in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      // Modern API uses management commands endpoint
      await this.axiosInstance.post(`/api/v1/jamf-management-framework/redeploy/${deviceId}`);
      console.error(`Inventory update requested for device ${deviceId} via Modern API`);
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        console.error('Modern API failed, trying Classic API computercommands...');
        // Try Classic API using the correct endpoint
        try {
          await this.axiosInstance.post(`/JSSResource/computercommands/command/UpdateInventory`, {
            computer_id: deviceId,
          });
          console.error(`Inventory update requested for device ${deviceId} via Classic API`);
        } catch (classicError) {
          console.error('Classic API computercommands failed:', classicError);
          throw classicError;
        }
      } else {
        throw error;
      }
    }
  }

  // List policies
  async listPolicies(limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    try {
      // Try Classic API (policies are typically in Classic API)
      const response = await this.axiosInstance.get('/JSSResource/policies');
      const policies = response.data.policies || [];
      return policies.slice(0, limit);
    } catch (error) {
      console.error('Failed to list policies:', error);
      return [];
    }
  }

  // Search policies
  async searchPolicies(query: string, limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    try {
      // Get all policies and filter
      const response = await this.axiosInstance.get('/JSSResource/policies');
      const policies = response.data.policies || [];
      
      if (!query) {
        return policies.slice(0, limit);
      }
      
      const lowerQuery = query.toLowerCase();
      const filtered = policies.filter((p: any) => 
        p.name?.toLowerCase().includes(lowerQuery) ||
        p.id?.toString().includes(query)
      );
      
      return filtered.slice(0, limit);
    } catch (error) {
      console.error('Failed to search policies:', error);
      return [];
    }
  }

  // Get policy details
  async getPolicyDetails(policyId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    try {
      const response = await this.axiosInstance.get(`/JSSResource/policies/id/${policyId}`);
      return response.data.policy;
    } catch (error) {
      console.error('Failed to get policy details:', error);
      throw error;
    }
  }
}