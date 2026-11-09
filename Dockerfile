FROM node:22-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN pnpm build

FROM nginx:1.27-alpine AS runtime

# Where /api is forwarded. Override at run time, e.g. -e BACKEND_URL=https://my-api.onrender.com
ENV BACKEND_URL=http://backend:8000
# Tried when BACKEND_URL can't be reached, e.g. both containers started separately with Docker Desktop's
# Run button and the backend published on host port 8000
ENV BACKEND_FALLBACK_URL=http://host.docker.internal:8000
# Makes the nginx image export NGINX_LOCAL_RESOLVERS (the container's DNS servers) for the template
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

# Rendered to /etc/nginx/conf.d/default.conf (with ${BACKEND_URL} filled in) when the container starts
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
