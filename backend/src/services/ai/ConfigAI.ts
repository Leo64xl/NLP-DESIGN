// Importar desde ThreeJS
export * from '../ThreeJS/ThreeJSTypes';
export * from '../ThreeJS/ThreeJSMaterials';
export * from '../ThreeJS/ThreeJSFurniture';
import { ThreeJSGeometry } from '../ThreeJS/ThreeJSTypes';

// Resto del archivo ConfigAI.ts existente...
export interface ArchitecturalPrompt {
  userDescription: string;
  requirements: {
    totalArea?: number;
    rooms?: Array<{ type: string; count: number }>;
    specialFeatures?: string[];
    style?: string;
    budget?: string;
  };
  context: {
    designType: '2d' | '3d' | 'both';
    complexity: 'simple' | 'medium' | 'complex';
    priority: 'speed' | 'quality' | 'cost';
  };
}

export interface ArchitecturalPlan {
  metadata: {
    title: string;
    totalArea: number;
    dimensions: { width: number; length: number };
    style: string;
    generatedAt: string;
    generationMethod: 'openai';
    processingTime: number;
  };
  description: string;
  rooms: Array<{
    name: string;
    area: number;
    position: { x: number; y: number };
    size: { width: number; height: number };
    purpose: string;
    features: string[];
  }>;
  threeJSData: ThreeJSGeometry;
  technicalSpecs: {
    structure: string;
    materials: string[];
    electrical: string;
    plumbing: string;
    accessibility?: string[];
  };
  estimatedCost: {
    construction: number;
    materials: number;
    labor: number;
    total: number;
    currency: string;
  };
}

export const aiConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini',
    timeout: 380000, 
    maxRetries: 3,
    retryDelay: 2000,
    temperature: 0.7,
    maxTokens: 4000
  }
};