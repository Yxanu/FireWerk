FROM mcr.microsoft.com/playwright:v1.48.0-jammy

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ENV NODE_ENV=production

# Install browser binaries (Chromium only is fine; base image may already have them)
RUN npx playwright install chromium --with-deps

CMD ["npm","start"]
