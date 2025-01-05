ARG BUILD_FROM
FROM $BUILD_FROM

# Install requirements for add-on
RUN apk add --no-cache git

WORKDIR /usr/src/app

COPY package.json package-lock.json config.yaml ./
COPY /images ./
COPY run.sh ./

RUN chmod a+x /run.sh

RUN npm install

COPY . .

CMD ["bash", "/run.sh"]
