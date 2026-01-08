/**
 * Documentation MCP Resources
 * Resources for accessing generated Jamf Pro environment documentation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createLogger } from '../server/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = createLogger('documentation-resources');

/**
 * Handle documentation resource requests
 */
export async function handleDocumentationResource(uri: string, docPath: string) {
  try {
  const defaultBasePath = './jamf-documentation';

  // Parse the resource path
  // Format: environment/overview
  //         environment/computers
  //         environment/json/computers
  //         environment/markdown/computers
  const parts = docPath.split('/');

  if (parts[0] === 'environment') {
    if (parts.length === 1 || parts[1] === 'overview') {
      // Return overview
      return await readOverview(defaultBasePath);
    }

    if (parts[1] === 'json' && parts.length === 3) {
      // Return JSON data for specific component
      return await readJSON(defaultBasePath, parts[2]);
    }

    if (parts[1] === 'markdown' && parts.length === 3) {
      // Return markdown for specific component
      return await readMarkdown(defaultBasePath, parts[2]);
    }

    if (parts.length === 2) {
      // Return both JSON and markdown for component
      const component = parts[1];
      const jsonData = await readJSON(defaultBasePath, component);
      const markdownData = await readMarkdown(defaultBasePath, component);

      return {
        contents: [
          {
            uri: `jamf://documentation/environment/${component}`,
            mimeType: 'application/json',
            text: `JSON Data:\n${jsonData.contents[0].text}\n\nMarkdown Documentation:\n${markdownData.contents[0].text}`,
          },
        ],
      };
    }
  }

    return {
      contents: [
        {
          uri: `jamf://documentation/${docPath}`,
          mimeType: 'text/plain',
          text: 'Invalid documentation resource path',
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to read documentation resource', { uri, docPath, error });
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error reading documentation: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Read overview documentation
 */
async function readOverview(basePath: string) {
  const overviewPath = path.join(basePath, 'README.md');
  const jsonPath = path.join(basePath, 'data', 'complete-environment.json');

  try {
    const [markdown, json] = await Promise.all([
      fs.readFile(overviewPath, 'utf-8').catch(() => null),
      fs.readFile(jsonPath, 'utf-8').catch(() => null),
    ]);

    if (!markdown && !json) {
      return {
        contents: [
          {
            uri: 'jamf://documentation/environment/overview',
            mimeType: 'text/plain',
            text: 'No documentation found. Run documentJamfEnvironment tool first.',
          },
        ],
      };
    }

    let text = '';
    if (markdown) {
      text += `# Overview (Markdown)\n\n${markdown}\n\n`;
    }
    if (json) {
      const data = JSON.parse(json);
      text += `# Overview (JSON)\n\n${JSON.stringify(data.overview, null, 2)}`;
    }

    return {
      contents: [
        {
          uri: 'jamf://documentation/environment/overview',
          mimeType: 'text/markdown',
          text,
        },
      ],
    };
  } catch (error) {
    logger.error('Failed to read overview', { error });
    throw error;
  }
}

/**
 * Read JSON documentation for a component
 */
async function readJSON(basePath: string, component: string) {
  const jsonPath = path.join(basePath, 'data', `${component}.json`);

  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(content);

    return {
      contents: [
        {
          uri: `jamf://documentation/environment/json/${component}`,
          mimeType: 'application/json',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return {
        contents: [
          {
            uri: `jamf://documentation/environment/json/${component}`,
            mimeType: 'text/plain',
            text: `Documentation for ${component} not found. Run documentJamfEnvironment tool first.`,
          },
        ],
      };
    }
    throw error;
  }
}

/**
 * Read markdown documentation for a component
 */
async function readMarkdown(basePath: string, component: string) {
  const markdownPath = path.join(basePath, 'markdown', `${component}.md`);

  try {
    const content = await fs.readFile(markdownPath, 'utf-8');

    return {
      contents: [
        {
          uri: `jamf://documentation/environment/markdown/${component}`,
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return {
        contents: [
          {
            uri: `jamf://documentation/environment/markdown/${component}`,
            mimeType: 'text/plain',
            text: `Markdown documentation for ${component} not found. Run documentJamfEnvironment tool first.`,
          },
        ],
      };
    }
    throw error;
  }
}

/**
 * Get resource definitions for MCP
 */
export function getDocumentationResourceDefinitions() {
  return [
    {
      uri: 'jamf://documentation/environment/overview',
      name: 'Jamf Environment Documentation Overview',
      description: 'Overview of the complete Jamf Pro environment documentation with statistics',
      mimeType: 'text/markdown',
    },
    {
      uri: 'jamf://documentation/environment/computers',
      name: 'Computer Documentation',
      description: 'Complete documentation of all computers in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/mobile-devices',
      name: 'Mobile Device Documentation',
      description: 'Complete documentation of all mobile devices in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/policies',
      name: 'Policy Documentation',
      description: 'Complete documentation of all policies in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/configuration-profiles',
      name: 'Configuration Profile Documentation',
      description: 'Complete documentation of all configuration profiles in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/scripts',
      name: 'Script Documentation',
      description: 'Complete documentation of all scripts in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/packages',
      name: 'Package Documentation',
      description: 'Complete documentation of all packages in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/computer-groups',
      name: 'Computer Group Documentation',
      description: 'Complete documentation of all computer groups in the Jamf Pro environment',
      mimeType: 'application/json',
    },
    {
      uri: 'jamf://documentation/environment/mobile-device-groups',
      name: 'Mobile Device Group Documentation',
      description: 'Complete documentation of all mobile device groups in the Jamf Pro environment',
      mimeType: 'application/json',
    },
  ];
}
