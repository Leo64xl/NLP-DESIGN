# Dockerfile para el Backend (Node.js + TypeScript + Express + MySQL)
FROM node:18-alpine

# Establece el directorio de trabajo
WORKDIR /app

# Copia los archivos de dependencias
COPY package*.json ./

# Instala las dependencias
RUN npm install

# Copia el resto del código fuente
COPY . .

# Compila TypeScript a JavaScript
RUN npm run build

# Expone el puerto de la aplicación
EXPOSE 8081

# Comando para iniciar la aplicación
CMD ["npm", "start"]
