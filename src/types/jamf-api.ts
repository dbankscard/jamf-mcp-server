/**
 * Type definitions for Jamf Pro API responses
 */

// Device/Computer types
export interface JamfComputer {
  id: string | number;
  name: string;
  udid?: string;
  serialNumber?: string;
  serial_number?: string; // Classic API uses snake_case
  lastContactTime?: string;
  last_contact_time?: string; // Classic API
  lastReportDate?: string;
  report_date?: string; // Classic API
  osVersion?: string;
  os_version?: string; // Classic API
  ipAddress?: string;
  ip_address?: string; // Classic API
  macAddress?: string;
  mac_address?: string; // Classic API
  assetTag?: string;
  asset_tag?: string; // Classic API
  modelIdentifier?: string;
  model_identifier?: string; // Classic API
}

export interface JamfComputerDetails extends JamfComputer {
  general?: {
    name: string;
    serial_number?: string;
    udid?: string;
    last_contact_time?: string;
    last_contact_time_utc?: string;
    [key: string]: unknown;
  };
  userAndLocation?: JamfUserLocation;
  hardware?: {
    modelIdentifier?: string;
    model?: string;
    [key: string]: unknown;
  };
  operatingSystem?: {
    version?: string;
    build?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface JamfUserLocation {
  username?: string;
  realName?: string;
  realname?: string; // Alternative casing
  email?: string;
  phone?: string;
  department?: string;
  building?: string;
  room?: string;
}

// Policy types
export interface JamfPolicy {
  id: string | number;
  name: string;
  category?: string;
  enabled?: boolean;
  frequency?: string;
  scope?: JamfScope;
  [key: string]: unknown;
}

export interface JamfScope {
  all_computers?: boolean;
  computer_ids?: (string | number)[];
  computer_group_ids?: (string | number)[];
  building_ids?: (string | number)[];
  department_ids?: (string | number)[];
}

// Script types
export interface JamfScript {
  id: string | number;
  name: string;
  category?: string;
  filename?: string;
  priority?: string;
  parameters?: Record<string, string>;
  [key: string]: unknown;
}

// Profile types
export interface JamfConfigurationProfile {
  id: string | number;
  name: string;
  category?: string;
  level?: string;
  distribution_method?: string;
  payloads?: string;
  [key: string]: unknown;
}

// Package types
export interface JamfPackage {
  id: string | number;
  name: string;
  category?: string;
  filename?: string;
  size?: number;
  priority?: number;
  fill_user_template?: boolean;
  [key: string]: unknown;
}

// API Response types
export interface JamfApiResponse<T> {
  data?: T;
  results?: T[];
  totalCount?: number;
  error?: string;
  [key: string]: unknown;
}

export interface JamfSearchResponse {
  computers?: JamfComputer[];
  mobiledevices?: JamfMobileDevice[];
  [key: string]: unknown;
}

export interface JamfMobileDevice {
  id: string | number;
  name: string;
  device_name?: string;
  udid?: string;
  serial_number?: string;
  model?: string;
  os_version?: string;
  managed?: boolean;
  [key: string]: unknown;
}

// Advanced Search types
export interface JamfAdvancedSearch {
  id: string | number;
  name: string;
  criteria?: JamfSearchCriteria[];
  display_fields?: string[];
  sort?: string[];
}

export interface JamfSearchCriteria {
  name: string;
  priority?: number;
  and_or?: 'and' | 'or';
  search_type?: string;
  value?: string;
  opening_paren?: boolean;
  closing_paren?: boolean;
}

// Group types
export interface JamfComputerGroup {
  id: string | number;
  name: string;
  is_smart?: boolean;
  criteria?: JamfSearchCriteria[];
  computers?: JamfComputer[];
}

export interface JamfMobileDeviceGroup {
  id: string | number;
  name: string;
  is_smart?: boolean;
  criteria?: JamfSearchCriteria[];
  mobile_devices?: JamfMobileDevice[];
}