/*

 - El archivo original no esta siendo mostrado por razones de seguridad.
 - Necesitas las credenciales para ejecutar el servicio.

import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
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

export async function sendVerificationEmail(
    to: string, 
    token: string, 
    username: string,
    userIP: string
) {
    const verificationUrl = `http://localhost:5000/verify-email?token=${token}`;
    const location = await getLocationFromIP(userIP);
    const registrationDate = formatDate();
    
    try {
        await transporter.sendMail({
            from: {
                name: 'AI Design Team',
                address: 'process.env.EMAIL_USER',
            },
            to,
            subject: `🔐 Hola ${username}, verifica tu cuenta en AI Design`,
            html: `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px;">
    <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        
        <!--  HEADER CON LOGO -->
        <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="margin: 0; color: #667eea; font-size: 24px; font-weight: bold;">
                🤖 AI Design
            </h1>
        </div>

        <!--  HEADER DE BIENVENIDA -->
        <h1 style="color: #333; text-align: center; margin-bottom: 20px; font-size: 22px;">
            ¡Bienvenido, ${username}! 🎉
        </h1>
        
        <!--  MENSAJE PRINCIPAL -->
        <p style="color: #555; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 20px;">
            Solo falta verificar tu correo. Haz clic en el botón para activar tu cuenta en AI Design.
        </p>
        
        <!--  BOTÓN DE VERIFICACIÓN -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 35px; 
                      text-decoration: none; 
                      border-radius: 25px; 
                      font-weight: bold; 
                      font-size: 16px;
                      display: inline-block;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                ✅ Verificar cuenta
            </a>
        </div>

        <!--  DETALLES DEL REGISTRO -->
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #495057; margin: 0 0 15px 0; font-size: 15px; font-weight: 600; text-align: center;">
                📋 Detalles del registro
            </h3>
            
            <!-- Primera fila -->
            <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 15px;">
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #667eea;">
                    <div style="color: #667eea; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        👤 Usuario
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${username}</div>
                </div>
                
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #28a745;">
                    <div style="color: #28a745; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        📧 Email
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600; word-break: break-word;">${to}</div>
                </div>
            </div>
            
            <!-- Segunda fila -->
            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #ffc107;">
                    <div style="color: #ffc107; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        📍 Ubicación
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${location}</div>
                </div>
                
                <div style="flex: 1; min-width: 200px; background: white; padding: 12px 15px; border-radius: 6px; border-left: 3px solid #17a2b8;">
                    <div style="color: #17a2b8; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 4px;">
                        ⏰ Fecha & Hora
                    </div>
                    <div style="color: #333; font-size: 14px; font-weight: 600;">${registrationDate}</div>
                </div>
            </div>
        </div>

        <!--  SEPARADOR -->
        <hr style="margin: 25px 0; border: none; border-top: 1px solid #eee;">
        
        <!--  INFORMACIÓN IMPORTANTE -->
        <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0;">
            <p style="color: #856404; font-size: 13px; margin: 0;">
                <strong>⚠️ Información importante:</strong><br>
                • <strong>Válido por 10 minutos</strong> - Este enlace expirará automáticamente<br>
                • <strong>Un solo uso</strong> - Se desactivará después de verificar<br>
                • <strong>¿No fuiste tú?</strong> Ignora este mensaje
            </p>
        </div>

        <!--  SOPORTE -->
        <div style="text-align: center; margin: 20px 0;">
            <p style="color: #666; font-size: 12px; margin: 0 0 5px 0;">
                ¿Problemas? Contacta soporte:
            </p>
            <a href="mailto:soporte-ai-design@gmail.com" 
               style="color: #667eea; text-decoration: none; font-size: 12px; font-weight: 500;">
                📧 soporte-ai-design@gmail.com
            </a>
        </div>

        <!--  FOOTER -->
        <p style="color: #777; font-size: 12px; text-align: center; margin-top: 20px;">
            Este correo fue enviado automáticamente por <strong>AI Design</strong>. Por favor, no respondas a este mensaje.
        </p>
        
        <!--  LÍNEA DECORATIVA -->
        <div style="margin: 15px auto; width: 60px; height: 2px; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 1px;"></div>
        
        <!--  COPYRIGHT -->
        <p style="color: #999; font-size: 10px; text-align: center; margin: 10px 0 0 0; opacity: 0.8;">
            © ${new Date().getFullYear()} AI Design. Correo automático, no respondas.
        </p>

    </div>
</div>
            `,
        });
    } catch (error) {
        console.error('Error al enviar correo:', error);
        throw error;
    }
}*/