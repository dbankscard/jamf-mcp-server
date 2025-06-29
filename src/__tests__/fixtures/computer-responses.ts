// Mock responses for Classic API (with date fields in general section)
export const mockClassicComputerSearchResponse = {
  computers: [
    {
      id: 1,
      name: 'MacBook-Pro-001',
      serial_number: 'C02ABC123DEF',
      udid: '12345678-1234-1234-1234-123456789012',
      mac_address: '00:11:22:33:44:55',
      alt_mac_address: '00:11:22:33:44:56',
      asset_tag: 'ASSET-001',
      bar_code_1: 'BC-001',
      bar_code_2: 'BC-002',
      username: 'jdoe',
      realname: 'John Doe',
      email: 'jdoe@example.com',
      email_address: 'jdoe@example.com',
      room: 'Room 101',
      position: 'Software Engineer',
      building_name: 'Main Building',
      department_name: 'Engineering',
      phone: '+1-555-0123',
      phone_number: '+1-555-0123',
      ip_address: '192.168.1.100',
      reported_ip_address: '192.168.1.100',
      last_contact_time: '2024-12-24 18:27:00',
      last_contact_time_utc: '2024-12-24T18:27:00.000+0000',
      last_contact_time_epoch: 1735074420000
    },
    {
      id: 2,
      name: 'MacBook-Air-002',
      serial_number: 'C02DEF456GHI',
      udid: '87654321-4321-4321-4321-210987654321',
      mac_address: '66:77:88:99:AA:BB',
      alt_mac_address: '66:77:88:99:AA:BC',
      asset_tag: 'ASSET-002',
      bar_code_1: 'BC-003',
      bar_code_2: 'BC-004',
      username: 'asmith',
      realname: 'Alice Smith',
      email: 'asmith@example.com',
      email_address: 'asmith@example.com',
      room: 'Room 202',
      position: 'Product Manager',
      building_name: 'Main Building',
      department_name: 'Product',
      phone: '+1-555-0456',
      phone_number: '+1-555-0456',
      ip_address: '192.168.1.101',
      reported_ip_address: '192.168.1.101',
      last_contact_time: '2024-12-23 14:30:00',
      last_contact_time_utc: '2024-12-23T14:30:00.000+0000',
      last_contact_time_epoch: 1734960600000
    }
  ]
};

