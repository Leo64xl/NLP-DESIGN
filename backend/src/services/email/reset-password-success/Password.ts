/*

 - El archivo original no esta siendo mostrado por razones de seguridad.
 - Necesitas las credenciales para ejecutar el servicio.

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER',
        pass: process.env.EMAIL_PASS'
    },
});

async function getLocationFromIP(ip: string): Promise<string> {
    try {
        if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
            return 'México city, México';
        }

        const response = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,regionName,status`);
        const data = await response.json();
        
        if (data.status === 'success') {
            return `${data.city}, ${data.regionName}, ${data.country}`;
        } else {
            return 'Ubicación no disponible';
        }
    } catch (error) {
        console.error('Error obteniendo ubicación:', error);
        return 'Ubicación no disponible';
    }
}

function formatDate(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Mexico_City'
    };
    return now.toLocaleDateString('es-MX', options);
}

export async function sendPasswordChangedNotification(
    to: string, 
    username: string,
    userIP: string
) {
    const location = await getLocationFromIP(userIP);
    const changeDate = formatDate();
    
    const htmlTemplate = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="margin: 0; color: #27ae60; font-size: 24px; font-weight: bold;">
                ✅ AI Design Security
            </h1>
        </div>

        <!-- Título -->
        <h1 style="color: #333; text-align: center; margin-bottom: 20px; font-size: 22px;">
            🔐 Contraseña Actualizada Exitosamente
        </h1>
        
        <!-- Mensaje principal -->
        <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 20px;">
            Hola <strong>${username}</strong>, tu contraseña ha sido actualizada correctamente.
        </p>
        
        <!-- Mensaje de confirmación -->
        <div style="background: #d5f4e6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #27ae60;">
            <p style="color: #27ae60; font-size: 16px; margin: 0; text-align: center;">
                <strong>✅ Tu cuenta está segura</strong><br>
                <span style="font-size: 14px; color: #555;">Puedes iniciar sesión normalmente con tu nueva contraseña</span>
            </p>
        </div>

        <!-- Detalles del cambio -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 15px; font-weight: 600; text-align: center;">
                📋 Detalles del cambio
            </h3>
            
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #27ae60;">
                    <div style="color: #27ae60; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        👤 Usuario
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${username}</div>
                </div>
                
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #f39c12;">
                    <div style="color: #f39c12; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        📍 Ubicación
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${location}</div>
                </div>
            </div>
            
            <div style="margin-top: 15px;">
                <div style="background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #17a2b8;">
                    <div style="color: #17a2b8; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        ⏰ Fecha del cambio
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${changeDate}</div>
                </div>
            </div>
        </div>

        <!-- Separador -->
        <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
        
        <!-- Información de seguridad -->
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0;">
            <p style="color: #856404; font-size: 13px; margin: 0;">
                <strong>🔒 Información de seguridad:</strong><br>
                • <strong>Cambio autorizado</strong> - Tu contraseña fue actualizada correctamente<br>
                • <strong>Acceso seguro</strong> - Puedes iniciar sesión con tu nueva contraseña<br>
                • <strong>¿No fuiste tú?</strong> Contacta inmediatamente a soporte
            </p>
        </div>

        <!-- Botón de acceso -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="process.env.FRONTEND_URL" 
               style="background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%); 
                      color: white; 
                      padding: 15px 35px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(39, 174, 96, 0.3);">
                🔑 Iniciar Sesión
            </a>
        </div>

        <!-- Soporte -->
        <div style="text-align: center; margin: 20px 0;">
            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0;">
                ¿No reconoces este cambio? Contacta soporte inmediatamente:
            </p>
            <a href="mailto:soporte-ai-design@gmail.com" 
               style="color: #e74c3c; text-decoration: none; font-size: 12px; font-weight: 500;">
                📧 soporte-ai-design@gmail.com
            </a>
        </div>

        <!-- Footer -->
        <p style="color: #777; font-size: 12px; text-align: center; margin-top: 20px;">
            Este correo fue enviado automáticamente por <strong>AI Design Security</strong>. Por favor, no respondas a este mensaje.
        </p>
        
        <!-- Línea decorativa -->
        <div style="margin: 15px auto; width: 60px; height: 2px; background: linear-gradient(90deg, #27ae60, #2ecc71); border-radius: 1px;"></div>
        
        <!-- Copyright -->
        <p style="color: #999; font-size: 10px; text-align: center; margin: 10px 0 0 0; opacity: 0.8;">
            © ${new Date().getFullYear()} AI Design. Sistema de seguridad automático.
        </p>

    </div>
</div>
    `;
    
    try {
        await transporter.sendMail({
            from: {
                name: 'AI Design Security',
                address: process.env.EMAIL_USER'
            },
            to,
            subject: `✅ ${username}, tu contraseña fue actualizada - AI Design`,
            html: htmlTemplate
        });
        
    } catch (error) {
        throw error;
    }
} */