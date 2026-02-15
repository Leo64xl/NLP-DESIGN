import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import Design from '../../database/models/Design.model';
import DesignFile from '../../database/models/DesignFile.model';
import { ArchitecturalPrompt } from '../../services/ai/ConfigAI';
import db from '../../database/Configuration.db';
import { DesignType } from '../../database/models/Design.model';

interface TemplateCategory {
  name: string;
  description: string;
  icon: string;
  templates: Record<string, ArchitecturalTemplate>;
}

interface ArchitecturalTemplate {
  id: string;
  name: string;
  description: string;
  area: string;
  rooms: string;
  style: string;
  features: string[];
  estimatedCost: {
    min: number;
    max: number;
    currency: string;
  };
  constructionTime: string;
  complexity: 'simple' | 'medium' | 'complex';
  preview: string;
  popularityScore: number;
  tags: string[];
  specifications: {
    totalArea: number;
    rooms: Array<{ type: string; count: number; minArea?: number }>;
    specialFeatures: string[];
    style: string;
    budget: 'low' | 'medium' | 'high';
  };
}

interface CustomizationOptions {
  area?: number;
  rooms?: Array<{ type: string; count: number }>;
  features?: string[];
  style?: string;
  budget?: 'low' | 'medium' | 'high';
  location?: string;
  terrain?: {
    width: number;
    length: number;
    slope: 'flat' | 'gentle' | 'steep';
  };
}

