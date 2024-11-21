FROM node:alpine AS build

# Add package file
COPY package.json ./
COPY yarn.lock ./

# Install dependencys
RUN npm install

# Copy source
COPY src ./src
COPY tsconfig.json ./tsconfig.json

# Build
RUN npm build

# Start production image build
FROM node:alpine AS runner

# Copy node modules and build directory
COPY --from=build ./node_modules ./node_modules
COPY --from=build /dist /dist
COPY .env ./

# Expose port 3000
EXPOSE 3000
CMD ["dist/main.js"]