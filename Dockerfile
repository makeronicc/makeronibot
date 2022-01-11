FROM node:alpine
EXPOSE 8080

WORKDIR /app
COPY package.json /app/package.json

RUN npm install

COPY . /app/

CMD ["npm", "run", "start"]