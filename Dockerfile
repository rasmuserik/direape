FROM node:latest

COPY . /usr/src/app
WORKDIR /usr/src/app
RUN npm install --production
ENTRYPOINT ["node", "direape.js", "server"]
EXPOSE 8888
