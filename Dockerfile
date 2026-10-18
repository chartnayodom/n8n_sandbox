FROM docker.n8n.io/n8nio/n8n:latest

USER root

# Create directory for bundled workflows inside the container
RUN mkdir -p /home/node/workflows && chown -R node:node /home/node/workflows

# Copy exported workflow JSON files from repository into the image
COPY --chown=node:node ./workflows /home/node/workflows

USER node
