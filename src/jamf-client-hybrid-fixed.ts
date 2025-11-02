/**
 * Fixed Jamf API Client - Hybrid (Modern API + Classic API)
 * 
 * This enhanced client properly handles authentication for both APIs:
 * - Modern API: Uses Bearer tokens
 * - Classic API: Uses Basic authentication headers
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import https from 'https';

interface JamfConfig {
  baseUrl: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  readOnlyMode?: boolean;
}

interface AuthToken {
  token: string;
  expires: Date;
}

interface Computer {
  id: string;
  name: string;
  udid: string;
  serialNumber: string;
  lastContactTime?: string;
  lastReportDate?: string;
  osVersion?: string;
  ipAddress?: string;
  macAddress?: string;
  assetTag?: string;
  modelIdentifier?: string;
  model?: string;
  managementUsername?: string;
  lastEnrolledDate?: string;
  userAndLocation?: {
    username?: string;
    realName?: string;
    email?: string;
    position?: string;
    phone?: string;
    department?: string;
    building?: string;
    room?: string;
  };
}

export class JamfApiClientHybrid {
  private config: JamfConfig;
  private axiosInstance: AxiosInstance;
  private oauth2Token?: AuthToken;
  private bearerToken?: AuthToken;
  private basicAuthHeader?: string;
  
  // Auth availability flags
  private hasOAuth2: boolean;
  private hasBasicAuth: boolean;
  private oauth2Available: boolean = false;
  private bearerTokenAvailable: boolean = false;
  
  public readOnlyMode: boolean;

  constructor(config: JamfConfig) {
    this.config = config;
    this.readOnlyMode = config.readOnlyMode || false;
    
    // Check which auth methods are configured
    this.hasOAuth2 = !!(config.clientId && config.clientSecret);
    this.hasBasicAuth = !!(config.username && config.password);
    
    // Store Basic Auth header for Classic API
    if (this.hasBasicAuth) {
      this.basicAuthHeader = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`;
    }
    
    // Create axios instance with interceptor for dynamic auth
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    });
    
    // Add request interceptor to handle auth based on endpoint
    this.axiosInstance.interceptors.request.use((config) => {
      // Classic API endpoints need Basic auth
      if (config.url?.includes('/JSSResource/')) {
        if (this.basicAuthHeader) {
          config.headers['Authorization'] = this.basicAuthHeader;
        }
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
    
    console.error(`Jamf Hybrid Client initialized with:`);
    console.error(`  - OAuth2 (Client Credentials): ${this.hasOAuth2 ? 'Available' : 'Not configured'}`);
    console.error(`  - Basic Auth (Bearer Token): ${this.hasBasicAuth ? 'Available' : 'Not configured'}`);
  }

  /**
   * Ensure we have valid authentication
   */
  async ensureAuthenticated(): Promise<void> {
    // Try OAuth2 first if available
    if (this.hasOAuth2) {
      if (!this.oauth2Token || this.oauth2Token.expires < new Date()) {
        await this.getOAuth2Token();
      }
    }
    
    // Try Basic Auth to Bearer token if OAuth2 not available
    if (!this.oauth2Available && this.hasBasicAuth) {
      if (!this.bearerToken || this.bearerToken.expires < new Date()) {
        await this.getBearerTokenWithBasicAuth();
      }
    }
    
    // Ensure we have at least one valid auth method
    if (!this.oauth2Available && !this.bearerTokenAvailable && !this.hasBasicAuth) {
      throw new Error('No valid authentication method available');
    }
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
      const response = await axios.post(
        `${this.config.baseUrl}/api/v1/auth/token`,
        null,
        {
          headers: {
            'Authorization': this.basicAuthHeader!,
            'Accept': 'application/json',
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }
      );

      this.bearerToken = {
        token: response.data.token,
        expires: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes
      };
      
      this.bearerTokenAvailable = true;
      console.error('✅ Bearer token obtained using Basic Auth');
    } catch (error: any) {
      console.error('⚠️ Basic Auth to Bearer token failed:', error.message);
      this.bearerTokenAvailable = false;
    }
  }

  /**
   * Search for computers
   */
  async searchComputers(query: string = '', limit: number = 100): Promise<Computer[]> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      console.error('Searching computers using Modern API...');
      const params: any = {
        'page-size': limit,
      };
      
      // Only add filter if there's a query
      if (query && query.trim() !== '') {
        params.filter = `general.name=="*${query}*"`;
      }
      
      const response = await this.axiosInstance.get('/api/v1/computers-inventory', {
        params,
      });
      
      // Transform modern response
      return response.data.results.map((computer: any) => ({
        id: computer.id,
        name: computer.general?.name || '',
        udid: computer.udid,
        serialNumber: computer.general?.serialNumber || '',
        lastContactTime: computer.general?.lastContactTime,
        lastReportDate: computer.general?.reportDate,
        osVersion: computer.operatingSystem?.version,
        ipAddress: computer.general?.lastReportedIp || computer.general?.lastIpAddress,
        macAddress: computer.general?.macAddress,
        assetTag: computer.general?.assetTag,
        modelIdentifier: computer.hardware?.modelIdentifier,
      }));
    } catch (error: any) {
      console.error('Modern API search failed:', error.message);
    }
    
    // Try Classic API as fallback
    try {
      console.error('Searching computers using Classic API...');
      let url = '/JSSResource/computers';
      if (query && query.trim() !== '') {
        url = `/JSSResource/computers/match/*${query}*`;
      }
      
      const response = await this.axiosInstance.get(url, {
        headers: {
          'Accept': 'application/xml',
        }
      });
      
      // Parse XML response (simplified for now, would need proper XML parsing)
      const computers = this.parseClassicComputersXML(response.data);
      return computers.slice(0, limit);
    } catch (error: any) {
      console.error('Classic API search also failed:', error.message);
      throw new Error(`Failed to search computers: ${error.message}`);
    }
  }

  /**
   * Get detailed computer information
   */
  async getComputerDetails(deviceId: string): Promise<Computer> {
    await this.ensureAuthenticated();
    
    // Try Modern API first
    try {
      console.error(`Getting computer details for ${deviceId} using Modern API...`);
      const response = await this.axiosInstance.get(`/api/v1/computers-inventory/${deviceId}`);
      
      const computer = response.data;
      return {
        id: computer.id,
        name: computer.general?.name || '',
        udid: computer.udid,
        serialNumber: computer.general?.serialNumber || '',
        lastContactTime: computer.general?.lastContactTime,
        lastReportDate: computer.general?.reportDate,
        osVersion: computer.operatingSystem?.version,
        ipAddress: computer.general?.lastReportedIp || computer.general?.lastIpAddress,
        macAddress: computer.general?.macAddress,
        assetTag: computer.general?.assetTag,
        modelIdentifier: computer.hardware?.modelIdentifier,
        userAndLocation: computer.userAndLocation,
      };
    } catch (error: any) {
      console.error(`Modern API failed with status ${error.response?.status}, trying Classic API...`);
    }
    
    // Try Classic API
    try {
      console.error(`Getting computer details for ${deviceId} using Classic API...`);
      const response = await this.axiosInstance.get(`/JSSResource/computers/id/${deviceId}`, {
        headers: {
          'Accept': 'application/xml',
        }
      });
      
      // Parse XML response
      return this.parseClassicComputerXML(response.data);
    } catch (error: any) {
      throw new Error(`Failed to get computer details: ${error.message}`);
    }
  }

  /**
   * Parse Classic API XML response for computers list
   */
  private parseClassicComputersXML(xmlData: string): Computer[] {
    // This is a simplified parser - in production, use proper XML parser
    const computers: Computer[] = [];
    const computerMatches = xmlData.matchAll(/<computer>[\s\S]*?<\/computer>/g);
    
    for (const match of computerMatches) {
      const computerXml = match[0];
      computers.push({
        id: this.extractXMLValue(computerXml, 'id'),
        name: this.extractXMLValue(computerXml, 'name'),
        udid: this.extractXMLValue(computerXml, 'udid'),
        serialNumber: this.extractXMLValue(computerXml, 'serial_number'),
        macAddress: this.extractXMLValue(computerXml, 'mac_address'),
      });
    }
    
    return computers;
  }

  /**
   * Parse Classic API XML response for single computer
   */
  private parseClassicComputerXML(xmlData: string): Computer {
    return {
      id: this.extractXMLValue(xmlData, 'id'),
      name: this.extractXMLValue(xmlData, 'name'),
      udid: this.extractXMLValue(xmlData, 'udid'),
      serialNumber: this.extractXMLValue(xmlData, 'serial_number'),
      lastContactTime: this.extractXMLValue(xmlData, 'last_contact_time'),
      lastReportDate: this.extractXMLValue(xmlData, 'report_date'),
      osVersion: this.extractXMLValue(xmlData, 'os_version'),
      ipAddress: this.extractXMLValue(xmlData, 'last_reported_ip'),
      macAddress: this.extractXMLValue(xmlData, 'mac_address'),
      assetTag: this.extractXMLValue(xmlData, 'asset_tag'),
      modelIdentifier: this.extractXMLValue(xmlData, 'model_identifier'),
      userAndLocation: {
        username: this.extractXMLValue(xmlData, 'username'),
        realName: this.extractXMLValue(xmlData, 'real_name'),
        email: this.extractXMLValue(xmlData, 'email_address'),
        position: this.extractXMLValue(xmlData, 'position'),
        phone: this.extractXMLValue(xmlData, 'phone_number'),
        department: this.extractXMLValue(xmlData, 'department'),
        building: this.extractXMLValue(xmlData, 'building'),
        room: this.extractXMLValue(xmlData, 'room'),
      }
    };
  }

  /**
   * Extract value from XML
   */
  private extractXMLValue(xml: string, tag: string): string {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
    return match ? match[1] : '';
  }

  /**
   * Get all computers (limited for performance)
   */
  async getAllComputers(): Promise<Computer[]> {
    return this.searchComputers('', 500);
  }

  /**
   * Keep-alive method
   */
  async keepAlive(): Promise<void> {
    await this.ensureAuthenticated();
    
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
}