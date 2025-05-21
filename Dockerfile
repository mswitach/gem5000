# Usa la imagen oficial con navegadores y dependencias de Playwright
FROM mcr.microsoft.com/playwright:focal

# Directorio de la app
WORKDIR /app

# Copia solo package.json para cachear npm install
COPY package.json package-lock.json ./

# Instala dependencias de Node y Playwright
RUN npm install

# Copia el resto del código
COPY . .

# Asegura que los navegadores de Playwright estén instalados
RUN npx playwright install

# Defino la variable de entorno para que la app escuche en el puerto 10000
ENV PORT=10000
EXPOSE 10000

# Comando por defecto para arrancar
CMD ["npm", "start"]

