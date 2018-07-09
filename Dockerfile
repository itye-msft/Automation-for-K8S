## Port service 
FROM ityer/dotnet-node-alpine:net2.1-node9.11-alpine3.7

# Create app directory
WORKDIR /usr/src

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm install --only=production

# Bundle app source
COPY . .

## Helm

# Note: Latest version of kubectl may be found at: # https://aur.archlinux.org/packages/kubectl-bin/ 
ENV KUBE_LATEST_VERSION="v1.10.2" 
# Note: Latest version of helm may be found at: # https://github.com/kubernetes/helm/releases 
ENV HELM_VERSION="v2.9.1" 
ENV HELM_HOME="/usr/local/bin/"
ENV HELM_BINARY="/usr/local/bin/helm"
RUN mkdir /usr/local/bin/plugins
RUN apk add --no-cache ca-certificates bash \
    && wget -q https://storage.googleapis.com/kubernetes-release/release/${KUBE_LATEST_VERSION}/bin/linux/amd64/kubectl -O /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && wget -q http://storage.googleapis.com/kubernetes-helm/helm-${HELM_VERSION}-linux-amd64.tar.gz -O - | tar -xzO linux-amd64/helm > /usr/local/bin/helm \
    && chmod +x /usr/local/bin/helm
RUN apk update && apk upgrade && \
    apk add --no-cache bash git openssh
RUN helm plugin install https://github.com/itye-msft/helm-json-plugin --version master

EXPOSE 4000
CMD [ "npm", "start" ]