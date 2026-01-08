/**
 * Claude AI Client for Documentation Analysis
 * Provides intelligent insights and context about Jamf infrastructure
 */

import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from '../server/logger.js';

const logger = createLogger('ai-client');

export interface AnalysisRequest {
  type: 'overview' | 'component' | 'security' | 'recommendations';
  data: any;
  context?: string;
}

export interface AnalysisResult {
  summary: string;
  insights: string[];
  recommendations: string[];
  risks?: string[];
  strengths?: string[];
}

export class ClaudeAIClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey?: string, model: string = 'claude-3-5-sonnet-20241022') {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required for AI-powered documentation');
    }

    this.client = new Anthropic({ apiKey: key });
    this.model = model;
  }

  /**
   * Analyze Jamf environment and provide insights
   */
  async analyzeEnvironment(data: {
    totalComputers: number;
    totalMobileDevices: number;
    totalPolicies: number;
    totalProfiles: number;
    totalScripts: number;
    totalPackages: number;
    components: any;
  }): Promise<AnalysisResult> {
    const prompt = `You are analyzing a Jamf Pro environment. Provide a comprehensive analysis with insights and recommendations.

Environment Overview:
- Total Computers: ${data.totalComputers}
- Total Mobile Devices: ${data.totalMobileDevices}
- Total Policies: ${data.totalPolicies}
- Total Configuration Profiles: ${data.totalProfiles}
- Total Scripts: ${data.totalScripts}
- Total Packages: ${data.totalPackages}

Please analyze this environment and provide:
1. A brief executive summary (2-3 sentences)
2. Key insights about the infrastructure (3-5 bullet points)
3. Recommendations for improvement (3-5 actionable items)
4. Potential security or compliance risks (if any)
5. Strengths of the current setup

Format your response as JSON with keys: summary, insights (array), recommendations (array), risks (array), strengths (array).`;

    return await this.generateAnalysis(prompt);
  }

  /**
   * Analyze a specific component (policies, devices, etc.)
   */
  async analyzeComponent(componentType: string, items: any[]): Promise<AnalysisResult> {
    const itemCount = items.length;
    const sampleItems = items.slice(0, 10); // Analyze first 10 items for patterns

    const prompt = `You are analyzing ${componentType} in a Jamf Pro environment.

Total ${componentType}: ${itemCount}
Sample data: ${JSON.stringify(sampleItems, null, 2)}

Analyze these ${componentType} and provide:
1. A summary of what these ${componentType} accomplish
2. Insights about configuration patterns, naming conventions, and organization
3. Recommendations for optimization or standardization
4. Any potential issues or risks you notice
5. Best practices being followed

Format your response as JSON with keys: summary, insights (array), recommendations (array), risks (array), strengths (array).`;

    return await this.generateAnalysis(prompt);
  }

  /**
   * Analyze security posture
   */
  async analyzeSecurityPosture(data: {
    policies: any[];
    profiles: any[];
    devices: any[];
  }): Promise<AnalysisResult> {
    const prompt = `You are performing a security analysis of a Jamf Pro environment.

Data:
- Policies: ${data.policies.length} total
- Configuration Profiles: ${data.profiles.length} total
- Managed Devices: ${data.devices.length} total

Sample Policies: ${JSON.stringify(data.policies.slice(0, 5), null, 2)}
Sample Profiles: ${JSON.stringify(data.profiles.slice(0, 5), null, 2)}

Analyze the security posture and provide:
1. Overall security summary
2. Security insights and observations
3. Security recommendations
4. Identified security risks or gaps
5. Security strengths

Format your response as JSON with keys: summary, insights (array), recommendations (array), risks (array), strengths (array).`;

    return await this.generateAnalysis(prompt);
  }

  /**
   * Generate intelligent recommendations
   */
  async generateRecommendations(overview: any, components: any): Promise<AnalysisResult> {
    const prompt = `Based on this Jamf Pro environment analysis, provide strategic recommendations.

Environment Overview:
${JSON.stringify(overview, null, 2)}

Component Summary:
${JSON.stringify(
      Object.entries(components).map(([type, data]: [string, any]) => ({
        type,
        count: data?.totalCount || 0,
      })),
      null,
      2
    )}

Provide:
1. Executive summary for IT leadership
2. Strategic insights for improving device management
3. Prioritized recommendations (high/medium/low priority)
4. Potential cost savings or efficiency gains
5. Organizational strengths to build upon

Format your response as JSON with keys: summary, insights (array), recommendations (array), risks (array), strengths (array).`;

    return await this.generateAnalysis(prompt);
  }

  /**
   * Generate analysis using Claude API
   */
  private async generateAnalysis(prompt: string): Promise<AnalysisResult> {
    try {
      logger.info('Generating AI analysis...');

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse JSON response
      const text = content.text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // If no JSON found, structure the text response
        return {
          summary: text.split('\n')[0] || 'Analysis completed',
          insights: text.split('\n').filter((l) => l.trim().startsWith('-')).slice(0, 5),
          recommendations: [],
          risks: [],
          strengths: [],
        };
      }

      const analysis = JSON.parse(jsonMatch[0]);

      return {
        summary: analysis.summary || '',
        insights: Array.isArray(analysis.insights) ? analysis.insights : [],
        recommendations: Array.isArray(analysis.recommendations) ? analysis.recommendations : [],
        risks: Array.isArray(analysis.risks) ? analysis.risks : [],
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      };
    } catch (error) {
      logger.error('Failed to generate AI analysis', { error });
      return {
        summary: 'AI analysis unavailable',
        insights: [],
        recommendations: [],
        risks: [],
        strengths: [],
      };
    }
  }
}
