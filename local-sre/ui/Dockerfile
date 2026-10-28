FROM node:22.22.2-alpine AS build
WORKDIR /ui
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build


# Unprivileged nginx: runs as uid 101, listens on a high port, writes only under /tmp.
FROM nginxinc/nginx-unprivileged:1.27.5-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY default.conf.template /etc/nginx/templates/default.conf.template
COPY --chmod=755 10-mkdir-conf.sh /docker-entrypoint.d/10-mkdir-conf.sh
COPY --from=build /ui/dist /usr/share/nginx/html
# The stock entrypoint renders templates with envsubst; send them to /tmp so the rootfs can stay read-only.
ENV NGINX_ENVSUBST_OUTPUT_DIR=/tmp/nginx-conf \
    UI_PORT=8080 \
    HOLMES_PORT=5050
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null "http://127.0.0.1:${UI_PORT}/index.html" || exit 1
