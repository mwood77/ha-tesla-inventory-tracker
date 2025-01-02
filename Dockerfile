FROM node:18-slim

WORKDIR /usr/src/app

COPY package.json package-lock.json config.yaml ./

RUN npm install

COPY . .

CMD ["bash", "/usr/src/app/run.sh"]
