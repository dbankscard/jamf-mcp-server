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

// Date parsing utilities
export function parseJamfDate(dateValue: any): Date | null {
  if (!dateValue) return null;
  
  // Handle epoch timestamps
  if (typeof dateValue === 'number') {
    // Jamf epoch timestamps are sometimes in seconds, sometimes in milliseconds
    const timestamp = dateValue > 1e10 ? dateValue : dateValue * 1000;
    return new Date(timestamp);
  }
  
  // Handle string dates
  if (typeof dateValue === 'string') {
    try {
      // Try ISO format first
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) return date;
      
      // Try common Jamf date formats
      // Format: "2023-12-25 14:30:00" - assume UTC
      const jamfFormat = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/;
      const match = dateValue.match(jamfFormat);
      if (match) {
        // Append 'Z' to indicate UTC time
        return new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  return null;
}

export function formatDateForJamf(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

// Classic API Computer Schema - Made more flexible
const ClassicComputerSchema = z.object({
  id: z.number(),
  name: z.string(),
  serial_number: z.string().optional(),
  udid: z.string().optional(),
  mac_address: z.string().optional(),
  alt_mac_address: z.string().optional(),
  asset_tag: z.string().optional(),
  bar_code_1: z.string().optional(),
  bar_code_2: z.string().optional(),
  username: z.string().optional(),
  realname: z.string().optional(),
  email: z.string().optional(),
  email_address: z.string().optional(),
  room: z.string().optional(),
  position: z.string().optional(),
  building_name: z.string().optional(),
  department_name: z.string().optional(),
  phone: z.string().optional(),
  phone_number: z.string().optional(),
  ip_address: z.string().optional(),
  reported_ip_address: z.string().optional(),
  last_contact_time: z.any().optional(), // Flexible date handling
  last_contact_time_utc: z.any().optional(),
  last_contact_time_epoch: z.any().optional(), // Can be number or string
}).passthrough(); // Allow additional fields from different Jamf versions

// More flexible ClassicComputerDetailSchema using z.any() for problematic fields
const ClassicComputerDetailSchema = z.object({
  general: z.object({
    id: z.number(),
    name: z.string(),
    mac_address: z.string().optional(),
    alt_mac_address: z.string().optional(),
    ip_address: z.string().optional(),
    serial_number: z.string().optional(),
    udid: z.string().optional(),
    jamf_version: z.string().optional(),
    platform: z.string().optional(),
    barcode_1: z.string().optional(),
    barcode_2: z.string().optional(),
    asset_tag: z.string().optional(),
    remote_management: z.any().optional(), // More flexible for various formats
    supervised: z.any().optional(), // Can be boolean or string
    mdm_capable: z.any().optional(), // Can be boolean or string
    report_date: z.any().optional(), // Flexible date handling
    report_date_utc: z.any().optional(),
    report_date_epoch: z.any().optional(),
    last_contact_time: z.any().optional(),
    last_contact_time_utc: z.any().optional(),
    last_contact_time_epoch: z.any().optional(),
  }).passthrough(), // Allow additional fields
  hardware: z.object({
    make: z.string().optional(),
    model: z.string().optional(),
    model_identifier: z.string().optional(),
    os_name: z.string().optional(),
    os_version: z.string().optional(),
    os_build: z.string().optional(),
    processor_type: z.string().optional(),
    processor_architecture: z.string().optional(),
    processor_speed_mhz: z.any().optional(), // Can be number or string
    number_processors: z.any().optional(),
    number_cores: z.any().optional(),
    total_ram: z.any().optional(),
    boot_rom: z.string().optional(),
    bus_speed: z.any().optional(),
    battery_capacity: z.any().optional(),
    cache_size: z.any().optional(),
    available_ram_slots: z.any().optional(),
    optical_drive: z.string().optional(),
    nic_speed: z.string().optional(),
    smc_version: z.string().optional(),
    ble_capable: z.any().optional(),
    supports_ios_app_installs: z.any().optional(),
    apple_silicon: z.any().optional(),
    storage: z.any().optional(), // Very flexible for complex storage formats
  }).passthrough().optional(),
  location: z.object({
    username: z.string().optional(),
    realname: z.string().optional(),
    real_name: z.string().optional(),
    email_address: z.string().optional(),
    position: z.string().optional(),
    phone: z.string().optional(),
    phone_number: z.string().optional(),
    department: z.string().optional(),
    building: z.string().optional(),
    room: z.string().optional(),
  }).passthrough().optional(),
  // Allow any additional sections that might be present
}).passthrough();

export type Computer = z.infer<typeof ClassicComputerSchema>;
export type ComputerDetail = z.infer<typeof ClassicComputerDetailSchema>;

export class JamfApiClientClassic {
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

  async getAllComputers(): Promise<Computer[]> {
    try {
      // Use Classic API endpoint to get all computers without pagination
      const response = await this.axios.get('/JSSResource/computers');
      const computers = response.data.computers || [];
      
      // Parse each computer, handling errors gracefully
      const parsedComputers: Computer[] = [];
      for (const computer of computers) {
        try {
          parsedComputers.push(ClassicComputerSchema.parse(computer));
        } catch (parseError) {
          console.warn(`Failed to parse computer ${computer.id || 'unknown'}:`, parseError);
          // Add raw data with minimal transformation
          parsedComputers.push({
            id: computer.id || 0,
            name: computer.name || 'Unknown',
            serial_number: computer.serial_number,
            udid: computer.udid,
            mac_address: computer.mac_address,
            ...computer
          } as Computer);
        }
      }
      
      // Log to stderr instead of stdout to avoid breaking JSON output
      console.error(`Fetched ${parsedComputers.length} computers from Jamf`);
      return parsedComputers;
    } catch (error) {
      console.error('Failed to get all computers:', error);
      throw error;
    }
  }

  async searchComputers(query: string, limit: number = 100): Promise<Computer[]> {
    try {
      // Use Classic API endpoint
      const response = await this.axios.get('/JSSResource/computers');
      
      let computers = response.data.computers || [];
      
      // Filter based on query if provided
      if (query) {
        const lowerQuery = query.toLowerCase();
        computers = computers.filter((c: any) => 
          c.name?.toLowerCase().includes(lowerQuery) ||
          c.serial_number?.toLowerCase().includes(lowerQuery) ||
          c.mac_address?.toLowerCase().includes(lowerQuery) ||
          c.username?.toLowerCase().includes(lowerQuery) ||
          c.email_address?.toLowerCase().includes(lowerQuery) ||
          c.ip_address?.includes(query)
        );
      }
      
      // Limit results
      computers = computers.slice(0, limit);
      
      // Parse each computer with error handling
      const parsedComputers: Computer[] = [];
      for (const computer of computers) {
        try {
          parsedComputers.push(ClassicComputerSchema.parse(computer));
        } catch (parseError) {
          console.warn(`Failed to parse computer in search results:`, parseError);
          // Add raw data with minimal transformation
          parsedComputers.push({
            id: computer.id || 0,
            name: computer.name || 'Unknown',
            serial_number: computer.serial_number,
            udid: computer.udid,
            mac_address: computer.mac_address,
            ...computer
          } as Computer);
        }
      }
      
      return parsedComputers;
    } catch (error) {
      console.error('Failed to search computers:', error);
      throw error;
    }
  }

  async getComputerDetails(id: string): Promise<ComputerDetail | any> {
    try {
      const response = await this.axios.get(`/JSSResource/computers/id/${id}`);
      const computerData = response.data.computer;
      
      try {
        // Try to parse with schema first
        return ClassicComputerDetailSchema.parse(computerData);
      } catch (parseError) {
        // If parsing fails, log the error but return the raw data
        console.warn(`Schema parsing failed for computer ${id}, returning raw data:`, parseError);
        console.debug('Raw data:', JSON.stringify(computerData, null, 2));
        return computerData;
      }
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
      // Classic API uses different endpoint
      for (const deviceId of deviceIds) {
        await this.axios.post(`/JSSResource/computercommands/command/PolicyEventTrigger`, {
          computer_id: deviceId,
          policy_id: policyId,
        });
      }
    } catch (error) {
      console.error('Failed to execute policy:', error);
      throw error;
    }
  }

  async updateInventory(deviceId: string): Promise<void> {
    if (this.readOnlyMode) {
      console.error('Skipping inventory update in read-only mode');
      return;
    }

    try {
      // Use computer command to update inventory
      await this.axios.post(`/JSSResource/computercommands/command/UpdateInventory`, {
        computer_id: deviceId,
      });
      console.error(`Inventory update requested for device ${deviceId}`);
    } catch (error) {
      console.error('Failed to update inventory:', error);
      throw error;
    }
  }

  async getComplianceReport(days: number = 30): Promise<any> {
    try {
      const response = await this.axios.get('/JSSResource/computers');
      const computers = response.data.computers || [];
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const compliance = {
        total: computers.length,
        compliant: 0,
        nonCompliant: 0,
        notReporting: 0,
        issues: [] as any[],
      };

      for (const computer of computers) {
        // Use the flexible date parsing utility
        const lastContact = parseJamfDate(
          computer.last_contact_time_epoch || 
          computer.last_contact_time || 
          computer.last_contact_time_utc
        );
        
        if (!lastContact || lastContact < cutoffDate) {
          compliance.notReporting++;
          compliance.issues.push({
            computerId: computer.id,
            computerName: computer.name || 'Unknown',
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

  // Keep other methods for compatibility but implement with Classic API
  async deployScript(scriptId: string, deviceIds: string[]): Promise<void> {
    if (this.readOnlyMode) {
      throw new Error('Cannot deploy scripts in read-only mode');
    }

    // Note: Classic API script deployment is more complex
    // This would need custom implementation based on your Jamf setup
    throw new Error('Script deployment not implemented for Classic API');
  }

  async keepAlive(): Promise<void> {
    // OAuth2 doesn't support keep-alive, must request new token
    // Force re-authentication by clearing current token
    this.authToken = null;
    await this.ensureAuthenticated();
  }

  // Policy-related methods
  async listPolicies(limit: number = 100): Promise<any[]> {
    try {
      const response = await this.axios.get('/JSSResource/policies');
      const policies = response.data.policies || [];
      
      // Limit results
      return policies.slice(0, limit);
    } catch (error) {
      console.error('Failed to list policies:', error);
      throw error;
    }
  }

  async getPolicyDetails(policyId: string): Promise<any> {
    try {
      const response = await this.axios.get(`/JSSResource/policies/id/${policyId}`);
      const policy = response.data.policy;
      
      return {
        id: policy.id,
        name: policy.general?.name,
        enabled: policy.general?.enabled,
        category: policy.general?.category?.name,
        frequency: policy.general?.frequency,
        trigger: policy.general?.trigger,
        triggerCheckin: policy.general?.trigger_checkin,
        triggerEnrollment: policy.general?.trigger_enrollment,
        triggerLogin: policy.general?.trigger_login,
        triggerStartup: policy.general?.trigger_startup,
        scope: {
          allComputers: policy.scope?.all_computers,
          computers: policy.scope?.computers,
          computerGroups: policy.scope?.computer_groups,
          buildings: policy.scope?.buildings,
          departments: policy.scope?.departments,
          limitations: policy.scope?.limitations,
          exclusions: policy.scope?.exclusions,
        },
        scripts: policy.scripts?.map((s: any) => ({
          id: s.id,
          name: s.name,
          priority: s.priority,
          parameter4: s.parameter4,
          parameter5: s.parameter5,
          parameter6: s.parameter6,
          parameter7: s.parameter7,
          parameter8: s.parameter8,
          parameter9: s.parameter9,
          parameter10: s.parameter10,
          parameter11: s.parameter11,
        })),
        packages: policy.package_configuration?.packages?.map((p: any) => ({
          id: p.id,
          name: p.name,
          action: p.action,
          fillUserTemplate: p.fill_user_template,
          fillExistingUsers: p.fill_existing_users,
        })),
        files: policy.files_processes,
        userInteraction: {
          messageStart: policy.user_interaction?.message_start,
          messageFinish: policy.user_interaction?.message_finish,
          allowDeferral: policy.user_interaction?.allow_users_to_defer,
          deferralType: policy.user_interaction?.allow_deferral_until_utc,
        },
        reboot: {
          message: policy.reboot?.message,
          startupDisk: policy.reboot?.startup_disk,
          specifyStartup: policy.reboot?.specify_startup,
          noUserLoggedIn: policy.reboot?.no_user_logged_in,
          userLoggedIn: policy.reboot?.user_logged_in,
          minutes: policy.reboot?.minutes_until_reboot,
        },
      };
    } catch (error) {
      console.error(`Failed to get policy details for ${policyId}:`, error);
      throw error;
    }
  }

  async searchPolicies(query: string, limit: number = 50): Promise<any[]> {
    try {
      const response = await this.axios.get('/JSSResource/policies');
      let policies = response.data.policies || [];
      
      // Filter based on query
      if (query) {
        const lowerQuery = query.toLowerCase();
        policies = policies.filter((p: any) => 
          p.name?.toLowerCase().includes(lowerQuery) ||
          p.id?.toString().includes(query)
        );
      }
      
      // Get details for each policy to include category in search
      const detailedPolicies = [];
      for (const policy of policies.slice(0, limit)) {
        try {
          const details = await this.getPolicyDetails(policy.id.toString());
          detailedPolicies.push({
            id: policy.id,
            name: policy.name,
            category: details.category,
            enabled: details.enabled,
            frequency: details.frequency,
          });
        } catch (error) {
          // Include basic info even if details fail
          detailedPolicies.push(policy);
        }
      }
      
      return detailedPolicies;
    } catch (error) {
      console.error('Failed to search policies:', error);
      throw error;
    }
  }
}