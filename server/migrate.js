const { Sequelize } = require('sequelize');
const path = require('path');

const dataDir = path.join(__dirname, 'data');
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(dataDir, 'database.sqlite'),
    logging: console.log
});

async function migrate() {
    try {
        console.log('Starting database migration...');

        // Check if storageLocation column exists
        const [results] = await sequelize.query("PRAGMA table_info(Backups);");
        const hasStorageLocation = results.some(col => col.name === 'storageLocation');

        if (!hasStorageLocation) {
            console.log('Adding storageLocation column to Backups table...');
            await sequelize.query(
                "ALTER TABLE Backups ADD COLUMN storageLocation VARCHAR(255) DEFAULT 'local' NOT NULL;"
            );
            console.log('✅ Migration completed successfully!');
        } else {
            console.log('✅ storageLocation column already exists. No migration needed.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