const ARCHITECTURAL_TEMPLATES: Record<string, TemplateCategory> = {
  residential: {
    name: "Casas Residenciales",
    description: "Diseños familiares optimizados para máximo confort",
    icon: "🏠",
    templates: {
      compact: {
        id: "res_compact",
        name: "Casa Compacta",
        description: "Perfecta para parejas jóvenes o familias pequeñas. Diseño inteligente que maximiza cada metro cuadrado.",
        area: "60-80m²",
        rooms: "2 habitaciones, 1 baño, sala-comedor, cocina",
        style: "Moderno funcional",
        features: ["Cocina integrada", "Espacios optimizados", "Iluminación natural", "Terraza pequeña"],
        estimatedCost: { min: 85000, max: 120000, currency: "USD" },
        constructionTime: "3-4 meses",
        complexity: "simple",
        preview: "/templates/images/compact-house.jpg",
        popularityScore: 95,
        tags: ["primera casa", "económica", "pareja", "funcional"],
        specifications: {
          totalArea: 70,
          rooms: [
            { type: 'habitación', count: 2, minArea: 12 },
            { type: 'baño', count: 1, minArea: 4 }
          ],
          specialFeatures: ['cocina integrada', 'terraza'],
          style: 'moderno funcional',
          budget: 'low'
        }
      },
      family: {
        id: "res_family",
        name: "Casa Familiar",
        description: "El equilibrio perfecto entre espacio y funcionalidad para familias en crecimiento.",
        area: "100-130m²",
        rooms: "3 habitaciones, 2 baños, sala, comedor, cocina",
        style: "Moderno tradicional",
        features: ["Cocina abierta", "Sala familiar", "Jardín", "Garaje opconal"],
        estimatedCost: { min: 145000, max: 190000, currency: "USD" },
        constructionTime: "4-6 meses",
        complexity: "medium",
        preview: "/templates/images/family-house.jpg",
        popularityScore: 98,
        tags: ["familia", "tradicional", "jardín", "popular"],
        specifications: {
          totalArea: 115,
          rooms: [
            { type: 'habitación', count: 3, minArea: 15 },
            { type: 'baño', count: 2, minArea: 6 }
          ],
          specialFeatures: ['cocina abierta', 'jardín', 'sala familiar'],
          style: 'moderno tradicional',
          budget: 'medium'
        }
      },
      premium: {
        id: "res_premium",
        name: "Casa Premium",
        description: "Lujo y elegancia en cada detalle. Espacios amplios con acabados de primera calidad.",
        area: "180-250m²",
        rooms: "4 habitaciones, 3 baños, estudio, sala, comedor, cocina gourmet",
        style: "Moderno premium",
        features: ["Walk-in closet", "Cocina gourmet", "Terraza amplia", "Piscina", "Garaje doble"],
        estimatedCost: { min: 280000, max: 400000, currency: "USD" },
        constructionTime: "6-9 meses",
        complexity: "complex",
        preview: "/templates/images/premium-house.jpg",
        popularityScore: 87,
        tags: ["lujo", "premium", "piscina", "garaje"],
        specifications: {
          totalArea: 215,
          rooms: [
            { type: 'habitación', count: 4, minArea: 18 },
            { type: 'baño', count: 3, minArea: 8 },
            { type: 'estudio', count: 1, minArea: 15 }
          ],
          specialFeatures: ['walk-in closet', 'cocina gourmet', 'terraza amplia', 'piscina', 'garaje doble'],
          style: 'moderno premium',
          budget: 'high'
        }
      },
      eco: {
        id: "res_eco",
        name: "Casa Ecológica",
        description: "Diseño sustentable con tecnologías verdes y materiales eco-amigables.",
        area: "90-120m²",
        rooms: "3 habitaciones, 2 baños, sala, cocina, huerto",
        style: "Eco-moderno",
        features: ["Paneles solares", "Captación de lluvia", "Huerto urbano", "Materiales reciclados"],
        estimatedCost: { min: 130000, max: 180000, currency: "USD" },
        constructionTime: "5-7 meses",
        complexity: "medium",
        preview: "/templates/images/eco-house.jpg",
        popularityScore: 82,
        tags: ["ecológica", "sustentable", "solar", "verde"],
        specifications: {
          totalArea: 105,
          rooms: [
            { type: 'habitación', count: 3, minArea: 14 },
            { type: 'baño', count: 2, minArea: 6 }
          ],
          specialFeatures: ['paneles solares', 'captación de lluvia', 'huerto urbano'],
          style: 'eco-moderno',
          budget: 'medium'
        }
      }
    }
  },
  commercial: {
    name: "Espacios Comerciales",
    description: "Diseños profesionales para tu negocio",
    icon: "🏢",
    templates: {
      office: {
        id: "com_office",
        name: "Oficina Moderna",
        description: "Espacio profesional diseñado para productividad y colaboración.",
        area: "80-150m²",
        rooms: "Recepción, 4 oficinas privadas, sala de juntas, baño, kitchenette",
        style: "Corporativo moderno",
        features: ["Open space", "Sala de juntas", "Recepción", "Área de descanso"],
        estimatedCost: { min: 120000, max: 200000, currency: "USD" },
        constructionTime: "3-5 meses",
        complexity: "medium",
        preview: "/templates/images/modern-office.jpg",
        popularityScore: 89,
        tags: ["oficina", "corporativo", "profesional", "moderno"],
        specifications: {
          totalArea: 115,
          rooms: [
            { type: 'oficina', count: 4, minArea: 12 },
            { type: 'baño', count: 2, minArea: 5 }
          ],
          specialFeatures: ['recepción', 'sala de juntas', 'kitchenette'],
          style: 'corporativo moderno',
          budget: 'medium'
        }
      },
      retail: {
        id: "com_retail",
        name: "Local Comercial",
        description: "Diseño atractivo para ventas con flujo optimizado de clientes.",
        area: "60-120m²",
        rooms: "Área de ventas, almacén, caja, baño, oficina",
        style: "Comercial atractivo",
        features: ["Vitrina amplia", "Iluminación comercial", "Almacén", "Seguridad"],
        estimatedCost: { min: 90000, max: 160000, currency: "USD" },
        constructionTime: "2-4 meses",
        complexity: "simple",
        preview: "/templates/images/retail-store.jpg",
        popularityScore: 91,
        tags: ["comercio", "tienda", "retail", "ventas"],
        specifications: {
          totalArea: 90,
          rooms: [
            { type: 'área de ventas', count: 1, minArea: 40 },
            { type: 'almacén', count: 1, minArea: 20 },
            { type: 'baño', count: 1, minArea: 4 }
          ],
          specialFeatures: ['vitrina amplia', 'iluminación comercial', 'sistema de seguridad'],
          style: 'comercial atractivo',
          budget: 'medium'
        }
      },
      restaurant: {
        id: "com_restaurant",
        name: "Restaurante",
        description: "Ambiente acogedor con cocina profesional y comedor optimizado.",
        area: "120-200m²",
        rooms: "Comedor, cocina, bar, baños, almacén, oficina",
        style: "Gastronómico moderno",
        features: ["Cocina profesional", "Bar", "Terraza", "Área VIP"],
        estimatedCost: { min: 180000, max: 300000, currency: "USD" },
        constructionTime: "4-7 meses",
        complexity: "complex",
        preview: "/templates/images/restaurant.jpg",
        popularityScore: 85,
        tags: ["restaurante", "gastronomía", "cocina", "bar"],
        specifications: {
          totalArea: 160,
          rooms: [
            { type: 'comedor', count: 1, minArea: 80 },
            { type: 'cocina', count: 1, minArea: 30 },
            { type: 'baño', count: 2, minArea: 6 }
          ],
          specialFeatures: ['cocina profesional', 'bar', 'terraza', 'área vip'],
          style: 'gastronómico moderno',
          budget: 'high'
        }
      }
    }
  },
  apartments: {
    name: "Departamentos",
    description: "Vida urbana optimizada",
    icon: "🏙️",
    templates: {
      studio: {
        id: "apt_studio",
        name: "Estudio Urbano",
        description: "Espacio compacto pero completo para vida independiente.",
        area: "35-50m²",
        rooms: "Ambiente principal, cocina integrada, baño",
        style: "Minimalista urbano",
        features: ["Cocina integrada", "Balcón", "Almacenamiento inteligente"],
        estimatedCost: { min: 65000, max: 95000, currency: "USD" },
        constructionTime: "2-3 meses",
        complexity: "simple",
        preview: "/templates/images/studio-apartment.jpg",
        popularityScore: 88,
        tags: ["estudio", "urbano", "minimalista", "soltero"],
        specifications: {
          totalArea: 42,
          rooms: [
            { type: 'ambiente principal', count: 1, minArea: 25 },
            { type: 'baño', count: 1, minArea: 4 }
          ],
          specialFeatures: ['cocina integrada', 'balcón', 'almacenamiento inteligente'],
          style: 'minimalista urbano',
          budget: 'low'
        }
      },
      loft: {
        id: "apt_loft",
        name: "Loft Moderno",
        description: "Espacios abiertos con techos altos y diseño industrial chic.",
        area: "80-120m²",
        rooms: "Ambiente principal, 1 habitación, baño, cocina abierta",
        style: "Industrial moderno",
        features: ["Techos altos", "Cocina abierta", "Mezanine", "Ventanales"],
        estimatedCost: { min: 140000, max: 200000, currency: "USD" },
        constructionTime: "4-6 meses",
        complexity: "medium",
        preview: "/templates/images/loft-apartment.jpg",
        popularityScore: 83,
        tags: ["loft", "industrial", "techos altos", "moderno"],
        specifications: {
          totalArea: 100,
          rooms: [
            { type: 'habitación', count: 1, minArea: 20 },
            { type: 'baño', count: 1, minArea: 6 }
          ],
          specialFeatures: ['techos altos', 'cocina abierta', 'mezanine', 'ventanales'],
          style: 'industrial moderno',
          budget: 'medium'
        }
      }
    }
  }
};

