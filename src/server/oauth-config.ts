import { Request, Response } from 'express';

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
  redirectUri: string;
}

// OAuth configuration for different providers
export const getOAuthConfig = (provider: string): OAuthConfig => {
  const baseUrl = process.env.OAUTH_BASE_URL || `https://${process.env.AUTH0_DOMAIN}`;
  const redirectUri = process.env.OAUTH_REDIRECT_URI || 'https://chatgpt.com/auth/callback';

  switch (provider) {
    case 'auth0':
      return {
        clientId: process.env.AUTH0_CLIENT_ID!,
        clientSecret: process.env.AUTH0_CLIENT_SECRET!,
        authorizationUrl: `${baseUrl}/authorize`,
        tokenUrl: `${baseUrl}/oauth/token`,
        scope: 'openid profile email offline_access',
        redirectUri,
      };
    
    case 'okta':
      return {
        clientId: process.env.OKTA_CLIENT_ID!,
        clientSecret: process.env.OKTA_CLIENT_SECRET!,
        authorizationUrl: `${process.env.OKTA_DOMAIN}/oauth2/default/v1/authorize`,
        tokenUrl: `${process.env.OKTA_DOMAIN}/oauth2/default/v1/token`,
        scope: 'openid profile email offline_access',
        redirectUri,
      };
    
    default:
      throw new Error(`Unsupported OAuth provider: ${provider}`);
  }
};

// OAuth endpoints for ChatGPT connector
export const handleOAuthAuthorize = (req: Request, res: Response) => {
  const provider = process.env.OAUTH_PROVIDER || 'auth0';
  const config = getOAuthConfig(provider);
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state: req.query.state as string || '',
  });

  const authUrl = `${config.authorizationUrl}?${params.toString()}`;
  res.redirect(authUrl);
};

export const handleOAuthCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  const provider = process.env.OAUTH_PROVIDER || 'auth0';
  const config = getOAuthConfig(provider);

  try {
    // Exchange code for token
    const tokenResponse = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code as string,
        redirect_uri: config.redirectUri,
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      throw new Error(tokens.error_description || 'Token exchange failed');
    }

    // Return tokens to ChatGPT
    // ChatGPT expects the tokens in a specific format
    res.json({
      access_token: tokens.access_token,
      token_type: 'Bearer',
      expires_in: tokens.expires_in || 3600,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope || config.scope,
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      error: 'OAuth callback failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};