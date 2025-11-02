#!/usr/bin/env node
/**
 * Main entry point that selects between regular and enhanced modes
 * based on environment configuration
 */

// Check if enhanced mode is enabled
const USE_ENHANCED_MODE = 
  process.env.JAMF_USE_ENHANCED_MODE === 'true' ||
  process.env.JAMF_ENABLE_RETRY === 'true' ||
  process.env.JAMF_ENABLE_RATE_LIMITING === 'true' ||
  process.env.JAMF_ENABLE_CIRCUIT_BREAKER === 'true';

// Check for enhanced-mode specific requirements
if (USE_ENHANCED_MODE) {
  // Enhanced mode requires OAuth2
  if (!process.env.JAMF_CLIENT_ID || !process.env.JAMF_CLIENT_SECRET) {
    // MCP servers must not output to stdout/stderr
    // Exit silently with error code
    process.exit(1);
  }

  // Load and run enhanced version
  import('./index-enhanced.js').then(module => {
    // Module will auto-execute
  }).catch(error => {
    // MCP servers must not output to stdout/stderr
    process.exit(1);
  });
} else {
  // Load and run regular version
  import('./index.js').then(module => {
    // Module will auto-execute
  }).catch(error => {
    // MCP servers must not output to stdout/stderr
    process.exit(1);
  });
}

export {};