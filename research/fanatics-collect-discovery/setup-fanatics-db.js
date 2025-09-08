/**
 * FANATICS DATABASE SETUP SCRIPT
 * ==============================
 * 
 * Sets up separate SQLite database for Fanatics Collect data
 * Allows independent testing and easy merging later
 */

const fs = require('fs');
const path = require('path');

class FanaticsDBSetup {
    constructor() {
        this.dbDir = './fanatics-db';
        this.schemaFile = './fanatics-schema.prisma';
    }

    async setup() {
        console.log('🗄️ SETTING UP FANATICS COLLECT DATABASE');
        console.log('=======================================');

        // Create database directory
        if (!fs.existsSync(this.dbDir)) {
            fs.mkdirSync(this.dbDir, { recursive: true });
            console.log('✅ Created database directory');
        }

        // Copy schema
        const targetSchema = path.join(this.dbDir, 'schema.prisma');
        if (fs.existsSync(this.schemaFile)) {
            fs.copyFileSync(this.schemaFile, targetSchema);
            console.log('✅ Copied database schema');
        }

        // Create package.json for Prisma
        const packageJson = {
            "name": "fanatics-collect-db",
            "version": "1.0.0",
            "description": "Separate database for Fanatics Collect data",
            "dependencies": {
                "@prisma/client": "^5.0.0",
                "prisma": "^5.0.0"
            },
            "scripts": {
                "db:generate": "prisma generate",
                "db:migrate": "prisma migrate dev",
                "db:reset": "prisma migrate reset --force",
                "db:studio": "prisma studio"
            }
        };

        fs.writeFileSync(
            path.join(this.dbDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
        );
        console.log('✅ Created package.json');

        console.log('\n📋 NEXT STEPS:');
        console.log('1. cd fanatics-db');
        console.log('2. npm install');
        console.log('3. npx prisma migrate dev --name init');
        console.log('4. npx prisma generate');
        console.log('\n🎯 Then run the test harvester!');
    }
}

const setup = new FanaticsDBSetup();
setup.setup().catch(console.error);
