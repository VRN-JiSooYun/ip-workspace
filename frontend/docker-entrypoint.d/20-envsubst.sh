#!/bin/sh
set -e

# Replace environment variables in env.template.js and save to env.js
if [ -f /usr/share/nginx/html/env.template.js ]; then
  envsubst < /usr/share/nginx/html/env.template.js > /usr/share/nginx/html/env.js
fi

exit 0
