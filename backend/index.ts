import express from 'express';
import sessions from 'express-session';
import cors from 'cors';
import dotenv from 'dotenv';
import SequelizeStore from 'connect-session-sequelize';
import db from './src/database/Configuration.db';
import { PORT } from './src/config/Configuration.app';
import './src/database/models/Index.models';
import Authentication from './src/routes/Authentication';
import EmailVerification from './src/routes/EmailVerifications';
import ResetPassword from './src/routes/ResetPassword';
import Users from './src/routes/Users';
import Designs from './src/routes/Designs';
import DesignTemplate from './src/routes/DesignTemplate'
import Notifications from './src/routes/Notifications';
import Chat from './src/routes/Chat';
import Admin from './src/routes/Admin';

dotenv.config();

const app = express(); 

const sessionStore = SequelizeStore(sessions.Store);

const store = new sessionStore({ 
    db: db,
});

(async() => {
   // Las tablas se crean automáticamente con init.sql en Docker
   // db.sync() ya no es necesario
   // await db.sync();
}) ();

app.set('trust proxy', true);

app.use(sessions( {
    secret: process.env.SESSION_SECRET || (() => { throw new Error('SESSION_SECRET is not defined'); })(),
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        secure: 'auto',
        maxAge: 1000 * 60 * 60 * 24, 
    }
}));

app.use(cors({
    credentials: true,
    origin: process.env.CLIENT_URL 
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(Authentication);
app.use(EmailVerification);
app.use(ResetPassword);
app.use(Designs);
app.use(DesignTemplate);
app.use(Notifications);
app.use(Chat);
app.use(Users);
app.use(Admin);

store.sync();

// 🕐 CONFIGURAR TIMEOUTS LARGOS PARA PROCESAMIENTO DE IA
const server = app.listen(process.env.APP_PORT || PORT, () => {
    console.log(`Servidor ejecutándose en el puerto: ` + (process.env.APP_PORT || PORT));
});

// Configurar timeouts del servidor
server.timeout = 300000; // 5 minutos
server.keepAliveTimeout = 300000; // 5 minutos  
server.headersTimeout = 310000; // Debe ser mayor que keepAliveTimeout
