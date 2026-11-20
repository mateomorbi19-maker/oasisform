# Imagen de producción para Easypanel. Sin dependencias: alcanza con Node.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DIR_DATOS=/app/data
COPY package.json servidor.js ./
COPY lib ./lib
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app/data
# Las respuestas y los archivos viven acá: montá un volumen o se pierden en cada deploy.
VOLUME ["/app/data"]
USER node
EXPOSE 3000
CMD ["node", "servidor.js"]
