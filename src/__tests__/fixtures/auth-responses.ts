export const mockAuthTokenResponse = {
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdXRoZW50aWNhdGVkLWFwcCI6IkdFTkVSSUMiLCJhdXRoZW50aWNhdGlvbi10eXBlIjoiSlNTIiwiZ3JvdXBzIjpbXSwic3ViamVjdC10eXBlIjoiSlNTX1VTRVJfSUQiLCJ0b2tlbi11dWlkIjoiMTIzNDU2NzgtMTIzNC0xMjM0LTEyMzQtMTIzNDU2Nzg5MDEyIiwibGRhcC1zZXJ2ZXItaWQiOi0xLCJzdWIiOiIxIiwiZXhwIjoxNzM1MDc0NDIwfQ.mock-signature',
  expires: '2024-12-25T00:00:00.000Z'
};

export const mockKeepAliveResponse = {
  message: 'Token extended successfully'
};

export const mockAuthErrorResponse = {
  httpStatus: 401,
  errors: [
    {
      code: 'INVALID_CREDENTIALS',
      description: 'Username and password do not match',
      id: '0',
      field: null
    }
  ]
};

export const mockTokenExpiredResponse = {
  httpStatus: 401,
  errors: [
    {
      code: 'TOKEN_EXPIRED',
      description: 'Token has expired',
      id: '0',
      field: null
    }
  ]
};