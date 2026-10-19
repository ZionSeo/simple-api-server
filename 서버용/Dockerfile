FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev=false
COPY . .
ENV NODE_ENV=production
ENV PORT=3847
EXPOSE 3847
CMD ["npm", "start"]
