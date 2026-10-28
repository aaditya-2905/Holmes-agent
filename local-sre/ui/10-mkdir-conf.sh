#!/bin/sh
# Runs before 20-envsubst-on-templates.sh: the rendered config goes to the /tmp tmpfs
# (the rootfs is read-only), and the stock script requires the directory to exist.
mkdir -p "${NGINX_ENVSUBST_OUTPUT_DIR:-/tmp/nginx-conf}"
