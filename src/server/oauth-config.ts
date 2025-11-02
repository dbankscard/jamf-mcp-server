import { Request, Response } from 'express';
import crypto from 'crypto';
import { createLogger } from './logger.js';

const logger = createLogger('oauth-config');

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
  redirectUri: string;
  responseMode?: string;
}

// State store for CSRF protection (in production, use Redis or similar)
const stateStore = new Map<string, { timestamp: number; originalState?: string }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 600000) { // 10 minutes
      stateStore.delete(state);
    }
  }
}, 300000);

// Validate environment configuration
const validateOAuthConfig = (provider: string): void => {
  switch (provider) {
    case 'auth0':
      if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID || !process.env.AUTH0_CLIENT_SECRET) {
        throw new Error('Missing required Auth0 configuration');
      }
      break;
    case 'okta':
      if (!process.env.OKTA_DOMAIN || !process.env.OKTA_CLIENT_ID || !process.env.OKTA_CLIENT_SECRET) {
        throw new Error('Missing required Okta configuration');
      }
      break;
    case 'dev':
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('Dev OAuth provider only available in development');
      }
      break;
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
};

// OAuth configuration for different providers
export const getOAuthConfig = (provider: string): OAuthConfig => {
  validateOAuthConfig(provider);
  
  const redirectUri = process.env.OAUTH_REDIRECT_URI || 'https://chatgpt.com/auth/callback';

  switch (provider) {
    case 'auth0': {
      const domain = process.env.AUTH0_DOMAIN!;
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      return {
        clientId: process.env.AUTH0_CLIENT_ID!,
        clientSecret: process.env.AUTH0_CLIENT_SECRET!,
        authorizationUrl: `${baseUrl}/authorize`,
        tokenUrl: `${baseUrl}/oauth/token`,
        scope: process.env.AUTH0_SCOPE || 'openid profile email offline_access',
        redirectUri,
        responseMode: 'query',
      };
    }
    
    case 'okta': {
      const domain = process.env.OKTA_DOMAIN!;
      const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
      const authServer = baseUrl.includes('oauth2') ? baseUrl : `${baseUrl}/oauth2/default`;
      return {
        clientId: process.env.OKTA_CLIENT_ID!,
        clientSecret: process.env.OKTA_CLIENT_SECRET!,
        authorizationUrl: `${authServer}/v1/authorize`,
        tokenUrl: `${authServer}/v1/token`,
        scope: process.env.OKTA_SCOPE || 'openid profile email offline_access',
        redirectUri,
        responseMode: 'query',
      };
    }
    
    case 'dev':
      // Simple dev mode for testing
      return {
        clientId: 'dev-client',
        clientSecret: 'dev-secret',
        authorizationUrl: '/auth/dev/authorize',
        tokenUrl: '/auth/dev/token',
        scope: 'openid profile email',
        redirectUri,
      };
    
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
};

// Generate secure random state
const generateState = (): string => {
  return crypto.randomBytes(32).toString('base64url');
};

// OAuth authorization endpoint
export const handleOAuthAuthorize = (req: Request, res: Response): void => {
  try {
    const provider = process.env.OAUTH_PROVIDER || 'auth0';
    const config = getOAuthConfig(provider);
    
    // Generate and store state for CSRF protection
    const state = generateState();
    const originalState = req.query.state as string;
    
    stateStore.set(state, {
      timestamp: Date.now(),
      originalState,
    });
    
    // Build authorization URL with proper encoding
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      state,
    });
    
    // Add response_mode if specified
    if (config.responseMode) {
      params.append('response_mode', config.responseMode);
    }
    
    // Add any additional parameters from the request
    const allowedParams = ['prompt', 'login_hint', 'access_type'];
    for (const param of allowedParams) {
      if (req.query[param]) {
        params.append(param, req.query[param] as string);
      }
    }

    const authUrl = `${config.authorizationUrl}?${params.toString()}`;
    
    logger.info('Redirecting to OAuth provider', {
      provider,
      redirectUri: config.redirectUri,
      state: state.substring(0, 8) + '...',
    });
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('OAuth authorize error:', error);
    res.status(500).json({
      error: 'Authorization initialization failed',
      message: process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.message
        : 'Unable to start authorization flow',
    });
  }
};

// OAuth callback handler
export const handleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error, error_description } = req.query;
    
    // Handle OAuth errors
    if (error) {
      logger.warn('OAuth provider returned error', { error, error_description });
      res.status(400).json({
        error: error as string,
        error_description: error_description as string,
      });
      return;
    }
    
    // Validate required parameters
    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Missing authorization code' });
      return;
    }
    
    if (!state || typeof state !== 'string') {
      res.status(400).json({ error: 'Missing state parameter' });
      return;
    }
    
    // Verify state for CSRF protection
    const stateData = stateStore.get(state);
    if (!stateData) {
      logger.warn('Invalid or expired state', { state: state.substring(0, 8) + '...' });
      res.status(400).json({ error: 'Invalid or expired state' });
      return;
    }
    
    // Remove used state
    stateStore.delete(state);
    
    const provider = process.env.OAUTH_PROVIDER || 'auth0';
    const config = getOAuthConfig(provider);

    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
    });

    logger.info('Exchanging code for tokens', { provider });

    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });

    const responseText = await tokenResponse.text();
    let tokens: any;
    
    try {
      tokens = JSON.parse(responseText);
    } catch (e) {
      logger.error('Failed to parse token response', { response: responseText });
      throw new Error('Invalid response from OAuth provider');
    }

    if (!tokenResponse.ok) {
      logger.error('Token exchange failed', {
        status: tokenResponse.status,
        error: tokens.error,
        error_description: tokens.error_description,
      });
      throw new Error(tokens.error_description || tokens.error || 'Token exchange failed');
    }

    // Validate token response
    if (!tokens.access_token) {
      throw new Error('No access token in response');
    }

    // Log successful token exchange
    logger.info('Token exchange successful', {
      provider,
      has_refresh_token: !!tokens.refresh_token,
      expires_in: tokens.expires_in,
    });

    // Return tokens in ChatGPT expected format
    const response = {
      access_token: tokens.access_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in || 3600,
      scope: tokens.scope || config.scope,
    };

    // Include refresh token if present
    if (tokens.refresh_token) {
      (response as any).refresh_token = tokens.refresh_token;
    }

    // Include original state if it was provided
    if (stateData.originalState) {
      (response as any).state = stateData.originalState;
    }

    res.json(response);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    
    // Don't expose internal errors in production
    const errorMessage = process.env.NODE_ENV === 'development' && error instanceof Error
      ? error.message
      : 'OAuth callback failed';
    
    res.status(500).json({ 
      error: 'OAuth callback failed',
      message: errorMessage,
    });
  }
};

// Token refresh handler
export const handleTokenRefresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      res.status(400).json({ error: 'Missing refresh token' });
      return;
    }
    
    const provider = process.env.OAUTH_PROVIDER || 'auth0';
    const config = getOAuthConfig(provider);
    
    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token,
    });
    
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: tokenParams.toString(),
    });
    
    const tokens = await tokenResponse.json() as any;
    
    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || tokens.error || 'Token refresh failed');
    }
    
    res.json({
      access_token: tokens.access_token,
      token_type: tokens.token_type || 'Bearer',
      expires_in: tokens.expires_in || 3600,
      scope: tokens.scope || config.scope,
      refresh_token: tokens.refresh_token || refresh_token,
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ 
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};