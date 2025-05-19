# Usa la imagen oficial con navegadores y dependencias
FROM mcr.microsoft.com/playwright:focal

# Directorio de la app
WORKDIR /app

# Copia sólo los package.json primero (para cachear npm install)
COPY package.json package-lock.json ./

# Instala dependencias de Node y de Playwright
RUN npm install

# Copia el resto del código
COPY . .

# Asegura que los navegadores de Playwright estén instalados
RUN npx playwright install

# Expone el puerto donde corre Express
EXPOSE 10000

# Comando por defecto para arrancar
CMD ["npm", "start"]

