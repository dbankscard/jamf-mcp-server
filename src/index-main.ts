#!/usr/bin/env node
/**
 * Main entry point that selects between regular and enhanced modes
 * based on environment configuration
 */

// Check if code mode is enabled
const USE_CODE_MODE = process.env.JAMF_CODE_MODE === 'true';

// Check if enhanced mode is enabled
const USE_ENHANCED_MODE =
  process.env.JAMF_USE_ENHANCED_MODE === 'true' ||
  process.env.JAMF_ENABLE_RETRY === 'true' ||
  process.env.JAMF_ENABLE_RATE_LIMITING === 'true' ||
  process.env.JAMF_ENABLE_CIRCUIT_BREAKER === 'true';

// Code mode: 2 tools (jamf_search + jamf_execute) instead of 108
if (USE_CODE_MODE) {
  import('./index-code.js').then(_module => {
    // Module will auto-execute
  }).catch(_error => {
    // MCP servers must not output to stdout/stderr
    process.exit(1);
  });
} else if (USE_ENHANCED_MODE) {
  // Enhanced mode requires OAuth2
  if (!process.env.JAMF_CLIENT_ID || !process.env.JAMF_CLIENT_SECRET) {
    // MCP servers must not output to stdout/stderr
    // Exit silently with error code
    process.exit(1);
  }

  // Load and run enhanced version
  import('./index-enhanced.js').then(_module => {
    // Module will auto-execute
  }).catch(_error => {
    // MCP servers must not output to stdout/stderr
    process.exit(1);
  });
} else {
  // Load and run regular version
  import('./index.js').then(_module => {
    // Module will auto-execute
  }).catch(_error => {
    // MCP servers must not output to stdout/stderr
    process.exit(1);
  });
}

export {};