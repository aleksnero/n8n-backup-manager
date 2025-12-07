const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf'); // You might not have this, so I'll use fs.rmSync

const dataDir = path.join(__dirname, 'data');

// 1. Ensure clean state (remove data dir if exists)
if (fs.existsSync(dataDir)) {
    console.log('Removing existing data directory for test...');
    fs.rmSync(dataDir, { recursive: true, force: true });
}

// 2. Require database.js (should trigger creation)
console.log('Requiring database.js...');
try {
    const sequelize = require('./database');

    // 3. Check if directory exists
    if (fs.existsSync(dataDir)) {
        console.log('SUCCESS: data directory was created.');
        // Check for sqlite file (might take a ms to be created by sequelize, but the dir is the main thing)
        if (fs.existsSync(path.join(dataDir, 'database.sqlite'))) {
            console.log('SUCCESS: database.sqlite file exists (or was initiated).');
        } else {
            // Sequelize might create it lazily on sync, but let's check if the dir is there at least.
            // Actually, `new Sequelize` with sqlite usually opens the file immediately or on first query.
            // But our fix was about the DIRECTORY.
            console.log('Info: database.sqlite not found yet, but directory exists. This is expected if sync() hasn\'t run.');
        }
    } else {
        console.error('FAILURE: data directory was NOT created.');
        process.exit(1);
    }

} catch (err) {
    console.error('FAILURE: Error requiring database.js:', err);
    process.exit(1);
}
