/*

 - El archivo original no esta siendo mostrado por razones de seguridad.
 - Necesitas las credenciales para ejecutar el servicio.

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'process.env.EMAIL_USER', 
        pass: 'process.env.EMAIL_PASS',
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

export async function sendPasswordResetEmail(
    to: string, 
    token: string, 
    username: string,
    userIP: string
) {
    const resetUrl = `http://localhost:5000/reset-password?token=${token}`;
    const location = await getLocationFromIP(userIP);
    const requestDate = formatDate();
    
    const htmlTemplate = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="margin: 0; color: #e74c3c; font-size: 24px; font-weight: bold;">
                🔐 AI Design Security
            </h1>
        </div>

        <!-- Título -->
        <h1 style="color: #333; text-align: center; margin-bottom: 20px; font-size: 22px;">
            🔑 Recuperación de Contraseña
        </h1>
        
        <!-- Mensaje principal -->
        <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 20px;">
            Hola <strong>${username}</strong>, recibimos una solicitud para restablecer tu contraseña.
        </p>
        
        <!-- Botón principal -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); 
                      color: white; 
                      padding: 15px 35px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(231, 76, 60, 0.3);">
                🔧 Restablecer Contraseña
            </a>
        </div>

        <!-- Detalles de la solicitud -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 15px; font-weight: 600; text-align: center;">
                📋 Detalles de la solicitud
            </h3>
            
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #e74c3c;">
                    <div style="color: #e74c3c; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
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
                        ⏰ Fecha de solicitud
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${requestDate}</div>
                </div>
            </div>
        </div>

        <!-- Separador -->
        <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
        
        <!-- Información importante -->
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0;">
            <p style="color: #856404; font-size: 13px; margin: 0;">
                <strong>⚠️ Información importante:</strong><br>
                • <strong>Válido por 15 minutos</strong> - Este enlace expirará automáticamente<br>
                • <strong>Un solo uso</strong> - Se desactivará después de usarlo<br>
                • <strong>¿No fuiste tú?</strong> Ignora este mensaje y tu contraseña permanecerá sin cambios
            </p>
        </div>

        <!-- Soporte -->
        <div style="text-align: center; margin: 20px 0;">
            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0;">
                ¿Problemas? Contacta soporte:
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
        <div style="margin: 15px auto; width: 60px; height: 2px; background: linear-gradient(90deg, #e74c3c, #c0392b); border-radius: 1px;"></div>
        
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
                address: 'process.env.EMAIL_USER',
            },
            to,
            subject: `🔐 ${username}, recupera tu contraseña - AI Design`,
            html: htmlTemplate
        });
        
    } catch (error) {
        console.error('❌ Error al enviar email de recovery:', error);
        throw error;
    }
}

export async function verifyPasswordEmailConnection(): Promise<boolean> {
    try {
        await transporter.verify();        
        return true;
    } catch (error) {
        console.error('❌ Error en la conexión de email para recovery:', error);
        return false;
    }
}*/