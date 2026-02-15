import PDFDocument from 'pdfkit';
import fs from 'fs';

export async function generatePdfFile(planData: any, outputPath: string): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  
  // ✅ MEJORAR DISEÑO DEL PDF
  doc.pipe(fs.createWriteStream(outputPath));
  
  // 🎨 HEADER MEJORADO
  doc.fontSize(24)
     .fillColor('#2c3e50')
     .text(planData.metadata.title || 'Plan Arquitectónico', 50, 50);
  
  doc.fontSize(12)
     .fillColor('#7f8c8d')
     .text(`Generado: ${new Date().toLocaleDateString()}`, 50, 80);
  
  // 📊 INFORMACIÓN DEL PROYECTO
  let yPos = 120;
  doc.fontSize(14)
     .fillColor('#34495e')
     .text('📋 Especificaciones del Proyecto:', 50, yPos);
  
  yPos += 25;
  doc.fontSize(11)
     .fillColor('#2c3e50')
     .text(`• Área Total: ${planData.metadata.totalArea} m²`, 70, yPos);
  
  yPos += 20;
  doc.text(`• Estilo: ${planData.metadata.style}`, 70, yPos);
  
  yPos += 20;
  doc.text(`• Dimensiones: ${planData.metadata.dimensions?.width || 10}m x ${planData.metadata.dimensions?.length || 10}m`, 70, yPos);
  
  // 🏠 DISTRIBUCIÓN DE HABITACIONES
  yPos += 40;
  doc.fontSize(14)
     .fillColor('#34495e')
     .text('🏠 Distribución de Espacios:', 50, yPos);
  
  if (planData.threeJSData?.rooms) {
    planData.threeJSData.rooms.forEach((room: any, index: number) => {
      yPos += 25;
      doc.fontSize(11)
         .fillColor('#2c3e50')
         .text(`• ${room.name}: ${room.vertices ? calculateRoomArea(room.vertices) : 'N/A'} m²`, 70, yPos);
    });
  }
  
  // 🎯 PLANO ESQUEMÁTICO SIMPLE
  yPos += 50;
  doc.fontSize(14)
     .fillColor('#34495e')
     .text('📐 Plano Esquemático:', 50, yPos);
  
  // Dibujar contorno principal
  const startX = 100;
  const startY = yPos + 40;
  const scale = 15; // Escala para el dibujo
  
  doc.rect(startX, startY, 200, 150)
     .stroke('#2c3e50');
  
  // Dibujar habitaciones básicas
  if (planData.threeJSData?.rooms) {
    planData.threeJSData.rooms.forEach((room: any, index: number) => {
      if (room.vertices && room.vertices.length >= 4) {
        const roomX = startX + (room.vertices[0][0] || 0) * scale;
        const roomY = startY + (room.vertices[0][1] || 0) * scale;
        const roomW = Math.abs((room.vertices[1][0] || 0) - (room.vertices[0][0] || 0)) * scale;
        const roomH = Math.abs((room.vertices[2][1] || 0) - (room.vertices[0][1] || 0)) * scale;
        
        // Dibujar habitación
        doc.rect(roomX, roomY, roomW || 50, roomH || 50)
           .stroke('#95a5a6');
        
        // Etiqueta de habitación
        doc.fontSize(8)
           .fillColor('#2c3e50')
           .text(room.name, roomX + 5, roomY + 5);
      }
    });
  }
  
  // 📝 NOTAS TÉCNICAS
  yPos += 220;
  doc.fontSize(14)
     .fillColor('#34495e')
     .text('📝 Especificaciones Técnicas:', 50, yPos);
  
  yPos += 25;
  doc.fontSize(10)
     .fillColor('#7f8c8d')
     .text('• Estructura: Concreto armado', 70, yPos);
  
  yPos += 15;
  doc.text('• Muros: Mampostería estructural', 70, yPos);
  
  yPos += 15;
  doc.text('• Cubierta: Teja de barro sobre estructura metálica', 70, yPos);
  
  yPos += 15;
  doc.text('• Instalaciones: Eléctricas y sanitarias completas', 70, yPos);
  
  // 🔗 FOOTER
  doc.fontSize(8)
     .fillColor('#bdc3c7')
     .text('Generado por AI-Design System | ai-design.com', 50, 750);
  
  doc.end();
}

// 🧮 FUNCIÓN AUXILIAR: Calcular área de habitación
function calculateRoomArea(vertices: number[][]): string {
  if (vertices.length < 4) return 'N/A';
  
  const width = Math.abs(vertices[1][0] - vertices[0][0]);
  const height = Math.abs(vertices[2][1] - vertices[0][1]);
  const area = width * height;
  
  return area.toFixed(1);
}