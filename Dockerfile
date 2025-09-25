FROM node:24-alpine AS base
RUN apk add --no-cache pnpm
WORKDIR /app
COPY package.json ./
RUN pnpm install
ENTRYPOINT ["pnpm", "run", "dev"]

# run with:
# docker build . -t notary-example
# docker run -p3000:3000 -v./src:/app/src notary-example