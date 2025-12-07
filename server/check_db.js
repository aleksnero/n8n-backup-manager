const sequelize = require('./database');
const User = require('./models/User');

async function checkDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection OK');

        const users = await User.findAll();
        console.log(`\n📊 Found ${users.length} user(s) in database:`);

        if (users.length === 0) {
            console.log('⚠️  NO USERS FOUND - You need to complete First Time Setup!');
        } else {
            users.forEach(user => {
                console.log(`- Username: ${user.username}`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkDatabase();
