# Use Node.js LTS version
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files first (for better Docker caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose port (optional, bots don't need ports but good practice)
EXPOSE 3000

# Command to run the bot
CMD ["npm", "run", "dev"]
