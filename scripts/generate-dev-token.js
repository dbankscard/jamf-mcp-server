#!/usr/bin/env node

/**
 * Generate a development JWT token for testing the MCP server
 * Usage: node generate-dev-token.js [secret]
 */

import jwt from 'jsonwebtoken';

// Get secret from command line or use default
const secret = process.argv[2] || 'development-secret-change-this';

// Token payload
const payload = {
  sub: 'dev-user-001',
  email: 'dev@jamf-mcp.local',
  name: 'Development User',
  scope: 'read:jamf write:jamf',
  permissions: ['read:jamf', 'write:jamf'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
};

// Generate token
const token = jwt.sign(payload, secret, {
  algorithm: 'HS256'
});

console.log('=================================');
console.log('Development JWT Token Generated');
console.log('=================================');
console.log('\nToken:');
console.log(token);
console.log('\nPayload:');
console.log(JSON.stringify(payload, null, 2));
console.log('\nUsage:');
console.log('Authorization: Bearer ' + token);
console.log('\nTest with curl:');
console.log(`curl -H "Authorization: Bearer ${token}" http://localhost:3000/health`);
console.log('\nNote: Make sure JWT_SECRET in your .env matches:', secret);
console.log('=================================');