export const mockClassicComputerDetailResponse = {
  computer: {
    general: {
      id: 1,
      name: 'MacBook-Pro-001',
      mac_address: '00:11:22:33:44:55',
      alt_mac_address: '00:11:22:33:44:56',
      ip_address: '192.168.1.100',
      serial_number: 'C02ABC123DEF',
      udid: '12345678-1234-1234-1234-123456789012',
      jamf_version: '10.42.0-t1234567890',
      platform: 'Mac',
      barcode_1: 'BC-001',
      barcode_2: 'BC-002',
      asset_tag: 'ASSET-001',
      remote_management: {
        managed: true,
        management_username: 'jamfadmin'
      },
      supervised: true,
      mdm_capable: true,
      mdm_capable_users: {
        mdm_capable_user: 'jdoe'
      },
      management_status: {
        enrolled_via_dep: true,
        user_approved_enrollment: true,
        user_approved_mdm: true
      },
      // Multiple date format fields
      report_date: '2024-12-24 18:27:00',
      report_date_utc: '2024-12-24T18:27:00.000+0000',
      report_date_epoch: 1735074420000,
      last_contact_time: '2024-12-24 18:27:00',
      last_contact_time_utc: '2024-12-24T18:27:00.000+0000',
      last_contact_time_epoch: 1735074420000,
      initial_entry_date: '2023-01-15',
      initial_entry_date_utc: '2023-01-15T10:30:00.000+0000',
      initial_entry_date_epoch: 1673778600000,
      last_cloud_backup_date_utc: '2024-12-20T03:00:00.000+0000',
      last_cloud_backup_date_epoch: 1734664800000,
      last_enrolled_date_utc: '2023-01-15T10:30:00.000+0000',
      last_enrolled_date_epoch: 1673778600000
    },
    hardware: {
      make: 'Apple',
      model: 'MacBook Pro (16-inch, 2021)',
      model_identifier: 'MacBookPro18,1',
      os_name: 'macOS',
      os_version: '14.2.1',
      os_build: '23C71',
      processor_type: 'Apple M1 Pro',
      processor_architecture: 'arm64',
      processor_speed: 3228,
      processor_speed_mhz: 3228,
      number_processors: 1,
      number_cores: 10,
      total_ram: 32768,
      total_ram_mb: 32768,
      boot_rom: '10151.61.2',
      bus_speed: 0,
      bus_speed_mhz: 0,
      battery_capacity: 95,
      cache_size: 0,
      cache_size_kb: 0,
      available_ram_slots: 0,
      optical_drive: '',
      nic_speed: '1000',
      smc_version: '',
      ble_capable: true,
      supports_ios_app_installs: true,
      apple_silicon: true,
      storage: [
        {
          disk: {
            device: 'disk0',
            model: 'APPLE SSD AP1024Q',
            revision: '717.120.',
            serial_number: 'ABC123DEF456',
            size: 1000240,
            drive_capacity_mb: 1000240,
            connection_type: 'NO',
            smart_status: 'Verified',
            partitions: [
              {
                partition: {
                  name: 'Macintosh HD',
                  size: 994662,
                  type: 'boot',
                  partition_capacity_mb: 994662,
                  percentage_full: 45,
                  available_mb: 547064,
                  filevault_status: 'Encrypted',
                  filevault_percent: 100,
                  filevault2_status: 'Encrypted',
                  filevault2_percent: 100,
                  boot_drive_available_space_mb: 547064
                }
              }
            ]
          }
        }
      ]
    },
    location: {
      username: 'jdoe',
      realname: 'John Doe',
      real_name: 'John Doe',
      email_address: 'jdoe@example.com',
      position: 'Software Engineer',
      phone: '+1-555-0123',
      phone_number: '+1-555-0123',
      department: 'Engineering',
      building: 'Main Building',
      room: 'Room 101'
    },
    purchasing: {
      is_purchased: true,
      is_leased: false,
      po_number: 'PO-2023-001',
      vendor: 'Apple Store',
      applecare_id: 'AC123456789',
      purchase_price: '2499.00',
      purchasing_account: 'IT Department',
      po_date: '2023-01-10',
      po_date_epoch: 1673308800000,
      po_date_utc: '2023-01-10T00:00:00.000+0000',
      warranty_expires: '2026-01-10',
      warranty_expires_epoch: 1767916800000,
      warranty_expires_utc: '2026-01-10T00:00:00.000+0000',
      lease_expires: '',
      lease_expires_epoch: 0,
      lease_expires_utc: '',
      life_expectancy: 48,
      purchasing_contact: 'procurement@example.com'
    },
    software: {
      applications: [
        {
          application: {
            name: 'Google Chrome.app',
            path: '/Applications/Google Chrome.app',
            version: '120.0.6099.129'
          }
        },
        {
          application: {
            name: 'Slack.app',
            path: '/Applications/Slack.app',
            version: '4.36.134'
          }
        },
        {
          application: {
            name: 'Visual Studio Code.app',
            path: '/Applications/Visual Studio Code.app',
            version: '1.85.1'
          }
        }
      ],
      fonts: [],
      plugins: []
    }
  }
};

// Mock responses for Modern API (v1)
export const mockModernComputerSearchResponse = {
  totalCount: 2,
  results: [
    {
      id: '1',
      name: 'MacBook-Pro-001',
      udid: '12345678-1234-1234-1234-123456789012',
      serialNumber: 'C02ABC123DEF',
      lastContactTime: '2024-12-24T18:27:00.000Z',
      lastReportDate: '2024-12-24T18:27:00.000Z',
      managementId: '12345678-1234-1234-1234-123456789012',
      platform: 'Mac',
      osVersion: '14.2.1',
      ipAddress: '192.168.1.100',
      macAddress: '00:11:22:33:44:55',
      assetTag: 'ASSET-001',
      modelIdentifier: 'MacBookPro18,1',
      mdmAccessRights: 4095,
      lastEnrolledDate: '2023-01-15T10:30:00.000Z',
      userApprovedMdm: true
    },
    {
      id: '2',
      name: 'MacBook-Air-002',
      udid: '87654321-4321-4321-4321-210987654321',
      serialNumber: 'C02DEF456GHI',
      lastContactTime: '2024-12-23T14:30:00.000Z',
      lastReportDate: '2024-12-23T14:30:00.000Z',
      managementId: '87654321-4321-4321-4321-210987654321',
      platform: 'Mac',
      osVersion: '14.2.0',
      ipAddress: '192.168.1.101',
      macAddress: '66:77:88:99:AA:BB',
      assetTag: 'ASSET-002',
      modelIdentifier: 'MacBookAir10,1',
      mdmAccessRights: 4095,
      lastEnrolledDate: '2023-02-20T15:45:00.000Z',
      userApprovedMdm: true
    }
  ]
};

