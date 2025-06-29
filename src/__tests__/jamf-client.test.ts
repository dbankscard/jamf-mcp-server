import { JamfApiClient } from '../jamf-client.js';

describe('JamfApiClient', () => {
  let client: JamfApiClient;

  beforeEach(() => {
    client = new JamfApiClient({
      baseUrl: 'https://test.jamfcloud.com',
      username: 'testuser',
      password: 'testpass',
      readOnlyMode: true,
    });
  });

  describe('Read-only mode', () => {
    it('should throw error when executing policy in read-only mode', async () => {
      await expect(client.executePolicy('123', ['device1'])).rejects.toThrow(
        'Cannot execute policies in read-only mode'
      );
    });

    it('should throw error when deploying script in read-only mode', async () => {
      await expect(client.deployScript('123', ['device1'])).rejects.toThrow(
        'Cannot deploy scripts in read-only mode'
      );
    });

    it('should throw error when updating inventory in read-only mode', async () => {
      await expect(client.updateInventory('device1')).rejects.toThrow(
        'Cannot update inventory in read-only mode'
      );
    });
  });
});