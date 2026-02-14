/**
 * HTTP Endpoints for Skills
 * Provides REST API access to skills for ChatGPT and other HTTP clients
 */

import { Router, Request, Response } from 'express';
import { SkillsManager } from '../skills/manager.js';
import { logger } from './logger.js';

export function createSkillsRouter(skillsManager: SkillsManager): Router {
  const router = Router();

  /**
   * Execute a skill
   * POST /api/v1/skills/execute
   */
  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { skill, parameters } = req.body;

      if (!skill) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: skill'
        });
      }

      logger.info(`Executing skill: ${skill}`, { 
        skill, 
        parameters,
        client: req.headers['user-agent']?.includes('ChatGPT') ? 'ChatGPT' : 'Unknown'
      });

      const result = await skillsManager.executeSkill(skill, parameters || {});

      // Format response for ChatGPT compatibility
      const response = {
        success: result.success,
        message: result.message,
        data: result.data,
        nextActions: result.nextActions
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Skill execution error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  });

  /**
   * Get skills catalog
   * GET /api/v1/skills/catalog
   */
  router.get('/catalog', (req: Request, res: Response) => {
    try {
      const catalog = skillsManager.getSkillCatalog();
      
      // Add usage hints for ChatGPT
      const response = {
        skills: catalog,
        usage: {
          endpoint: '/api/v1/skills/execute',
          method: 'POST',
          example: {
            skill: 'find-outdated-devices',
            parameters: {
              daysSinceLastContact: 30,
              includeDetails: true
            }
          }
        }
      };

      res.json(response);
    } catch (error: any) {
      logger.error('Catalog retrieval error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve skills catalog'
      });
    }
  });

  /**
   * Get skill details
   * GET /api/v1/skills/:skillName
   */
  router.get('/:skillName', (req: Request, res: Response) => {
    try {
      const { skillName } = req.params;
      const skill = skillsManager.getSkill(skillName);

      if (!skill) {
        return res.status(404).json({
          success: false,
          error: `Skill "${skillName}" not found`
        });
      }

      res.json({
        ...skill.metadata,
        name: skillName // Override with the actual skillName from params
      });
    } catch (error: any) {
      logger.error('Skill detail retrieval error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve skill details'
      });
    }
  });

  /**
   * Get OpenAPI specification
   * GET /api/v1/skills/openapi.json
   */
  router.get('/openapi.json', (req: Request, res: Response) => {
    try {
      const openApiSpec = skillsManager.generateOpenAPISpec();
      res.json(openApiSpec);
    } catch (error: any) {
      logger.error('OpenAPI generation error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to generate OpenAPI specification'
      });
    }
  });

  /**
   * Health check for skills
   * GET /api/v1/skills/health
   */
  router.get('/health', (req: Request, res: Response) => {
    const skills = skillsManager.getAllSkills();
    res.json({
      status: 'healthy',
      skillsCount: skills.length,
      skillsAvailable: skills.map(s => s.metadata.name)
    });
  });

  return router;
}

/**
 * Middleware to detect and optimize for ChatGPT
 */
export function chatGPTOptimizationMiddleware(req: Request, res: Response, next: () => void): void {
  const userAgent = req.headers['user-agent'] || '';
  
  if (userAgent.includes('ChatGPT')) {
    // Add ChatGPT-specific headers
    res.setHeader('X-ChatGPT-Compatible', 'true');
    
    // Log ChatGPT requests for monitoring
    logger.info('ChatGPT request detected', {
      path: req.path,
      method: req.method
    });
  }
  
  next();
}