export const mockModernComputerDetailResponse = {
  id: '1',
  name: 'MacBook-Pro-001',
  udid: '12345678-1234-1234-1234-123456789012',
  serialNumber: 'C02ABC123DEF',
  lastContactTime: '2024-12-24T18:27:00.000Z',
  lastReportDate: '2024-12-24T18:27:00.000Z',
  general: {
    name: 'MacBook-Pro-001',
    lastIpAddress: '192.168.1.100',
    lastReportedIp: '192.168.1.100',
    jamfBinaryVersion: '10.42.0',
    platform: 'Mac',
    barcode1: 'BC-001',
    barcode2: 'BC-002',
    assetTag: 'ASSET-001',
    remoteManagement: {
      managed: true,
      managementUsername: 'jamfadmin'
    },
    supervised: true,
    mdmCapable: {
      capable: true,
      capableUsers: ['jdoe']
    }
  },
  hardware: {
    make: 'Apple',
    model: 'MacBook Pro (16-inch, 2021)',
    modelIdentifier: 'MacBookPro18,1',
    osName: 'macOS',
    osVersion: '14.2.1',
    osBuild: '23C71',
    processorSpeedMhz: 3228,
    processorCount: 1,
    coreCount: 10,
    processorType: 'Apple M1 Pro',
    processorArchitecture: 'arm64',
    busSpeedMhz: 0,
    cacheSizeKilobytes: 0,
    networkAdapterType: 'Ethernet',
    macAddress: '00:11:22:33:44:55',
    altNetworkAdapterType: 'Wi-Fi',
    altMacAddress: '00:11:22:33:44:56',
    totalRamMegabytes: 32768,
    openRamSlots: 0,
    batteryCapacityPercent: 95,
    smcVersion: '',
    nicSpeed: '1000 Mb/s',
    opticalDrive: '',
    bootRom: '10151.61.2',
    bleCapable: true,
    supportsIosAppInstalls: true,
    appleSilicon: true,
    extensionAttributes: []
  },
  userAndLocation: {
    username: 'jdoe',
    realname: 'John Doe',
    email: 'jdoe@example.com',
    position: 'Software Engineer',
    phone: '+1-555-0123',
    departmentId: '1',
    buildingId: '1',
    room: 'Room 101'
  },
  storage: {
    bootDriveAvailableSpaceMegabytes: 547064,
    disks: [
      {
        id: 'disk0',
        device: 'disk0',
        model: 'APPLE SSD AP1024Q',
        revision: '717.120.',
        serialNumber: 'ABC123DEF456',
        sizeMegabytes: 1000240,
        smartStatus: 'Verified',
        type: 'SSD',
        partitions: [
          {
            name: 'Macintosh HD',
            sizeMegabytes: 994662,
            availableMegabytes: 547064,
            partitionType: 'APFS',
            percentUsed: 45,
            fileVault2State: 'Encrypted',
            fileVault2ProgressPercent: 100,
            lvgUuid: '',
            lvUuid: '',
            pvUuid: ''
          }
        ]
      }
    ]
  }
};

// Mock error responses
export const mockNotFoundResponse = {
  httpStatus: 404,
  errors: [
    {
      code: 'RESOURCE_NOT_FOUND',
      description: 'Computer not found',
      id: '0',
      field: null
    }
  ]
};

export const mockValidationErrorResponse = {
  httpStatus: 400,
  errors: [
    {
      code: 'INVALID_FIELD',
      description: 'Invalid search query',
      id: '0',
      field: 'query'
    }
  ]
};

// Mock compliance report data
export const mockComplianceReportData = {
  total: 10,
  compliant: 7,
  nonCompliant: 3,
  notReporting: 2,
  issues: [
    {
      computerId: '3',
      computerName: 'MacBook-Pro-003',
      issue: 'Not reporting',
      lastContact: '2024-11-20T10:30:00.000Z'
    },
    {
      computerId: '4',
      computerName: 'MacBook-Air-004',
      issue: 'Not reporting',
      lastContact: '2024-10-15T08:45:00.000Z'
    }
  ]
};