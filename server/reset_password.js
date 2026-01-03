const bcrypt = require('bcryptjs');
const User = require('./models/User');
const sequelize = require('./database');

async function resetPassword(username, newPassword) {
    try {
        await sequelize.authenticate();
        console.log('Connected to database.');

        const hashedPassword = bcrypt.hashSync(newPassword, 8);

        // Find or create
        const [user, created] = await User.findOrCreate({
            where: { username },
            defaults: { password: hashedPassword }
        });

        if (!created) {
            user.password = hashedPassword;
            await user.save();
            console.log(`Password updated for user: ${username}`);
        } else {
            console.log(`Created new user: ${username}`);
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

const user = process.argv[2] || 'admin';
const pass = process.argv[3] || 'password';

resetPassword(user, pass);
