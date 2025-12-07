const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(dataDir, 'database.sqlite'),
    logging: false
});

module.exports = sequelize;
