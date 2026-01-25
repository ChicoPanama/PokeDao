-- P1-3: Add wallet address field to User model for tokenized features
ALTER TABLE "User" ADD COLUMN "walletAddress" TEXT;
