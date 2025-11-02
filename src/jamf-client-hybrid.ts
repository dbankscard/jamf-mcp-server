import axios, { AxiosInstance, AxiosError } from 'axios';
import https from 'https';
import { z } from 'zod';
import { createLogger } from './server/logger.js';
import { safeExecute, withTimeout } from './utils/error-handler.js';
import { getDefaultAgentPool } from './utils/http-agent-pool.js';
import { JamfComputer, JamfComputerDetails, JamfSearchResponse, JamfApiResponse } from './types/jamf-api.js';
import { isAxiosError, getErrorMessage, getAxiosErrorStatus, getAxiosErrorData } from './utils/type-guards.js';

const logger = createLogger('jamf-client-hybrid');
const agentPool = getDefaultAgentPool();

export interface JamfApiClientConfig {
  baseUrl: string;
  // OAuth2 credentials (for Modern API)
  clientId?: string;
  clientSecret?: string;
  // Basic Auth credentials (for getting Bearer token)
  username?: string;
  password?: string;
  readOnlyMode?: boolean;
  // TLS/SSL options
  rejectUnauthorized?: boolean; // Default: true for security
  // Note: Set to false only for development/testing with self-signed certificates
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
  private basicAuthHeader: string | null = null;
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
    
    // Store Basic Auth header for Classic API
    if (this.hasBasicAuth) {
      this.basicAuthHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    }
    
