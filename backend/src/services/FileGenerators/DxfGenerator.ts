import Drawing from 'dxf-writer';
import fs from 'fs';

export async function generateDxfFile(planData: any, outputPath: string) {
  const dxf = new Drawing();

  // Crea capas (color: AutoCAD index)
  dxf.addLayer('WALLS', 7, 'CONTINUOUS');      // Negro
  dxf.addLayer('DOORS', 1, 'CONTINUOUS');      // Rojo
  dxf.addLayer('WINDOWS', 5, 'CONTINUOUS');    // Azul
  dxf.addLayer('FURNITURE', 3, 'CONTINUOUS');  // Verde
  dxf.addLayer('ROOMS', 2, 'CONTINUOUS');      // Amarillo

  // Paredes (negro)
  dxf.setActiveLayer('WALLS');
  if (planData.threeJSData?.walls) {
    planData.threeJSData.walls.forEach((wall: any) => {
      const [x1, y1] = wall.start;
      const [x2, y2] = wall.end;
      dxf.drawLine(x1 * 100, y1 * 100, x2 * 100, y2 * 100);
    });
  }

  // Puertas (rojo)
  dxf.setActiveLayer('DOORS');
  if (planData.threeJSData?.doors) {
    planData.threeJSData.doors.forEach((door: any) => {
      const [x1, y1] = door.start;
      const [x2, y2] = door.end;
      dxf.drawLine(x1 * 100, y1 * 100, x2 * 100, y2 * 100);
    });
  }

  // Ventanas (azul)
  dxf.setActiveLayer('WINDOWS');
  if (planData.threeJSData?.windows) {
    planData.threeJSData.windows.forEach((window: any) => {
      const [x1, y1] = window.start;
      const [x2, y2] = window.end;
      dxf.drawLine(x1 * 100, y1 * 100, x2 * 100, y2 * 100);
    });
  }

  // Mobiliario (verde) - dibuja como rectángulo con 4 líneas
  dxf.setActiveLayer('FURNITURE');
  if (planData.threeJSData?.furniture) {
    planData.threeJSData.furniture.forEach((item: any) => {
      const x = item.position[0] * 100;
      const y = item.position[1] * 100;
      const w = (item.size?.width || 1) * 100;
      const l = (item.size?.length || 1) * 100;
      dxf.drawLine(x, y, x + w, y);
      dxf.drawLine(x + w, y, x + w, y + l);
      dxf.drawLine(x + w, y + l, x, y + l);
      dxf.drawLine(x, y + l, x, y);
      if (item.name) {
            dxf.drawText(10, x + w / 2, y + l / 2, 0, String(item.name));
        }
    });
  }

  // Etiquetas de habitaciones (amarillo)
  dxf.setActiveLayer('ROOMS');
  if (planData.threeJSData?.rooms) {
    planData.threeJSData.rooms.forEach((room: any) => {
      if (room.label && room.center) {
         dxf.drawText(20, room.center[0] * 100, room.center[1] * 100, 0, String(room.label));
      }
    });
  }

  fs.writeFileSync(outputPath, dxf.toDxfString());
}