export class DesignTemplateController {
  static async getTemplates(req: Request, res: Response) {
    try {
      const templates = [
        {
          id: 'template-1',
          name: 'Casa Moderna',
          category: 'Residencial',
          area: '150m²',
          rooms: 3,
          style: 'Moderno',
          thumbnail: '/templates/casa-moderna.jpg',
          description: 'Diseño contemporáneo con espacios abiertos',
          popularity: 85,
          downloads: 1240
        },
        {
          id: 'template-2',
          name: 'Departamento Urbano',
          category: 'Residencial',
          area: '80m²',
          rooms: 2,
          style: 'Minimalista',
          thumbnail: '/templates/depto-urbano.jpg',
          description: 'Perfecto para espacios reducidos',
          popularity: 92,
          downloads: 2150
        },
        {
          id: 'template-3',
          name: 'Oficina Comercial',
          category: 'Comercial',
          area: '200m²',
          rooms: 5,
          style: 'Corporativo',
          thumbnail: '/templates/oficina-comercial.jpg',
          description: 'Espacios de trabajo eficientes',
          popularity: 78,
          downloads: 890
        }
      ];

      res.json({
        success: true,
        data: { templates },
        message: "Templates obtenidos exitosamente"
      });
    } catch (error) {
      console.error('Error obteniendo templates:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async getPopularTemplates(req: Request, res: Response) {
    try {
      const popularTemplates = [
        {
          id: 'template-2',
          name: 'Departamento Urbano',
          category: 'Residencial',
          area: '80m²',
          rooms: 2,
          style: 'Minimalista',
          thumbnail: '/templates/depto-urbano.jpg',
          description: 'Perfecto para espacios reducidos',
          popularity: 92,
          downloads: 2150,
          trending: true
        },
        {
          id: 'template-1',
          name: 'Casa Moderna',
          category: 'Residencial',
          area: '150m²',
          rooms: 3,
          style: 'Moderno',
          thumbnail: '/templates/casa-moderna.jpg',
          description: 'Diseño contemporáneo con espacios abiertos',
          popularity: 85,
          downloads: 1240,
          trending: false
        }
      ];

      res.json({
        success: true,
        data: { templates: popularTemplates },
        message: "Templates populares obtenidos exitosamente"
      });
    } catch (error) {
      console.error('Error obteniendo templates populares:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async customizeTemplate(req: Request, res: Response) {
    try {
      const { templateId } = req.params;
      const { modifications } = req.body;
      const userId = req.userId;

      // Simular personalización
      const customizedTemplate = {
        templateId,
        userId,
        modifications,
        customizedAt: new Date().toISOString(),
        previewUrl: `/previews/custom-${templateId}-${userId}.jpg`
      };

      res.json({
        success: true,
        data: { customizedTemplate },
        message: "Template personalizado exitosamente"
      });
    } catch (error) {
      console.error('Error personalizando template:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }

  static async generateFromTemplate(req: Request, res: Response) {
    try {
      const { templateId } = req.params;
      const { customizations } = req.body;
      const userId = req.userId;

      // Simular generación
      const generatedDesign = {
        designId: `design-${Date.now()}`,
        templateId,
        userId,
        status: 'generating',
        customizations,
        estimatedTime: '5-8 minutos',
        files: [
          { type: 'pdf', status: 'queued' },
          { type: 'dwg', status: 'queued' },
          { type: 'obj', status: 'queued' }
        ]
      };

      res.json({
        success: true,
        data: { design: generatedDesign },
        message: "Generación iniciada desde template"
      });
    } catch (error) {
      console.error('Error generando desde template:', error);
      res.status(500).json({
        success: false,
        message: "Error interno del servidor"
      });
    }
  }
}

function findTemplateById(templateId: string): ArchitecturalTemplate | null {
  for (const category of Object.values(ARCHITECTURAL_TEMPLATES)) {
    for (const template of Object.values(category.templates)) {
      if (template.id === templateId) {
        return template;
      }
    }
  }
  return null;
}

function findTemplateCategory(templateId: string): string | null {
  for (const [catKey, category] of Object.entries(ARCHITECTURAL_TEMPLATES)) {
    for (const template of Object.values(category.templates)) {
      if (template.id === templateId) {
        return catKey;
      }
    }
  }
  return null;
}

function getAllTemplateIds(): string[] {
  const ids: string[] = [];
  Object.values(ARCHITECTURAL_TEMPLATES).forEach(category => {
    Object.values(category.templates).forEach(template => {
      ids.push(template.id);
    });
  });
  return ids;
}

// ...existing code...

function createCustomizedPrompt(template: ArchitecturalTemplate, customizations: CustomizationOptions): ArchitecturalPrompt {
  const specs = template.specifications;
  
  // 🔧 MAPEAR CORRECTAMENTE EL TIPO DE DISEÑO
  const mapTemplateToDesignType = (templateId: string): '2d' | '3d' | 'both' => {
    // Mapear según el tipo de template
    if (templateId.startsWith('res_')) return '2d';        // Residencial = 2d
    if (templateId.startsWith('com_')) return '3d';        // Comercial = 3d
    if (templateId.startsWith('apt_')) return 'both';      // Apartamentos = both
    return '2d'; // fallback
  };
  
  return {
    userDescription: `Generar ${template.name} personalizada basada en plantilla popular. ${template.description}`,
    requirements: {
      totalArea: customizations.area || specs.totalArea,
      rooms: customizations.rooms || specs.rooms,
      specialFeatures: [
        ...specs.specialFeatures,
        ...(customizations.features || [])
      ],
      style: customizations.style || specs.style,
      budget: customizations.budget || specs.budget
    },
    context: {
      designType: mapTemplateToDesignType(template.id), 
      complexity: template.complexity,
      priority: 'quality'
    }
  };
}

function createDesignDescription(template: ArchitecturalTemplate, customizations: CustomizationOptions): string {
  let description = `${template.description}\n\n`;
  description += `📐 Área: ${customizations.area || template.specifications.totalArea}m²\n`;
  description += `🏠 Estilo: ${customizations.style || template.style}\n`;
  
  if (customizations.features && customizations.features.length > 0) {
    description += `✨ Características adicionales: ${customizations.features.join(', ')}\n`;
  }
  
  description += `\n💡 Generado desde plantilla: ${template.name}`;
  return description;
}

function calculateCustomizedCost(template: ArchitecturalTemplate, customizations: CustomizationOptions) {
  const baseCost = (template.estimatedCost.min + template.estimatedCost.max) / 2;
  let multiplier = 1;

  if (customizations.area) {
    const areaRatio = customizations.area / template.specifications.totalArea;
    multiplier *= areaRatio;
  }

  if (customizations.features) {
    multiplier += customizations.features.length * 0.1;
  }

  if (customizations.budget === 'high') multiplier *= 1.3;
  if (customizations.budget === 'low') multiplier *= 0.8;

  return {
    estimated: Math.round(baseCost * multiplier),
    min: Math.round(baseCost * multiplier * 0.85),
    max: Math.round(baseCost * multiplier * 1.15),
    currency: template.estimatedCost.currency
  };
}

function calculateCustomizedTime(template: ArchitecturalTemplate, customizations: CustomizationOptions): string {
  return template.constructionTime;
}

function applyCustomizations(originalSpecs: any, customizations: CustomizationOptions) {
  return {
    ...originalSpecs,
    totalArea: customizations.area || originalSpecs.totalArea,
    rooms: customizations.rooms || originalSpecs.rooms,
    specialFeatures: [
      ...originalSpecs.specialFeatures,
      ...(customizations.features || [])
    ],
    style: customizations.style || originalSpecs.style,
    budget: customizations.budget || originalSpecs.budget
  };
}

function determineCustomizedComplexity(customizations: CustomizationOptions): 'simple' | 'medium' | 'complex' {
  let score = 0;
  
  if (customizations.area && customizations.area > 200) score += 2;
  if (customizations.features && customizations.features.length > 3) score += 2;
  if (customizations.terrain?.slope === 'steep') score += 1;
  
  if (score >= 3) return 'complex';
  if (score >= 1) return 'medium';
  return 'simple';
}

async function generateTemplateFiles(designId: string, template: ArchitecturalTemplate, plan: any) {
  const fileTypes = ['PDF', 'DWG', 'OBJ', 'JPG'];
  
  for (let i = 0; i < fileTypes.length; i++) {
    const fileType = fileTypes[i];
    setTimeout(async () => {
      const fileName = `${template.name.replace(/\s+/g, '_')}_${Date.now()}.${fileType.toLowerCase()}`;
      
      await DesignFile.create({
        uuid: uuidv4(),
        designId: designId,
        filename: fileName,
        originalName: `${template.name}.${fileType.toLowerCase()}`,
        fileType: fileType.toLowerCase() as any,
        fileSize: Math.floor(Math.random() * 3000000) + 1000000,
        filePath: `/uploads/designs/${designId}/${fileName}`,
        downloadCount: 0,
        status: 'ready',
        metadata: {
          templateId: template.id,
          templateName: template.name,
          generatedAt: new Date().toISOString(),
          fileFormat: fileType
        }
      });
    }, i * 30000); 
  }
}

function calculateAverageCost(): number {
  let total = 0;
  let count = 0;
  
  Object.values(ARCHITECTURAL_TEMPLATES).forEach(category => {
    Object.values(category.templates).forEach(template => {
      total += (template.estimatedCost.min + template.estimatedCost.max) / 2;
      count++;
    });
  });
  
  return Math.round(total / count);
}

function getPopularTags(): string[] {
  const tagCount: Record<string, number> = {};
  
  Object.values(ARCHITECTURAL_TEMPLATES).forEach(category => {
    Object.values(category.templates).forEach(template => {
      template.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
  });
  
  return Object.entries(tagCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([tag]) => tag);
}

function getAvailableFilters() {
  const styles = new Set<string>();
  const budgets = new Set<string>();
  
  Object.values(ARCHITECTURAL_TEMPLATES).forEach(category => {
    Object.values(category.templates).forEach(template => {
      styles.add(template.style);
      budgets.add(template.specifications.budget);
    });
  });
  
  return {
    categories: Object.keys(ARCHITECTURAL_TEMPLATES),
    styles: Array.from(styles),
    budgets: Array.from(budgets)
  };
}

function getTemplatesByCategory(templates: any[]): Record<string, number> {
  const counts: Record<string, number> = {};
  templates.forEach(t => {
    counts[t.categoryName] = (counts[t.categoryName] || 0) + 1;
  });
  return counts;
}

function getMostPopularStyle(templates: any[]): string {
  const styleCounts: Record<string, number> = {};
  templates.forEach(t => {
    styleCounts[t.style] = (styleCounts[t.style] || 0) + 1;
  });
  
  return Object.entries(styleCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'moderno';
}

function calculateAverageArea(templates: any[]): number {
  const total = templates.reduce((sum, t) => sum + t.specifications.totalArea, 0);
  return Math.round(total / templates.length);
}

function getTopFeatures(templates: any[]): string[] {
  const featureCounts: Record<string, number> = {};
  
  templates.forEach(t => {
    t.features.forEach((feature: string) => {
      featureCounts[feature] = (featureCounts[feature] || 0) + 1;
    });
  });
  
  return Object.entries(featureCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([feature]) => feature);
}

function generateCustomizationPreview(template: ArchitecturalTemplate, customizations: CustomizationOptions) {
  return {
    title: `${template.name} Personalizada`,
    changes: Object.keys(customizations).length,
    preview: {
      area: customizations.area || template.specifications.totalArea,
      style: customizations.style || template.style,
      additionalFeatures: customizations.features?.length || 0,
      complexity: determineCustomizedComplexity(customizations)
    }
  };
}

export default DesignTemplateController;