    // Initialize axios instance
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 10000,
      httpsAgent: agentPool.getHttpsAgent(), // Use pooled agent
    });
    
    // Add request interceptor to handle auth based on endpoint
    this.axiosInstance.interceptors.request.use((config) => {
      // Classic API endpoints need Basic auth
      if (config.url?.includes('/JSSResource/')) {
        if (this.basicAuthHeader) {
          config.headers['Authorization'] = this.basicAuthHeader;
        }
        // Note: We keep Accept as application/json for Classic API
        // Jamf Classic API can return JSON if Accept header is set to application/json
      } else {
        // Modern API endpoints use Bearer token
        if (this.bearerTokenAvailable && this.bearerToken) {
          config.headers['Authorization'] = `Bearer ${this.bearerToken.token}`;
        } else if (this.oauth2Available && this.oauth2Token) {
          config.headers['Authorization'] = `Bearer ${this.oauth2Token.token}`;
        }
      }
      return config;
    });
    
    // MCP servers must not output to stdout/stderr - commenting out logger
    // logger.info(`Jamf Hybrid Client initialized with:`);
    // logger.info(`  - OAuth2 (Client Credentials): ${this.hasOAuth2 ? 'Available' : 'Not configured'}`);
    // logger.info(`  - Basic Auth (Bearer Token): ${this.hasBasicAuth ? 'Available' : 'Not configured'}`);
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
          httpsAgent: agentPool.getHttpsAgent(), // Use pooled agent
        }
      );

      const expiresIn = response.data.expires_in ? response.data.expires_in * 1000 : 20 * 60 * 1000;
      
      this.oauth2Token = {
        token: response.data.access_token,
        expires: new Date(Date.now() + expiresIn),
      };
      
      this.oauth2Available = true;
      logger.info('✅ OAuth2 token obtained successfully');
    } catch (error) {
      logger.warn('OAuth2 authentication failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      this.oauth2Available = false;
    }
  }

  /**
   * Get Bearer token using Basic Auth credentials
   */
  private async getBearerTokenWithBasicAuth(): Promise<void> {
    if (!this.hasBasicAuth) return;
    
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/v1/auth/token`,
        null,
        {
          headers: {
            'Authorization': this.basicAuthHeader!,
            'Accept': 'application/json',
          },
          httpsAgent: agentPool.getHttpsAgent(), // Use pooled agent
        }
      );

      // Assume token expires in 30 minutes (Jamf default)
      this.bearerToken = {
        token: response.data.token,
        expires: new Date(Date.now() + 30 * 60 * 1000),
      };
      
      this.bearerTokenAvailable = true;
      logger.info('✅ Bearer token obtained using Basic Auth');
    } catch (error) {
      logger.warn('Basic Auth to Bearer token failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      this.bearerTokenAvailable = false;
    }
  }

  /**
   * Ensure we have a valid token
   */
  private async ensureAuthenticated(): Promise<void> {
    // Try Bearer token from Basic Auth first (it works on Modern API)
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
    
    // We don't set headers here anymore - the interceptor handles it based on the endpoint
    // Just ensure we have at least one valid auth method
    if (!this.bearerTokenAvailable && !this.oauth2Available && !this.hasBasicAuth) {
      throw new Error('No valid authentication method available');
    }
  }

  /**
   * Test which APIs are accessible
   */
  async testApiAccess(): Promise<void> {
    await this.ensureAuthenticated();
    
    logger.info('\nTesting API access:');
    
    // Test Modern API
    try {
      await this.axiosInstance.get('/api/v1/auth');
      logger.info('  ✅ Modern API: Accessible');
    } catch (error) {
      logger.warn('Modern API not accessible', { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: '/api/v1/jamf-pro-server-url'
      });
    }
    
    // Test Classic API
    try {
      await this.axiosInstance.get('/JSSResource/categories');
      logger.info('  ✅ Classic API: Accessible');
    } catch (error) {
      logger.warn('Classic API not accessible', { 
        error: error instanceof Error ? error.message : String(error),
        endpoint: '/JSSResource/categories'
      });
    }
  }

  /**
   * Transform Classic API computer to standard format
   */
  private transformClassicComputer(classicComputer: JamfComputer): Computer {
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
      logger.info('Searching computers using Modern API...');
      const params: Record<string, string | number> = {
        'page-size': limit,
      };
      
      // Only add filter if there's a query
      if (query && query.trim() !== '') {
        // Try simpler filter syntax
        params.filter = `general.name=="*${query}*"`;
      }
      
      const response = await this.axiosInstance.get('/api/v1/computers-inventory', {
        params,
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
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 403) {
        logger.info('Modern API search returned 403, trying Classic API...');
      } else {
        logger.debug('Modern API search failed, falling back to Classic API', {
          error: error instanceof Error ? error.message : String(error),
          status: axiosError.response?.status
        });
      }
    }
    
    // Try Classic API
    try {
      logger.info('Searching computers using Classic API...');
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
      logger.info('Classic API search failed:', error);
    }
    
    // Fall back to Advanced Search
    logger.info('Falling back to Advanced Search...');
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
      logger.info(`Using Advanced Search: "${candidateSearches[0].name}" (ID: ${this.cachedSearchId})`);
      return this.cachedSearchId;
    }
    
    // Use first available search
    if (searches.length > 0) {
      this.cachedSearchId = Number(searches[0].id);
      logger.info(`Using first available Advanced Search: "${searches[0].name}" (ID: ${this.cachedSearchId})`);
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
      logger.info(`Getting computer details for ${id} using Modern API...`);
      const response = await this.axiosInstance.get(`/api/v1/computers-inventory-detail/${id}`);
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.debug('Modern API computer details failed, falling back to Classic API', {
        status: axiosError.response?.status,
        error: error instanceof Error ? error.message : String(error),
        computerId: id
      });
      // Fall back to Classic API for any error
    }
    
    // Try Classic API
    logger.info(`Getting computer details for ${id} using Classic API...`);
    try {
      const response = await this.axiosInstance.get(`/JSSResource/computers/id/${id}`);
      return response.data.computer;
    } catch (error) {
      const axiosError = error as AxiosError;
      logger.error('Failed to get computer details from both APIs', {
        computerId: id,
        error: error instanceof Error ? error.message : String(error),
        status: axiosError.response?.status
      });
      throw error;
    }
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
        logger.info('✅ Token refreshed');
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
      logger.info(`Inventory update requested for device ${deviceId} via Modern API`);
    } catch (error) {
      if (getAxiosErrorStatus(error) === 404 || getAxiosErrorStatus(error) === 403) {
        logger.info('Modern API failed, trying Classic API computercommands...');
        // Try Classic API using the correct endpoint
        try {
          await this.axiosInstance.post(`/JSSResource/computercommands/command/UpdateInventory`, {
            computer_id: deviceId,
          });
          logger.info(`Inventory update requested for device ${deviceId} via Classic API`);
        } catch (classicError) {
          logger.info('Classic API computercommands failed:', classicError);
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
      logger.info('Failed to list policies:', error);
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
      logger.info('Failed to search policies:', error);
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
      logger.info('Failed to get policy details:', error);
      throw error;
    }
  }

  /**
   * Create a new policy
   */
  async createPolicy(policyData: any): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot create policies in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      logger.info('Creating policy using Modern API...');
      logger.info('Policy data:', JSON.stringify(policyData, null, 2));
      const response = await this.axiosInstance.post('/api/v1/policies', policyData);
      return response.data;
    } catch (error) {
      logger.info(`Modern API failed with status ${getAxiosErrorStatus(error)}, trying Classic API...`);
      logger.info('Error details:', getAxiosErrorData(error));
      // Fall back to Classic API for any error
    }
    
    // Fall back to Classic API with XML format
    try {
      logger.info('Creating policy using Classic API with XML...');
      
      // Build XML payload
      const xmlPayload = this.buildPolicyXml(policyData);
      logger.info('XML Payload:', xmlPayload);
      
      const response = await this.axiosInstance.post(
        '/JSSResource/policies/id/0',
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          }
        }
      );
      
      // Extract the created policy ID from the response
      const locationHeader = response.headers.location;
      const policyId = locationHeader ? locationHeader.split('/').pop() : null;
      
      if (policyId) {
        // Fetch and return the created policy details
        return await this.getPolicyDetails(policyId);
      }
      
      return { success: true };
    } catch (classicError) {
      logger.info('Classic API also failed:', classicError);
      throw classicError;
    }
  }

  /**
   * Update an existing policy
   */
  async updatePolicy(policyId: string, policyData: any): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update policies in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      logger.info(`Updating policy ${policyId} using Modern API...`);
      const response = await this.axiosInstance.put(`/api/v1/policies/${policyId}`, policyData);
      return response.data;
    } catch (error) {
      logger.info(`Modern API failed with status ${getAxiosErrorStatus(error)}, trying Classic API...`);
      logger.info('Error details:', getAxiosErrorData(error));
      // Fall back to Classic API for any error
    }
    
    // Fall back to Classic API with XML format
    try {
      logger.info(`Updating policy ${policyId} using Classic API with XML...`);
      
      // Build XML payload
      const xmlPayload = this.buildPolicyXml(policyData);
      
      const response = await this.axiosInstance.put(
        `/JSSResource/policies/id/${policyId}`,
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          }
        }
      );
      
      // Fetch and return the updated policy details
      return await this.getPolicyDetails(policyId);
    } catch (classicError) {
      logger.info('Classic API also failed:', classicError);
      throw classicError;
    }
  }

  /**
   * Clone an existing policy
   */
  async clonePolicy(sourcePolicyId: string, newName: string): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot clone policies in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      // Get the source policy details
      logger.info(`Getting source policy ${sourcePolicyId} details for cloning...`);
      const sourcePolicy = await this.getPolicyDetails(sourcePolicyId);
      
      // Create a copy of the policy with a new name
      const clonedPolicy = { ...sourcePolicy };
      delete clonedPolicy.id;
      clonedPolicy.general = { ...clonedPolicy.general };
      clonedPolicy.general.name = newName;
      
      // Remove any unique identifiers that shouldn't be copied
      delete clonedPolicy.general.id;
      
      // Create the new policy
      return await this.createPolicy(clonedPolicy);
    } catch (error) {
      logger.info('Failed to clone policy:', error);
      throw error;
    }
  }

  /**
   * Enable or disable a policy
   */
  async setPolicyEnabled(policyId: string, enabled: boolean): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot enable/disable policies in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      // Get current policy details
      const policy = await this.getPolicyDetails(policyId);
      
      // Update only the enabled status
      const updateData = {
        general: {
          enabled: enabled
        }
      };
      
      return await this.updatePolicy(policyId, updateData);
    } catch (error) {
      logger.info(`Failed to ${enabled ? 'enable' : 'disable'} policy:`, error);
      throw error;
    }
  }

  /**
   * Update policy scope (add/remove computers and groups)
   */
  async updatePolicyScope(policyId: string, scopeUpdates: {
    addComputers?: string[];
    removeComputers?: string[];
    addComputerGroups?: string[];
    removeComputerGroups?: string[];
    replaceComputers?: string[];
    replaceComputerGroups?: string[];
  }): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update policy scope in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      // Get current policy details
      const policy = await this.getPolicyDetails(policyId);
      const currentScope = policy.scope || {};
      
      // Initialize scope arrays if they don't exist
      let computers = currentScope.computers || [];
      let computerGroups = currentScope.computer_groups || [];
      
      // Handle replacements
      if (scopeUpdates.replaceComputers !== undefined) {
        computers = scopeUpdates.replaceComputers.map(id => ({ id: parseInt(id) }));
      } else {
        // Handle additions and removals for computers
        if (scopeUpdates.addComputers) {
          const newComputers = scopeUpdates.addComputers.map(id => ({ id: parseInt(id) }));
          computers = [...computers, ...newComputers];
        }
        
        if (scopeUpdates.removeComputers) {
          const removeIds = scopeUpdates.removeComputers.map(id => parseInt(id));
          computers = computers.filter((c: any) => !removeIds.includes(c.id));
        }
      }
      
      if (scopeUpdates.replaceComputerGroups !== undefined) {
        computerGroups = scopeUpdates.replaceComputerGroups.map(id => ({ id: parseInt(id) }));
      } else {
        // Handle additions and removals for computer groups
        if (scopeUpdates.addComputerGroups) {
          const newGroups = scopeUpdates.addComputerGroups.map(id => ({ id: parseInt(id) }));
          computerGroups = [...computerGroups, ...newGroups];
        }
        
        if (scopeUpdates.removeComputerGroups) {
          const removeIds = scopeUpdates.removeComputerGroups.map(id => parseInt(id));
          computerGroups = computerGroups.filter((g: any) => !removeIds.includes(g.id));
        }
      }
      
      // Update the policy with the new scope
      const updateData = {
        scope: {
          ...currentScope,
          computers: computers,
          computer_groups: computerGroups
        }
      };
      
      return await this.updatePolicy(policyId, updateData);
    } catch (error) {
      logger.info('Failed to update policy scope:', error);
      throw error;
    }
  }

  /**
   * Build XML payload for policy creation/update
   */
  private buildPolicyXml(policyData: any): string {
    const escapeXml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<policy>\n';
    
    // General settings
    if (policyData.general) {
      xml += '  <general>\n';
      if (policyData.general.name) xml += `    <name>${escapeXml(policyData.general.name)}</name>\n`;
      if (policyData.general.enabled !== undefined) xml += `    <enabled>${policyData.general.enabled}</enabled>\n`;
      if (policyData.general.trigger) xml += `    <trigger>${escapeXml(policyData.general.trigger)}</trigger>\n`;
      if (policyData.general.trigger_checkin !== undefined) xml += `    <trigger_checkin>${policyData.general.trigger_checkin}</trigger_checkin>\n`;
      if (policyData.general.trigger_enrollment_complete !== undefined) xml += `    <trigger_enrollment_complete>${policyData.general.trigger_enrollment_complete}</trigger_enrollment_complete>\n`;
      if (policyData.general.trigger_login !== undefined) xml += `    <trigger_login>${policyData.general.trigger_login}</trigger_login>\n`;
      if (policyData.general.trigger_logout !== undefined) xml += `    <trigger_logout>${policyData.general.trigger_logout}</trigger_logout>\n`;
      if (policyData.general.trigger_network_state_changed !== undefined) xml += `    <trigger_network_state_changed>${policyData.general.trigger_network_state_changed}</trigger_network_state_changed>\n`;
      if (policyData.general.trigger_startup !== undefined) xml += `    <trigger_startup>${policyData.general.trigger_startup}</trigger_startup>\n`;
      if (policyData.general.trigger_other) xml += `    <trigger_other>${escapeXml(policyData.general.trigger_other)}</trigger_other>\n`;
      if (policyData.general.frequency) xml += `    <frequency>${escapeXml(policyData.general.frequency)}</frequency>\n`;
      if (policyData.general.retry_event) xml += `    <retry_event>${escapeXml(policyData.general.retry_event)}</retry_event>\n`;
      if (policyData.general.retry_attempts !== undefined) xml += `    <retry_attempts>${policyData.general.retry_attempts}</retry_attempts>\n`;
      if (policyData.general.notify_on_each_failed_retry !== undefined) xml += `    <notify_on_each_failed_retry>${policyData.general.notify_on_each_failed_retry}</notify_on_each_failed_retry>\n`;
      if (policyData.general.location_user_only !== undefined) xml += `    <location_user_only>${policyData.general.location_user_only}</location_user_only>\n`;
      if (policyData.general.target_drive) xml += `    <target_drive>${escapeXml(policyData.general.target_drive)}</target_drive>\n`;
      if (policyData.general.offline !== undefined) xml += `    <offline>${policyData.general.offline}</offline>\n`;
      if (policyData.general.category) xml += `    <category>${escapeXml(policyData.general.category)}</category>\n`;
      xml += '  </general>\n';
    }
    
    // Scope
    if (policyData.scope) {
      xml += '  <scope>\n';
      if (policyData.scope.all_computers !== undefined) {
        xml += `    <all_computers>${policyData.scope.all_computers}</all_computers>\n`;
      }
      if (policyData.scope.computers && policyData.scope.computers.length > 0) {
        xml += '    <computers>\n';
        policyData.scope.computers.forEach((computer: any) => {
          xml += `      <computer><id>${computer.id}</id></computer>\n`;
        });
        xml += '    </computers>\n';
      }
      if (policyData.scope.computer_groups && policyData.scope.computer_groups.length > 0) {
        xml += '    <computer_groups>\n';
        policyData.scope.computer_groups.forEach((group: any) => {
          xml += `      <computer_group><id>${group.id}</id></computer_group>\n`;
        });
        xml += '    </computer_groups>\n';
      }
      if (policyData.scope.buildings && policyData.scope.buildings.length > 0) {
        xml += '    <buildings>\n';
        policyData.scope.buildings.forEach((building: any) => {
          xml += `      <building><id>${building.id}</id></building>\n`;
        });
        xml += '    </buildings>\n';
      }
      if (policyData.scope.departments && policyData.scope.departments.length > 0) {
        xml += '    <departments>\n';
        policyData.scope.departments.forEach((dept: any) => {
          xml += `      <department><id>${dept.id}</id></department>\n`;
        });
        xml += '    </departments>\n';
      }
      xml += '  </scope>\n';
    }
    
    // Self Service
    if (policyData.self_service) {
      xml += '  <self_service>\n';
      if (policyData.self_service.use_for_self_service !== undefined) xml += `    <use_for_self_service>${policyData.self_service.use_for_self_service}</use_for_self_service>\n`;
      if (policyData.self_service.self_service_display_name) xml += `    <self_service_display_name>${escapeXml(policyData.self_service.self_service_display_name)}</self_service_display_name>\n`;
      if (policyData.self_service.install_button_text) xml += `    <install_button_text>${escapeXml(policyData.self_service.install_button_text)}</install_button_text>\n`;
      if (policyData.self_service.reinstall_button_text) xml += `    <reinstall_button_text>${escapeXml(policyData.self_service.reinstall_button_text)}</reinstall_button_text>\n`;
      if (policyData.self_service.self_service_description) xml += `    <self_service_description>${escapeXml(policyData.self_service.self_service_description)}</self_service_description>\n`;
      if (policyData.self_service.force_users_to_view_description !== undefined) xml += `    <force_users_to_view_description>${policyData.self_service.force_users_to_view_description}</force_users_to_view_description>\n`;
      if (policyData.self_service.feature_on_main_page !== undefined) xml += `    <feature_on_main_page>${policyData.self_service.feature_on_main_page}</feature_on_main_page>\n`;
      xml += '  </self_service>\n';
    }
    
    // Package Configuration
    if (policyData.package_configuration) {
      xml += '  <package_configuration>\n';
      if (policyData.package_configuration.packages && policyData.package_configuration.packages.length > 0) {
        xml += '    <packages>\n';
        policyData.package_configuration.packages.forEach((pkg: any) => {
          xml += '      <package>\n';
          xml += `        <id>${pkg.id}</id>\n`;
          if (pkg.action) xml += `        <action>${escapeXml(pkg.action)}</action>\n`;
          if (pkg.fut !== undefined) xml += `        <fut>${pkg.fut}</fut>\n`;
          if (pkg.feu !== undefined) xml += `        <feu>${pkg.feu}</feu>\n`;
          xml += '      </package>\n';
        });
        xml += '    </packages>\n';
      }
      xml += '  </package_configuration>\n';
    }
    
    // Scripts
    if (policyData.scripts && policyData.scripts.length > 0) {
      xml += '  <scripts>\n';
      policyData.scripts.forEach((script: any) => {
        xml += '    <script>\n';
        xml += `      <id>${script.id}</id>\n`;
        if (script.priority) xml += `      <priority>${escapeXml(script.priority)}</priority>\n`;
        if (script.parameter4) xml += `      <parameter4>${escapeXml(script.parameter4)}</parameter4>\n`;
        if (script.parameter5) xml += `      <parameter5>${escapeXml(script.parameter5)}</parameter5>\n`;
        if (script.parameter6) xml += `      <parameter6>${escapeXml(script.parameter6)}</parameter6>\n`;
        if (script.parameter7) xml += `      <parameter7>${escapeXml(script.parameter7)}</parameter7>\n`;
        if (script.parameter8) xml += `      <parameter8>${escapeXml(script.parameter8)}</parameter8>\n`;
        if (script.parameter9) xml += `      <parameter9>${escapeXml(script.parameter9)}</parameter9>\n`;
        if (script.parameter10) xml += `      <parameter10>${escapeXml(script.parameter10)}</parameter10>\n`;
        if (script.parameter11) xml += `      <parameter11>${escapeXml(script.parameter11)}</parameter11>\n`;
        xml += '    </script>\n';
      });
      xml += '  </scripts>\n';
    }
    
    xml += '</policy>';
    
    return xml;
  }

  // Get script details
  async getScriptDetails(scriptId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      logger.info(`Getting script details for ${scriptId} using Modern API...`);
      const response = await this.axiosInstance.get(`/api/v1/scripts/${scriptId}`);
      return response.data;
    } catch (error) {
      logger.info(`Modern API failed with status ${getAxiosErrorStatus(error)}, trying Classic API...`);
      // Fall back to Classic API for any error
    }
    
    // Try Classic API
    try {
      logger.info(`Getting script details for ${scriptId} using Classic API...`);
      const response = await this.axiosInstance.get(`/JSSResource/scripts/id/${scriptId}`);
      const script = response.data.script;
      
      // Transform Classic API response to a consistent format
      return {
        id: script.id,
        name: script.name,
        category: script.category,
        filename: script.filename,
        info: script.info,
        notes: script.notes,
        priority: script.priority,
        parameters: {
          parameter4: script.parameters?.parameter4,
          parameter5: script.parameters?.parameter5,
          parameter6: script.parameters?.parameter6,
          parameter7: script.parameters?.parameter7,
          parameter8: script.parameters?.parameter8,
          parameter9: script.parameters?.parameter9,
          parameter10: script.parameters?.parameter10,
          parameter11: script.parameters?.parameter11,
        },
        osRequirements: script.os_requirements,
        scriptContents: script.script_contents,
      };
    } catch (error) {
      logger.info(`Failed to get script details for ${scriptId}:`, error);
      throw error;
    }
  }

  /**
   * List all configuration profiles (both Computer and Mobile Device)
   * 
   * Note: The Classic API returns computer configuration profiles under 
   * 'os_x_configuration_profiles' (with underscores), not 'osx_configuration_profiles'.
   * This method handles both field names for compatibility.
   */
  async listConfigurationProfiles(type: 'computer' | 'mobiledevice' = 'computer'): Promise<any[]> {
    await this.ensureAuthenticated();
    
    try {
      // Try Modern API first
      logger.info(`Listing ${type} configuration profiles using Modern API...`);
      const endpoint = type === 'computer' 
        ? '/api/v2/computer-configuration-profiles' 
        : '/api/v2/mobile-device-configuration-profiles';
      
      const response = await this.axiosInstance.get(endpoint);
      return response.data.results || [];
    } catch (error) {
      logger.info(`Modern API failed, trying Classic API...`);
      
      // Fall back to Classic API
      try {
        const endpoint = type === 'computer'
          ? '/JSSResource/osxconfigurationprofiles'
          : '/JSSResource/mobiledeviceconfigurationprofiles';
        
        const response = await this.axiosInstance.get(endpoint);
        
        // Debug logging to see response structure
        logger.info(`Classic API response data keys:`, Object.keys(response.data));
        
        // Classic API returns os_x_configuration_profiles (with underscores) for computers
        const profiles = type === 'computer' 
          ? (response.data.os_x_configuration_profiles || response.data.osx_configuration_profiles || [])
          : (response.data.configuration_profiles || response.data.mobiledeviceconfigurationprofiles || []);
        
        logger.info(`Found ${profiles ? profiles.length : 0} ${type} configuration profiles from Classic API`);
        return profiles || [];
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Get configuration profile details
   */
  async getConfigurationProfileDetails(profileId: string, type: 'computer' | 'mobiledevice' = 'computer'): Promise<any> {
    await this.ensureAuthenticated();
    
    try {
      // Try Modern API first
      logger.info(`Getting ${type} configuration profile ${profileId} using Modern API...`);
      const endpoint = type === 'computer'
        ? `/api/v2/computer-configuration-profiles/${profileId}`
        : `/api/v2/mobile-device-configuration-profiles/${profileId}`;
      
      const response = await this.axiosInstance.get(endpoint);
      return response.data;
    } catch (error) {
      logger.info(`Modern API failed, trying Classic API...`);
      
      // Fall back to Classic API
      try {
        const endpoint = type === 'computer'
          ? `/JSSResource/osxconfigurationprofiles/id/${profileId}`
          : `/JSSResource/mobiledeviceconfigurationprofiles/id/${profileId}`;
        
        const response = await this.axiosInstance.get(endpoint);
        
        // Debug logging to see response structure
        logger.info(`Classic API response data keys:`, Object.keys(response.data));
        
        // Classic API returns os_x_configuration_profile (with underscores) for computers in detail responses
        const profile = type === 'computer' 
          ? (response.data.os_x_configuration_profile || response.data.osx_configuration_profile)
          : (response.data.configuration_profile || response.data.mobiledeviceconfigurationprofile);
          
        if (!profile) {
          throw new Error(`Profile data not found in response for ${type} profile ${profileId}`);
        }
          
        return profile;
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Search configuration profiles by name
   */
  async searchConfigurationProfiles(query: string, type: 'computer' | 'mobiledevice' = 'computer'): Promise<any[]> {
    const allProfiles = await this.listConfigurationProfiles(type);
    
    // Filter profiles by name (case-insensitive)
    const searchQuery = query.toLowerCase();
    return allProfiles.filter(profile => 
      profile.name?.toLowerCase().includes(searchQuery) ||
      profile.displayName?.toLowerCase().includes(searchQuery)
    );
  }

  /**
   * Deploy configuration profile to devices
   */
  async deployConfigurationProfile(profileId: string, deviceIds: string[], type: 'computer' | 'mobiledevice' = 'computer'): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot deploy configuration profiles in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    // Get current profile details to update scope
    const profile = await this.getConfigurationProfileDetails(profileId, type);
    
    try {
      // Modern API approach - update the profile scope
      logger.info(`Deploying ${type} configuration profile ${profileId} using Modern API...`);
      
      const endpoint = type === 'computer'
        ? `/api/v2/computer-configuration-profiles/${profileId}`
        : `/api/v2/mobile-device-configuration-profiles/${profileId}`;
      
      // Add devices to the profile scope
      const currentScope = profile.scope || {};
      const currentDevices = type === 'computer' 
        ? (currentScope.computerIds || [])
        : (currentScope.mobileDeviceIds || []);
      
      const updatedDeviceIds = [...new Set([...currentDevices, ...deviceIds])];
      
      const updatePayload = {
        ...profile,
        scope: {
          ...currentScope,
          [type === 'computer' ? 'computerIds' : 'mobileDeviceIds']: updatedDeviceIds
        }
      };
      
      await this.axiosInstance.put(endpoint, updatePayload);
      logger.info(`Successfully deployed profile ${profileId} to ${deviceIds.length} ${type}(s)`);
    } catch (error) {
      logger.info(`Modern API failed, trying Classic API...`);
      
      // Fall back to Classic API
      try {
        const endpoint = type === 'computer'
          ? `/JSSResource/osxconfigurationprofiles/id/${profileId}`
          : `/JSSResource/mobiledeviceconfigurationprofiles/id/${profileId}`;
        
        // For Classic API, we need to update the scope XML
        const scopeKey = type === 'computer' ? 'computers' : 'mobile_devices';
        const currentDevices = profile.scope?.[scopeKey] || [];
        
        const newDevices = deviceIds.map(id => ({ id: parseInt(id) }));
        const updatedDevices = [...currentDevices, ...newDevices];
        
        const updatePayload = {
          [type === 'computer' ? 'os_x_configuration_profile' : 'configuration_profile']: {
            scope: {
              [scopeKey]: updatedDevices
            }
          }
        };
        
        await this.axiosInstance.put(endpoint, updatePayload);
        logger.info(`Successfully deployed profile ${profileId} to ${deviceIds.length} ${type}(s) via Classic API`);
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Remove configuration profile from devices
   */
  async removeConfigurationProfile(profileId: string, deviceIds: string[], type: 'computer' | 'mobiledevice' = 'computer'): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot remove configuration profiles in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    // Get current profile details to update scope
    const profile = await this.getConfigurationProfileDetails(profileId, type);
    
    try {
      // Modern API approach - update the profile scope
      logger.info(`Removing ${type} configuration profile ${profileId} using Modern API...`);
      
      const endpoint = type === 'computer'
        ? `/api/v2/computer-configuration-profiles/${profileId}`
        : `/api/v2/mobile-device-configuration-profiles/${profileId}`;
      
      // Remove devices from the profile scope
      const currentScope = profile.scope || {};
      const currentDevices = type === 'computer' 
        ? (currentScope.computerIds || [])
        : (currentScope.mobileDeviceIds || []);
      
      const updatedDeviceIds = currentDevices.filter((id: string) => !deviceIds.includes(String(id)));
      
      const updatePayload = {
        ...profile,
        scope: {
          ...currentScope,
          [type === 'computer' ? 'computerIds' : 'mobileDeviceIds']: updatedDeviceIds
        }
      };
      
      await this.axiosInstance.put(endpoint, updatePayload);
      logger.info(`Successfully removed profile ${profileId} from ${deviceIds.length} ${type}(s)`);
    } catch (error) {
      logger.info(`Modern API failed, trying Classic API...`);
      
      // Fall back to Classic API
      try {
        const endpoint = type === 'computer'
          ? `/JSSResource/osxconfigurationprofiles/id/${profileId}`
          : `/JSSResource/mobiledeviceconfigurationprofiles/id/${profileId}`;
        
        // For Classic API, we need to update the scope XML
        const scopeKey = type === 'computer' ? 'computers' : 'mobile_devices';
        const currentDevices = profile.scope?.[scopeKey] || [];
        
        const deviceIdsToRemove = deviceIds.map(id => parseInt(id));
        const updatedDevices = currentDevices.filter((device: any) => 
          !deviceIdsToRemove.includes(device.id)
        );
        
        const updatePayload = {
          [type === 'computer' ? 'os_x_configuration_profile' : 'configuration_profile']: {
            scope: {
              [scopeKey]: updatedDevices
            }
          }
        };
        
        await this.axiosInstance.put(endpoint, updatePayload);
        logger.info(`Successfully removed profile ${profileId} from ${deviceIds.length} ${type}(s) via Classic API`);
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * List all packages
   */
  async listPackages(limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    // Packages are only available through Classic API
    // Modern API doesn't have a packages endpoint
    try {
      logger.info('Listing packages using Classic API...');
      const response = await this.axiosInstance.get('/JSSResource/packages');
      const packages = response.data.packages || [];
      return packages.slice(0, limit);
    } catch (error) {
      logger.info('Failed to list packages:', error);
      throw error;
    }
  }

  /**
   * Get package details
   */
  async getPackageDetails(packageId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    // Packages are only available through Classic API
    try {
      logger.info(`Getting package details for ${packageId} using Classic API...`);
      const response = await this.axiosInstance.get(`/JSSResource/packages/id/${packageId}`);
      return response.data.package;
    } catch (error) {
      logger.info('Failed to get package details:', error);
      throw error;
    }
  }

  /**
   * Search packages by name
   */
  async searchPackages(query: string, limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    // Packages are only available through Classic API
    try {
      logger.info('Searching packages using Classic API...');
      const response = await this.axiosInstance.get('/JSSResource/packages');
      const packages = response.data.packages || [];
      
      if (!query) {
        return packages.slice(0, limit);
      }
      
      const lowerQuery = query.toLowerCase();
      const filtered = packages.filter((p: any) => 
        p.name?.toLowerCase().includes(lowerQuery) ||
        p.filename?.toLowerCase().includes(lowerQuery) ||
        p.category?.toLowerCase().includes(lowerQuery)
      );
      
      return filtered.slice(0, limit);
    } catch (error) {
      logger.info('Failed to search packages:', error);
      throw error;
    }
  }

  /**
   * Get package deployment history
   */
  async getPackageDeploymentHistory(packageId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    try {
      // Package deployment history is typically tracked through policies
      // First get the package details to understand its usage
      const packageDetails = await this.getPackageDetails(packageId);
      
      // Get all policies and filter those using this package
      const policies = await this.listPolicies(1000);
      const policiesUsingPackage: any[] = [];
      
      // Check each policy to see if it uses this package
      for (const policy of policies) {
        try {
          const policyDetails = await this.getPolicyDetails(policy.id);
          const packagesInPolicy = policyDetails.package_configuration?.packages || [];
          
          if (packagesInPolicy.some((p: any) => String(p.id) === String(packageId))) {
            policiesUsingPackage.push({
              policyId: policy.id,
              policyName: policy.name,
              enabled: policyDetails.general?.enabled,
              frequency: policyDetails.general?.frequency,
              targetedDevices: policyDetails.scope?.computers?.length || 0,
              lastModified: policyDetails.general?.date_time_limitations?.activation_date,
            });
          }
        } catch (err) {
          logger.info(`Failed to get details for policy ${policy.id}:`, err);
        }
      }
      
      return {
        package: {
          id: packageDetails.id,
          name: packageDetails.name || packageDetails.filename,
          category: packageDetails.category,
          size: packageDetails.size,
        },
        deploymentInfo: {
          policiesUsingPackage: policiesUsingPackage.length,
          policies: policiesUsingPackage,
        },
      };
    } catch (error) {
      logger.info('Failed to get package deployment history:', error);
      throw error;
    }
  }

  /**
   * Get policies using a specific package
   */
  async getPoliciesUsingPackage(packageId: string): Promise<any[]> {
    await this.ensureAuthenticated();
    
    try {
      // Get all policies
      const policies = await this.listPolicies(1000);
      const policiesUsingPackage: any[] = [];
      
      // Check each policy to see if it uses this package
      for (const policy of policies) {
        try {
          const policyDetails = await this.getPolicyDetails(policy.id);
          const packagesInPolicy = policyDetails.package_configuration?.packages || [];
          
          if (packagesInPolicy.some((p: any) => String(p.id) === String(packageId))) {
            policiesUsingPackage.push({
              id: policy.id,
              name: policy.name,
              enabled: policyDetails.general?.enabled,
              frequency: policyDetails.general?.frequency,
              category: policyDetails.category,
              targetedComputers: policyDetails.scope?.computers?.length || 0,
              targetedComputerGroups: policyDetails.scope?.computer_groups?.length || 0,
              packageAction: packagesInPolicy.find((p: any) => String(p.id) === String(packageId))?.action || 'Install',
            });
          }
        } catch (err) {
          logger.info(`Failed to get details for policy ${policy.id}:`, err);
        }
      }
      
      return policiesUsingPackage;
    } catch (error) {
      logger.info('Failed to get policies using package:', error);
      throw error;
    }
  }

  /**
   * List computer groups
   */
  async listComputerGroups(type: 'smart' | 'static' | 'all' = 'all'): Promise<any[]> {
    await this.ensureAuthenticated();
    
    // Computer groups are only available through Classic API
    try {
      logger.info(`Listing computer groups (${type}) using Classic API...`);
      const response = await this.axiosInstance.get('/JSSResource/computergroups');
      let groups = response.data.computer_groups || [];
      
      // Classic API doesn't provide group type in list, so we need to fetch each one
      // For performance, only do this if filtering is requested
      if (type !== 'all' && groups.length > 0) {
        const detailedGroups = [];
        for (const group of groups) {
          try {
            const details = await this.getComputerGroupDetails(group.id.toString());
            if ((type === 'smart' && details.is_smart) || 
                (type === 'static' && !details.is_smart)) {
              detailedGroups.push({
                ...group,
                is_smart: details.is_smart,
                size: details.computers?.length || 0
              });
            }
          } catch (err) {
            logger.info(`Failed to get details for group ${group.id}:`, err);
          }
        }
        groups = detailedGroups;
      }
      
      return groups;
    } catch (error) {
      logger.info('Failed to list computer groups:', error);
      throw error;
    }
  }

  /**
   * Get computer group details
   */
  async getComputerGroupDetails(groupId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    // Computer groups are only available through Classic API
    try {
      logger.info(`Getting computer group ${groupId} details using Classic API...`);
      const response = await this.axiosInstance.get(`/JSSResource/computergroups/id/${groupId}`);
      const group = response.data.computer_group;
      
      // Transform Classic API response to include member count
      return {
        id: group.id,
        name: group.name,
        is_smart: group.is_smart,
        criteria: group.criteria,
        computers: group.computers || [],
        site: group.site,
        memberCount: group.computers?.length || 0,
      };
    } catch (error) {
      logger.info('Failed to get computer group details:', error);
      throw error;
    }
  }

  /**
   * Search computer groups by name
   */
  async searchComputerGroups(query: string): Promise<any[]> {
    const allGroups = await this.listComputerGroups('all');
    
    if (!query) {
      return allGroups;
    }
    
    const lowerQuery = query.toLowerCase();
    return allGroups.filter(group => 
      group.name?.toLowerCase().includes(lowerQuery) ||
      group.id?.toString().includes(query)
    );
  }

  /**
   * Get computer group members
   */
  async getComputerGroupMembers(groupId: string): Promise<any[]> {
    const groupDetails = await this.getComputerGroupDetails(groupId);
    
    // Return the computers array from the group details
    return groupDetails.computers || [];
  }

  /**
   * Create static computer group
   */
  async createStaticComputerGroup(name: string, computerIds: string[]): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot create computer groups in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      // Try Modern API first
      logger.info(`Creating static computer group "${name}" using Modern API...`);
      
      const payload = {
        name: name,
        isSmart: false,
        computers: computerIds.map(id => ({ id: parseInt(id) })),
      };
      
      const response = await this.axiosInstance.post('/api/v1/computer-groups', payload);
      return response.data;
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
      
      // Fall back to Classic API
      try {
        const payload = {
          computer_group: {
            name: name,
            is_smart: false,
            computers: computerIds.map(id => ({ id: parseInt(id) })),
          }
        };
        
        const response = await this.axiosInstance.post('/JSSResource/computergroups/id/0', payload);
        return response.data.computer_group;
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Update static computer group membership
   */
  async updateStaticComputerGroup(groupId: string, computerIds: string[]): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update computer groups in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    // First get the group details to ensure it's a static group
    const groupDetails = await this.getComputerGroupDetails(groupId);
    if (groupDetails.is_smart || groupDetails.isSmart) {
      throw new Error('Cannot update membership of a smart group. Smart groups are defined by criteria.');
    }
    
    // Computer groups are only available through Classic API
    // Classic API requires XML format for updates
    try {
      logger.info(`Updating static computer group ${groupId} using Classic API with XML...`);
      
      // Build XML payload
      const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<computer_group>
  <name>${groupDetails.name}</name>
  <is_smart>false</is_smart>
  <computers>
    ${computerIds.map(id => `<computer><id>${id}</id></computer>`).join('\n    ')}
  </computers>
</computer_group>`;
      
      logger.info('Sending XML payload:', xmlPayload);
      
      const response = await this.axiosInstance.put(
        `/JSSResource/computergroups/id/${groupId}`,
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          }
        }
      );
      
      // The Classic API returns XML, but might also return an empty response on success
      // Let's return the updated group details by fetching them
      logger.info('Update request completed, fetching updated group details...');
      try {
        const updatedGroup = await this.getComputerGroupDetails(groupId);
        return updatedGroup;
      } catch (fetchError) {
        // If we can't fetch the updated details, just return a success indicator
        logger.info('Could not fetch updated group details, but update likely succeeded');
        return { id: groupId, success: true };
      }
    } catch (error) {
      logger.info('Failed to update computer group:', getAxiosErrorStatus(error), getAxiosErrorData(error));
      throw error;
    }
  }

  /**
   * Delete computer group
   */
  async deleteComputerGroup(groupId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot delete computer groups in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      // Try Modern API first
      logger.info(`Deleting computer group ${groupId} using Modern API...`);
      await this.axiosInstance.delete(`/api/v1/computer-groups/${groupId}`);
      logger.info(`Successfully deleted computer group ${groupId}`);
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
      
      // Fall back to Classic API
      try {
        await this.axiosInstance.delete(`/JSSResource/computergroups/id/${groupId}`);
        logger.info(`Successfully deleted computer group ${groupId} via Classic API`);
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Search mobile devices
   */
  async searchMobileDevices(query: string, limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      logger.info('Searching mobile devices using Modern API...');
      const response = await this.axiosInstance.get('/api/v2/mobile-devices', {
        params: {
          'page-size': limit,
          'filter': query ? `name=="*${query}*",serialNumber=="*${query}*",udid=="*${query}*"` : undefined,
        },
      });
      
      return response.data.results || [];
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
    }
    
    // Try Classic API
    try {
      logger.info('Searching mobile devices using Classic API...');
      if (query) {
        const response = await this.axiosInstance.get(`/JSSResource/mobiledevices/match/*${query}*`);
        const devices = response.data.mobile_devices || [];
        return devices.slice(0, limit);
      } else {
        const response = await this.axiosInstance.get('/JSSResource/mobiledevices');
        const devices = response.data.mobile_devices || [];
        return devices.slice(0, limit);
      }
    } catch (error) {
      logger.info('Classic API search failed:', error);
      throw error;
    }
  }

  /**
   * Get mobile device details
   */
  async getMobileDeviceDetails(deviceId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      logger.info(`Getting mobile device details for ${deviceId} using Modern API...`);
      const response = await this.axiosInstance.get(`/api/v2/mobile-devices/${deviceId}/detail`);
      return response.data;
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
    }
    
    // Try Classic API
    try {
      logger.info(`Getting mobile device details for ${deviceId} using Classic API...`);
      const response = await this.axiosInstance.get(`/JSSResource/mobiledevices/id/${deviceId}`);
      return response.data.mobile_device;
    } catch (error) {
      logger.info('Classic API failed:', error);
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
    
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      logger.info(`Updating mobile device inventory for ${deviceId} using Modern API...`);
      await this.axiosInstance.post(`/api/v2/mobile-devices/${deviceId}/update-inventory`);
      logger.info(`Mobile device inventory update requested for device ${deviceId}`);
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
      
      // Try Classic API using MDM commands
      try {
        // Classic API expects XML format for MDM commands
        const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<mobile_device_command>
  <general>
    <command>UpdateInventory</command>
  </general>
  <mobile_devices>
    <mobile_device>
      <id>${deviceId}</id>
    </mobile_device>
  </mobile_devices>
</mobile_device_command>`;
        
        await this.axiosInstance.post(
          `/JSSResource/mobiledevicecommands/command/UpdateInventory/id/${deviceId}`,
          xmlPayload,
          {
            headers: {
              'Content-Type': 'application/xml',
              'Accept': 'application/xml',
            }
          }
        );
        logger.info(`Mobile device inventory update requested for device ${deviceId} via Classic API`);
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Send MDM command to mobile device
   */
  async sendMDMCommand(deviceId: string, command: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot send MDM commands in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
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
    
    // Try Modern API first
    try {
      logger.info(`Sending MDM command '${command}' to mobile device ${deviceId} using Modern API...`);
      
      // Modern API uses different endpoints for different commands
      if (command === 'DeviceLock') {
        await this.axiosInstance.post(`/api/v2/mobile-devices/${deviceId}/lock`);
      } else if (command === 'EraseDevice') {
        await this.axiosInstance.post(`/api/v2/mobile-devices/${deviceId}/erase`);
      } else if (command === 'ClearPasscode') {
        await this.axiosInstance.post(`/api/v2/mobile-devices/${deviceId}/clear-passcode`);
      } else {
        // Generic command endpoint
        await this.axiosInstance.post(`/api/v2/mobile-devices/${deviceId}/commands`, {
          commandType: command,
        });
      }
      
      logger.info(`Successfully sent MDM command '${command}' to device ${deviceId}`);
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
      
      // Try Classic API
      try {
        await this.axiosInstance.post(`/JSSResource/mobiledevicecommands/command/${command}`, {
          mobile_device_id: deviceId,
        });
        logger.info(`Successfully sent MDM command '${command}' to device ${deviceId} via Classic API`);
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * List all scripts
   */
  async listScripts(limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    // Scripts are only available through Classic API
    try {
      logger.info('Listing scripts using Classic API...');
      const response = await this.axiosInstance.get('/JSSResource/scripts');
      const scripts = response.data.scripts || [];
      return scripts.slice(0, limit);
    } catch (error) {
      logger.info('Failed to list scripts:', error);
      throw error;
    }
  }

  /**
   * Search scripts by name
   */
  async searchScripts(query: string, limit: number = 100): Promise<any[]> {
    await this.ensureAuthenticated();
    
    // Scripts are only available through Classic API
    try {
      logger.info('Searching scripts using Classic API...');
      const response = await this.axiosInstance.get('/JSSResource/scripts');
      const scripts = response.data.scripts || [];
      
      if (!query) {
        return scripts.slice(0, limit);
      }
      
      const lowerQuery = query.toLowerCase();
      const filtered = scripts.filter((s: any) => 
        s.name?.toLowerCase().includes(lowerQuery) ||
        s.id?.toString().includes(query)
      );
      
      return filtered.slice(0, limit);
    } catch (error) {
      logger.info('Failed to search scripts:', error);
      throw error;
    }
  }

  /**
   * Create a new script
   */
  async createScript(scriptData: {
    name: string;
    script_contents: string;
    category?: string;
    info?: string;
    notes?: string;
    priority?: string;
    parameters?: {
      parameter4?: string;
      parameter5?: string;
      parameter6?: string;
      parameter7?: string;
      parameter8?: string;
      parameter9?: string;
      parameter10?: string;
      parameter11?: string;
    };
    os_requirements?: string;
    script_contents_encoded?: boolean;
  }): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot create scripts in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      logger.info('Creating script using Classic API with XML...');
      
      // Build XML payload
      const xmlPayload = this.buildScriptXml(scriptData);
      logger.info('XML Payload:', xmlPayload);
      
      const response = await this.axiosInstance.post(
        '/JSSResource/scripts/id/0',
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          }
        }
      );
      
      // Extract the created script ID from the response
      const locationHeader = response.headers.location;
      const scriptId = locationHeader ? locationHeader.split('/').pop() : null;
      
      if (scriptId) {
        // Fetch and return the created script details
        return await this.getScriptDetails(scriptId);
      }
      
      return { success: true };
    } catch (error) {
      logger.info('Failed to create script:', error);
      throw error;
    }
  }

  /**
   * Update an existing script
   */
  async updateScript(scriptId: string, scriptData: {
    name?: string;
    script_contents?: string;
    category?: string;
    info?: string;
    notes?: string;
    priority?: string;
    parameters?: {
      parameter4?: string;
      parameter5?: string;
      parameter6?: string;
      parameter7?: string;
      parameter8?: string;
      parameter9?: string;
      parameter10?: string;
      parameter11?: string;
    };
    os_requirements?: string;
    script_contents_encoded?: boolean;
  }): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot update scripts in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      logger.info(`Updating script ${scriptId} using Classic API with XML...`);
      
      // Build XML payload
      const xmlPayload = this.buildScriptXml(scriptData);
      
      const response = await this.axiosInstance.put(
        `/JSSResource/scripts/id/${scriptId}`,
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          }
        }
      );
      
      // Fetch and return the updated script details
      return await this.getScriptDetails(scriptId);
    } catch (error) {
      logger.info('Failed to update script:', error);
      throw error;
    }
  }

  /**
   * Delete a script
   */
  async deleteScript(scriptId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot delete scripts in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      logger.info(`Deleting script ${scriptId} using Classic API...`);
      await this.axiosInstance.delete(`/JSSResource/scripts/id/${scriptId}`);
      logger.info(`Successfully deleted script ${scriptId}`);
    } catch (error) {
      logger.info('Failed to delete script:', error);
      throw error;
    }
  }

  /**
   * Build XML payload for script creation/update
   */
  private buildScriptXml(scriptData: any): string {
    const escapeXml = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<script>\n';
    
    // Basic script information
    if (scriptData.name) xml += `  <name>${escapeXml(scriptData.name)}</name>\n`;
    if (scriptData.category) xml += `  <category>${escapeXml(scriptData.category)}</category>\n`;
    if (scriptData.filename) xml += `  <filename>${escapeXml(scriptData.filename)}</filename>\n`;
    if (scriptData.info) xml += `  <info>${escapeXml(scriptData.info)}</info>\n`;
    if (scriptData.notes) xml += `  <notes>${escapeXml(scriptData.notes)}</notes>\n`;
    if (scriptData.priority) xml += `  <priority>${escapeXml(scriptData.priority)}</priority>\n`;
    
    // Parameters
    if (scriptData.parameters) {
      xml += '  <parameters>\n';
      if (scriptData.parameters.parameter4) xml += `    <parameter4>${escapeXml(scriptData.parameters.parameter4)}</parameter4>\n`;
      if (scriptData.parameters.parameter5) xml += `    <parameter5>${escapeXml(scriptData.parameters.parameter5)}</parameter5>\n`;
      if (scriptData.parameters.parameter6) xml += `    <parameter6>${escapeXml(scriptData.parameters.parameter6)}</parameter6>\n`;
      if (scriptData.parameters.parameter7) xml += `    <parameter7>${escapeXml(scriptData.parameters.parameter7)}</parameter7>\n`;
      if (scriptData.parameters.parameter8) xml += `    <parameter8>${escapeXml(scriptData.parameters.parameter8)}</parameter8>\n`;
      if (scriptData.parameters.parameter9) xml += `    <parameter9>${escapeXml(scriptData.parameters.parameter9)}</parameter9>\n`;
      if (scriptData.parameters.parameter10) xml += `    <parameter10>${escapeXml(scriptData.parameters.parameter10)}</parameter10>\n`;
      if (scriptData.parameters.parameter11) xml += `    <parameter11>${escapeXml(scriptData.parameters.parameter11)}</parameter11>\n`;
      xml += '  </parameters>\n';
    }
    
    // OS Requirements
    if (scriptData.os_requirements) xml += `  <os_requirements>${escapeXml(scriptData.os_requirements)}</os_requirements>\n`;
    
    // Script contents
    if (scriptData.script_contents) {
      xml += `  <script_contents>${escapeXml(scriptData.script_contents)}</script_contents>\n`;
    }
    
    // Script contents encoded flag
    if (scriptData.script_contents_encoded !== undefined) {
      xml += `  <script_contents_encoded>${scriptData.script_contents_encoded}</script_contents_encoded>\n`;
    }
    
    xml += '</script>';
    
    return xml;
  }

  /**
   * List mobile device groups
   */
  async getMobileDeviceGroups(type: 'smart' | 'static' | 'all' = 'all'): Promise<any[]> {
    await this.ensureAuthenticated();
    
    try {
      // Try Modern API first
      logger.info(`Listing mobile device groups (${type}) using Modern API...`);
      const response = await this.axiosInstance.get('/api/v1/mobile-device-groups', {
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
      logger.info('Modern API failed, trying Classic API...');
      
      // Fall back to Classic API
      try {
        const response = await this.axiosInstance.get('/JSSResource/mobiledevicegroups');
        let groups = response.data.mobile_device_groups || [];
        
        // Classic API doesn't provide group type in list, so we need to fetch each one
        if (type !== 'all') {
          const detailedGroups = [];
          for (const group of groups) {
            try {
              const details = await this.getMobileDeviceGroupDetails(group.id);
              if ((type === 'smart' && details.is_smart) || 
                  (type === 'static' && !details.is_smart)) {
                detailedGroups.push(group);
              }
            } catch (err) {
              logger.info(`Failed to get details for mobile device group ${group.id}:`, err);
            }
          }
          groups = detailedGroups;
        }
        
        return groups;
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Get mobile device group details
   */
  async getMobileDeviceGroupDetails(groupId: string): Promise<any> {
    await this.ensureAuthenticated();
    
    try {
      // Try Modern API first
      logger.info(`Getting mobile device group ${groupId} details using Modern API...`);
      const response = await this.axiosInstance.get(`/api/v1/mobile-device-groups/${groupId}`);
      return response.data;
    } catch (error) {
      logger.info('Modern API failed, trying Classic API...');
      
      // Fall back to Classic API
      try {
        const response = await this.axiosInstance.get(`/JSSResource/mobiledevicegroups/id/${groupId}`);
        const group = response.data.mobile_device_group;
        
        // Transform Classic API response
        return {
          id: group.id,
          name: group.name,
          is_smart: group.is_smart,
          criteria: group.criteria,
          mobile_devices: group.mobile_devices || [],
          site: group.site,
          memberCount: group.mobile_devices?.length || 0,
        };
      } catch (classicError) {
        logger.info('Classic API also failed:', classicError);
        throw classicError;
      }
    }
  }

  /**
   * Get inventory summary report
   * Returns total computers/mobile devices, OS version distribution, and model distribution
   */
  async getInventorySummary(): Promise<any> {
    try {
      logger.info('Generating inventory summary report...');
      
      // Fetch computers and mobile devices
      const [computers, mobileDevices] = await Promise.all([
        this.searchComputers('', 10000).catch(() => []),
        this.searchMobileDevices('', 10000).catch(() => [])
      ]);
      
      // OS Version distribution for computers
      const computerOSVersions = new Map<string, number>();
      const computerModels = new Map<string, number>();
      
      // Process computers
      for (const computer of computers) {
        // OS Version
        if (computer.osVersion) {
          const osVersion = computer.osVersion.trim();
          computerOSVersions.set(osVersion, (computerOSVersions.get(osVersion) || 0) + 1);
        }
        
        // Model - need to fetch details for model info
        if (computer.modelIdentifier) {
          const model = computer.modelIdentifier.trim();
          computerModels.set(model, (computerModels.get(model) || 0) + 1);
        }
      }
      
      // OS Version distribution for mobile devices
      const mobileOSVersions = new Map<string, number>();
      const mobileModels = new Map<string, number>();
      
      // Process mobile devices - may need to fetch details for full info
      for (const device of mobileDevices) {
        if (device.osVersion || device.os_version) {
          const osVersion = (device.osVersion || device.os_version).trim();
          mobileOSVersions.set(osVersion, (mobileOSVersions.get(osVersion) || 0) + 1);
        }
        
        if (device.model || device.model_display) {
          const model = (device.model || device.model_display || 'Unknown').trim();
          mobileModels.set(model, (mobileModels.get(model) || 0) + 1);
        }
      }
      
      // Convert maps to sorted arrays
      const sortByCount = (a: [string, number], b: [string, number]) => b[1] - a[1];
      
      return {
        summary: {
          totalComputers: computers.length,
          totalMobileDevices: mobileDevices.length,
          totalDevices: computers.length + mobileDevices.length,
        },
        computers: {
          total: computers.length,
          osVersionDistribution: Array.from(computerOSVersions.entries())
            .sort(sortByCount)
            .map(([version, count]) => ({ version, count, percentage: ((count / computers.length) * 100).toFixed(1) })),
          modelDistribution: Array.from(computerModels.entries())
            .sort(sortByCount)
            .slice(0, 20) // Top 20 models
            .map(([model, count]) => ({ model, count, percentage: ((count / computers.length) * 100).toFixed(1) })),
        },
        mobileDevices: {
          total: mobileDevices.length,
          osVersionDistribution: Array.from(mobileOSVersions.entries())
            .sort(sortByCount)
            .map(([version, count]) => ({ version, count, percentage: ((count / mobileDevices.length) * 100).toFixed(1) })),
          modelDistribution: Array.from(mobileModels.entries())
            .sort(sortByCount)
            .slice(0, 20) // Top 20 models
            .map(([model, count]) => ({ model, count, percentage: ((count / mobileDevices.length) * 100).toFixed(1) })),
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.info('Failed to generate inventory summary:', error);
      throw error;
    }
  }

  /**
   * Get policy compliance report
   * Returns success/failure rates, computers in scope vs completed, and last execution times
   */
  async getPolicyComplianceReport(policyId: string): Promise<any> {
    try {
      logger.info(`Generating policy compliance report for policy ${policyId}...`);
      
      // Get policy details
      const policy = await this.getPolicyDetails(policyId);
      
      // Extract scope information
      const scopedComputers = policy.scope?.computers || [];
      const scopedGroups = policy.scope?.computer_groups || [];
      const allComputersScoped = policy.scope?.all_computers || false;
      
      // Get total computers in scope
      let totalInScope = scopedComputers.length;
      
      // Add computers from groups
      for (const group of scopedGroups) {
        try {
          const groupDetails = await this.getComputerGroupDetails(group.id.toString());
          totalInScope += groupDetails.computers?.length || 0;
        } catch (err) {
          logger.info(`Failed to get group details for ${group.id}:`, err);
        }
      }
      
      // If all computers are scoped, get total count
      if (allComputersScoped) {
        const allComputers = await this.searchComputers('', 10000);
        totalInScope = allComputers.length;
      }
      
      // Get policy logs if available (this would require access to policy logs endpoint)
      // For now, we'll extract what we can from the policy details
      const policyStatus = {
        id: policy.id,
        name: policy.general?.name,
        enabled: policy.general?.enabled,
        category: policy.general?.category?.name || policy.category,
        frequency: policy.general?.frequency,
        trigger: policy.general?.trigger,
        ongoing: policy.general?.frequency === 'Ongoing',
        lastModified: policy.general?.date_time_limitations?.activation_date,
      };
      
      // Package information
      const packages = policy.package_configuration?.packages || [];
      const scripts = policy.scripts || [];
      
      // Self Service information
      const selfService = {
        enabled: policy.self_service?.use_for_self_service || false,
        displayName: policy.self_service?.self_service_display_name,
        category: policy.self_service?.self_service_category?.name,
      };
      
      // Build compliance report
      return {
        policy: policyStatus,
        scope: {
          allComputers: allComputersScoped,
          totalInScope,
          directComputers: scopedComputers.length,
          computerGroups: scopedGroups.map((g: any) => ({
            id: g.id,
            name: g.name,
          })),
          limitations: {
            buildings: policy.scope?.buildings?.length || 0,
            departments: policy.scope?.departments?.length || 0,
            networkSegments: policy.scope?.network_segments?.length || 0,
          },
          exclusions: {
            computers: policy.scope?.exclusions?.computers?.length || 0,
            computerGroups: policy.scope?.exclusions?.computer_groups?.length || 0,
            buildings: policy.scope?.exclusions?.buildings?.length || 0,
            departments: policy.scope?.exclusions?.departments?.length || 0,
          },
        },
        payloads: {
          packages: packages.map((pkg: any) => ({
            id: pkg.id,
            name: pkg.name,
            action: pkg.action,
          })),
          scripts: scripts.map((script: any) => ({
            id: script.id,
            name: script.name,
            priority: script.priority,
          })),
          totalPayloads: packages.length + scripts.length,
        },
        selfService,
        compliance: {
          note: 'Detailed execution logs would require access to policy logs endpoint',
          estimatedCompliance: {
            inScope: totalInScope,
            message: 'Use Jamf Pro web interface for detailed execution history',
          },
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.info('Failed to generate policy compliance report:', error);
      throw error;
    }
  }

  /**
   * Get package deployment statistics
   * Returns policies using the package, deployment success rate, and target device count
   */
  async getPackageDeploymentStats(packageId: string): Promise<any> {
    try {
      logger.info(`Generating package deployment statistics for package ${packageId}...`);
      
      // Get package details
      const packageDetails = await this.getPackageDetails(packageId);
      
      // Get policies using this package
      const policiesUsingPackage = await this.getPoliciesUsingPackage(packageId);
      
      // Calculate total target devices
      let totalTargetDevices = 0;
      const policyStats = [];
      
      for (const policy of policiesUsingPackage) {
        let scopeSize = 0;
        
        // Try to get more detailed policy info to calculate scope
        try {
          const fullPolicy = await this.getPolicyDetails(policy.id.toString());
          
          // Calculate scope size
          if (fullPolicy.scope?.all_computers) {
            const allComputers = await this.searchComputers('', 10000);
            scopeSize = allComputers.length;
          } else {
            scopeSize = fullPolicy.scope?.computers?.length || 0;
            
            // Add computers from groups
            for (const group of (fullPolicy.scope?.computer_groups || [])) {
              try {
                const groupDetails = await this.getComputerGroupDetails(group.id.toString());
                scopeSize += groupDetails.computers?.length || 0;
              } catch (err) {
                logger.info(`Failed to get group details for ${group.id}:`, err);
              }
            }
          }
          
          // Subtract exclusions
          scopeSize -= fullPolicy.scope?.exclusions?.computers?.length || 0;
        } catch (err) {
          logger.info(`Failed to get detailed scope for policy ${policy.id}:`, err);
          scopeSize = policy.targetedComputers || 0;
        }
        
        totalTargetDevices += scopeSize;
        
        policyStats.push({
          policyId: policy.id,
          policyName: policy.name,
          enabled: policy.enabled,
          frequency: policy.frequency,
          category: policy.category,
          packageAction: policy.packageAction,
          scopeSize,
          targetedComputerGroups: policy.targetedComputerGroups,
        });
      }
      
      return {
        package: {
          id: packageDetails.id,
          name: packageDetails.name || packageDetails.filename,
          category: packageDetails.category,
          filename: packageDetails.filename,
          size: packageDetails.size,
          priority: packageDetails.priority || 10,
          fillUserTemplate: packageDetails.fill_user_template,
          rebootRequired: packageDetails.reboot_required,
          installIfReportedAvailable: packageDetails.install_if_reported_available,
          notes: packageDetails.notes,
        },
        deployment: {
          totalPoliciesUsing: policiesUsingPackage.length,
          totalTargetDevices,
          policies: policyStats,
        },
        usage: {
          note: 'Deployment success rates would require access to policy logs',
          activePolicies: policyStats.filter(p => p.enabled).length,
          inactivePolicies: policyStats.filter(p => !p.enabled).length,
          byFrequency: policyStats.reduce((acc, p) => {
            const freq = p.frequency || 'Unknown';
            acc[freq] = (acc[freq] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byCategory: policyStats.reduce((acc, p) => {
            const cat = p.category || 'Uncategorized';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.info('Failed to generate package deployment statistics:', error);
      throw error;
    }
  }

  /**
   * Get software version report
   * Returns version distribution across devices and identifies out-of-date installations
   */
  async getSoftwareVersionReport(softwareName: string): Promise<any> {
    try {
      logger.info(`Generating software version report for "${softwareName}"...`);
      
      // Search for computers that might have this software
      // Note: This is a basic implementation - full software inventory would require
      // access to computer applications endpoint
      const computers = await this.searchComputers('', 10000);
      
      // We'll need to fetch details for a sample of computers to check software
      const sampleSize = Math.min(100, computers.length); // Check up to 100 computers
      const sampledComputers = computers.slice(0, sampleSize);
      
      const softwareVersions = new Map<string, { count: number; computers: any[] }>();
      let computersWithSoftware = 0;
      
      // Check each computer for the software
      for (const computer of sampledComputers) {
        try {
          const details = await this.getComputerDetails(computer.id);
          
          // Check applications (different API versions have different structures)
          const applications = details.software?.applications || 
                             details.applications || 
                             details.computer?.software?.applications || 
                             [];
          
          // Find matching software
          const matchingSoftware = applications.filter((app: any) => 
            app.name?.toLowerCase().includes(softwareName.toLowerCase()) ||
            app.application_name?.toLowerCase().includes(softwareName.toLowerCase())
          );
          
          if (matchingSoftware.length > 0) {
            computersWithSoftware++;
            
            for (const app of matchingSoftware) {
              const version = app.version || app.application_version || 'Unknown';
              const appName = app.name || app.application_name;
              const key = `${appName} - ${version}`;
              
              if (!softwareVersions.has(key)) {
                softwareVersions.set(key, { count: 0, computers: [] });
              }
              
              const versionData = softwareVersions.get(key)!;
              versionData.count++;
              versionData.computers.push({
                id: computer.id,
                name: computer.name,
                serialNumber: computer.serialNumber,
              });
            }
          }
        } catch (err) {
          logger.info(`Failed to get details for computer ${computer.id}:`, err);
        }
      }
      
      // Convert to sorted array
      const versionDistribution = Array.from(softwareVersions.entries())
        .map(([key, data]) => {
          const [name, version] = key.split(' - ');
          return {
            software: name,
            version,
            count: data.count,
            percentage: ((data.count / computersWithSoftware) * 100).toFixed(1),
            computers: data.computers.slice(0, 5), // First 5 computers
          };
        })
        .sort((a, b) => b.count - a.count);
      
      // Try to identify latest version (highest version number)
      const versions = versionDistribution
        .map(v => v.version)
        .filter(v => v !== 'Unknown')
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));
      
      const latestVersion = versions[0] || 'Unknown';
      
      // Identify out-of-date installations
      const outOfDateInstallations = versionDistribution
        .filter(v => v.version !== latestVersion && v.version !== 'Unknown')
        .reduce((sum, v) => sum + v.count, 0);
      
      return {
        search: {
          softwareName,
          computersChecked: sampleSize,
          totalComputers: computers.length,
          note: `Checked ${sampleSize} of ${computers.length} computers for performance reasons`,
        },
        results: {
          computersWithSoftware,
          totalInstallations: Array.from(softwareVersions.values()).reduce((sum, v) => sum + v.count, 0),
          uniqueVersions: versionDistribution.length,
          latestVersionDetected: latestVersion,
          outOfDateInstallations,
        },
        versionDistribution,
        recommendations: {
          updateNeeded: outOfDateInstallations > 0,
          message: outOfDateInstallations > 0 
            ? `${outOfDateInstallations} computers may need software updates`
            : 'All checked computers appear to have consistent versions',
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.info('Failed to generate software version report:', error);
      throw error;
    }
  }

  /**
   * Get device compliance summary
   * Returns devices checking in regularly, devices with failed policies, and devices missing critical software
   */
  async getDeviceComplianceSummary(): Promise<any> {
    try {
      logger.info('Generating device compliance summary...');
      
      let computers = [];
      
      // Try to use advanced search first (has last check-in times)
      try {
        logger.info('Attempting to use advanced search for compliance data...');
        
        // Use search ID 63 as requested
        const searchId = 63; 
        logger.info(`Using search ID: ${searchId} as requested...`);
        
        // First, let's check what fields this search has
        const searchDetails = await this.getAdvancedComputerSearchDetails(String(searchId));
        logger.info('Search display fields:', searchDetails.display_fields);
        
        // Use this search to get computers - it should return ALL computers with check-in data
        const response = await this.axiosInstance.get(`/JSSResource/advancedcomputersearches/id/${searchId}`);
        const searchResults = response.data.advanced_computer_search?.computers || [];
        
        // For compliance, we need ALL computers, not just those that haven't checked in
        // So let's use the basic list and enrich with details
        const basicComputers = await this.searchComputers('', 1000);
        
        // Create a map of check-in data from the advanced search
        const checkInMap = new Map();
        searchResults.forEach((c: any) => {
          checkInMap.set(String(c.id), c);
        });
        
        // Debug: Log the first computer to see field names
        if (searchResults.length > 0) {
          logger.info('Sample computer from search:', JSON.stringify(searchResults[0], null, 2));
        }
        
        // Enrich basic computers with check-in data
        computers = basicComputers.map((computer) => {
          const searchData = checkInMap.get(computer.id) || {};
          
          // Try to get check-in time from various possible fields
          const checkInTime = searchData.Last_Check_in || 
                           searchData['Last Check-in'] || 
                           searchData.last_contact_time ||
                           searchData.Last_Contact_Time ||
                           searchData['Last Contact Time'] ||
                           computer.lastContactTime;
          
          // If this is Dwight's computer, let's debug
          if (computer.id === '759' || computer.name === 'GH-IT-0322') {
            logger.info(`Found Dwight's computer (${computer.name}):`, {
              id: computer.id,
              searchData: searchData,
              checkInTime: checkInTime
            });
          }
          
          return {
            ...computer,
            lastContactTime: checkInTime || 'Unknown',
          };
        });
        
        logger.info(`Found ${computers.length} computers with ${checkInMap.size} having check-in data`);
      } catch (advSearchError: any) {
        logger.info('Advanced search failed:', advSearchError.message);
        logger.info('Falling back to basic search with individual lookups...');
        
        // Fall back to basic search
        const basicComputers = await this.searchComputers('', 100); // Limit to 100 to avoid timeout
        
        // For each computer, get detailed info to find last contact time
        computers = await Promise.all(
          basicComputers.slice(0, 50).map(async (computer) => { // Further limit for performance
            try {
              const details = await this.getComputerDetails(computer.id);
              return {
                ...computer,
                lastContactTime: details.general?.last_contact_time || 
                                details.general?.last_contact_time_utc ||
                                details.general?.last_check_in ||
                                details.general?.report_date ||
                                'Unknown'
              };
            } catch (err) {
              logger.info(`Failed to get details for computer ${computer.id}:`, err);
              return computer;
            }
          })
        );
        
        // Add a note about limited data
        logger.info(`Note: Due to API limitations, showing compliance for first ${computers.length} devices only`);
      }
      
      // Define compliance criteria
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Categorize devices by last contact time
      const devicesCheckingInToday = [];
      const devicesCheckingInThisWeek = [];
      const devicesNotSeenThisWeek = [];
      const devicesNotSeenThisMonth = [];
      
      for (const computer of computers) {
        // Try multiple possible field names for last contact time
        const computerAny = computer as any;
        const lastContactStr = computerAny.lastContactTime || 
                              computerAny.last_contact_time || 
                              computerAny.lastReportDate || 
                              computerAny.last_report_date ||
                              computerAny.lastCheckIn ||
                              computerAny.last_check_in ||
                              computerAny.last_checkin_time ||
                              computerAny.lastCheckinTime;
        
        const lastContact = lastContactStr ? new Date(lastContactStr) : null;
        
        if (!lastContact || isNaN(lastContact.getTime())) {
          devicesNotSeenThisMonth.push(computer);
        } else if (lastContact >= oneDayAgo) {
          devicesCheckingInToday.push(computer);
        } else if (lastContact >= sevenDaysAgo) {
          devicesCheckingInThisWeek.push(computer);
        } else if (lastContact >= thirtyDaysAgo) {
          devicesNotSeenThisWeek.push(computer);
        } else {
          devicesNotSeenThisMonth.push(computer);
        }
      }
      
      // Get policy compliance (sample check - would need policy logs for full data)
      const policies = await this.listPolicies(100);
      const failedPolicies = [];
      
      // Check a few critical policies
      const criticalPolicyNames = ['Software Update', 'Security Update', 'Inventory Update'];
      for (const policy of policies) {
        if (criticalPolicyNames.some(name => policy.name?.toLowerCase().includes(name.toLowerCase()))) {
          try {
            const details = await this.getPolicyDetails(policy.id.toString());
            if (details.general?.enabled) {
              failedPolicies.push({
                id: policy.id,
                name: policy.name,
                category: details.general?.category?.name || 'Uncategorized',
                frequency: details.general?.frequency,
              });
            }
          } catch (err) {
            logger.info(`Failed to get policy details for ${policy.id}:`, err);
          }
        }
      }
      
      // Build compliance summary
      return {
        summary: {
          totalDevices: computers.length,
          compliantDevices: devicesCheckingInToday.length + devicesCheckingInThisWeek.length,
          nonCompliantDevices: devicesNotSeenThisWeek.length + devicesNotSeenThisMonth.length,
          complianceRate: (((devicesCheckingInToday.length + devicesCheckingInThisWeek.length) / computers.length) * 100).toFixed(1),
        },
        checkInStatus: {
          today: {
            count: devicesCheckingInToday.length,
            percentage: ((devicesCheckingInToday.length / computers.length) * 100).toFixed(1),
            devices: devicesCheckingInToday.slice(0, 10).map(d => ({
              id: d.id,
              name: d.name,
              lastContact: d.lastContactTime,
            })),
          },
          thisWeek: {
            count: devicesCheckingInThisWeek.length,
            percentage: ((devicesCheckingInThisWeek.length / computers.length) * 100).toFixed(1),
            devices: devicesCheckingInThisWeek.slice(0, 10).map(d => ({
              id: d.id,
              name: d.name,
              lastContact: d.lastContactTime,
            })),
          },
          notSeenThisWeek: {
            count: devicesNotSeenThisWeek.length,
            percentage: ((devicesNotSeenThisWeek.length / computers.length) * 100).toFixed(1),
            devices: devicesNotSeenThisWeek.slice(0, 10).map(d => ({
              id: d.id,
              name: d.name,
              lastContact: d.lastContactTime,
            })),
          },
          notSeenThisMonth: {
            count: devicesNotSeenThisMonth.length,
            percentage: ((devicesNotSeenThisMonth.length / computers.length) * 100).toFixed(1),
            devices: devicesNotSeenThisMonth.slice(0, 10).map(d => ({
              id: d.id,
              name: d.name,
              lastContact: d.lastContactTime,
            })),
          },
        },
        criticalPolicies: {
          monitored: failedPolicies.length,
          policies: failedPolicies,
          note: 'Full policy execution status would require access to policy logs',
        },
        recommendations: {
          immediate: devicesNotSeenThisMonth.length > 0 
            ? `${devicesNotSeenThisMonth.length} devices haven't checked in for over 30 days and may need attention`
            : null,
          warning: devicesNotSeenThisWeek.length > 0
            ? `${devicesNotSeenThisWeek.length} devices haven't checked in this week`
            : null,
        },
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.info('Failed to generate device compliance summary:', error);
      throw error;
    }
  }

  /**
   * Create an advanced computer search via Classic API
   */
  async createAdvancedComputerSearch(searchData: {
    name: string;
    criteria?: Array<{
      name: string;
      priority: number;
      and_or: 'and' | 'or';
      search_type: string;
      value: string;
    }>;
    display_fields?: string[];
  }): Promise<any> {
    if (this.readOnlyMode) {
      throw new Error('Cannot create advanced computer searches in read-only mode');
    }

    await this.ensureAuthenticated();

    // Default display fields to include comprehensive device information
    const defaultDisplayFields = [
      'Computer Name',
      'Last Check-in',
      'Last Inventory Update',
      'IP Address',
      'Serial Number',
      'Operating System Version',
      'Username',
      'Real Name',
      'Email Address',
      'Department',
      'Building',
      'Model',
      'Model Identifier',
      'Architecture Type',
      'Make',
      'Total RAM MB',
      'Managed',
      'Supervised',
      'MDM Capable'
    ];

    const displayFields = searchData.display_fields || defaultDisplayFields;

    // Build XML payload for the Classic API
    const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<advanced_computer_search>
  <name>${this.escapeXml(searchData.name)}</name>
  <view_as>Standard Web Page</view_as>
  <sort_1></sort_1>
  <sort_2></sort_2>
  <sort_3></sort_3>
  <criteria>
    ${searchData.criteria ? searchData.criteria.map(criterion => `
    <criterion>
      <name>${this.escapeXml(criterion.name)}</name>
      <priority>${criterion.priority}</priority>
      <and_or>${criterion.and_or}</and_or>
      <search_type>${this.escapeXml(criterion.search_type)}</search_type>
      <value>${this.escapeXml(criterion.value)}</value>
    </criterion>`).join('') : ''}
  </criteria>
  <display_fields>
    ${displayFields.map(field => `
    <display_field>
      <name>${this.escapeXml(field)}</name>
    </display_field>`).join('')}
  </display_fields>
</advanced_computer_search>`;

    try {
      logger.info(`Creating advanced computer search "${searchData.name}" via Classic API...`);
      
      const response = await this.axiosInstance.post(
        '/JSSResource/advancedcomputersearches/id/0',
        xmlPayload,
        {
          headers: {
            'Content-Type': 'application/xml',
            'Accept': 'application/xml',
          }
        }
      );

      // Extract the created search ID from the response
      // The Classic API typically returns the ID in the Location header or response body
      const locationHeader = response.headers.location;
      let searchId: string | null = null;

      if (locationHeader) {
        const match = locationHeader.match(/\/id\/(\d+)$/);
        if (match) {
          searchId = match[1];
        }
      }

      // If no ID in header, try to parse from response
      if (!searchId && response.data) {
        // Classic API might return XML response with the ID
        const idMatch = String(response.data).match(/<id>(\d+)<\/id>/);
        if (idMatch) {
          searchId = idMatch[1];
        }
      }

      if (searchId) {
        logger.info(`Successfully created advanced computer search with ID: ${searchId}`);
        // Fetch and return the full search details
        return await this.getAdvancedComputerSearchDetails(searchId);
      } else {
        // Return basic info if we couldn't get the ID
        return {
          name: searchData.name,
          message: 'Advanced computer search created successfully',
        };
      }
    } catch (error) {
      logger.info('Failed to create advanced computer search:', error);
      throw new Error(`Failed to create advanced computer search: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get advanced computer search details
   */
  async getAdvancedComputerSearchDetails(searchId: string): Promise<any> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axiosInstance.get(
        `/JSSResource/advancedcomputersearches/id/${searchId}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      return response.data.advanced_computer_search || response.data;
    } catch (error) {
      logger.info(`Failed to get advanced computer search ${searchId}:`, error);
      throw new Error(`Failed to get advanced computer search details: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Delete an advanced computer search
   */
  async deleteAdvancedComputerSearch(searchId: string): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot delete advanced computer searches in read-only mode');
    }
    
    await this.ensureAuthenticated();
    
    try {
      await this.axiosInstance.delete(`/JSSResource/advancedcomputersearches/id/${searchId}`);
      logger.info(`Successfully deleted advanced computer search ${searchId}`);
    } catch (error) {
      logger.info(`Failed to delete advanced computer search ${searchId}:`, error);
      throw new Error(`Failed to delete advanced computer search: ${getErrorMessage(error)}`);
    }
  }

  /**
   * List all advanced computer searches
   */
  async listAdvancedComputerSearches(): Promise<any[]> {
    await this.ensureAuthenticated();

    try {
      const response = await this.axiosInstance.get(
        '/JSSResource/advancedcomputersearches',
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      return response.data.advanced_computer_searches || [];
    } catch (error) {
      logger.info('Failed to list advanced computer searches:', error);
      throw new Error(`Failed to list advanced computer searches: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Ensure a compliance-specific advanced search exists
   * Creates one if it doesn't exist, returns the search ID
   */
  async ensureComplianceSearch(): Promise<string> {
    const COMPLIANCE_SEARCH_NAME = 'Device Compliance Check - MCP Generated';

    try {
      // First, check if the search already exists
      const searches = await this.listAdvancedComputerSearches();
      const existingSearch = searches.find(
        (search: any) => search.name === COMPLIANCE_SEARCH_NAME
      );

      if (existingSearch) {
        logger.info(`Found existing compliance search with ID: ${existingSearch.id}`);
        return existingSearch.id.toString();
      }

      // Create a new compliance search
      logger.info('Creating new compliance search...');
      
      const searchData = {
        name: COMPLIANCE_SEARCH_NAME,
        criteria: [
          {
            name: 'Last Check-in',
            priority: 0,
            and_or: 'and' as const,
            search_type: 'more than x days ago',
            value: '0', // This will return all computers
          }
        ],
        display_fields: [
          'Computer Name',
          'Last Check-in',
          'Last Inventory Update', 
          'IP Address',
          'Serial Number',
          'Operating System Version',
          'Username',
          'Real Name',
          'Email Address',
          'Department',
          'Building',
          'Model',
          'Managed',
          'Supervised',
          'MDM Capable',
          'Architecture Type',
          'Total RAM MB',
          'Available RAM Slots',
          'Battery Capacity',
          'Boot Drive Available MB',
          'Number of Processors',
          'Processor Speed MHz',
          'Processor Type'
        ]
      };

      const result = await this.createAdvancedComputerSearch(searchData);
      
      // Extract ID from result
      const searchId = result.id || result.search_id;
      if (!searchId) {
        throw new Error('Failed to get ID of created compliance search');
      }

      logger.info(`Successfully created compliance search with ID: ${searchId}`);
      return searchId.toString();
    } catch (error) {
      logger.info('Failed to ensure compliance search exists:', error);
      throw new Error(`Failed to ensure compliance search: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Helper method to escape XML special characters
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}