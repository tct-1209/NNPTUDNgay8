const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/NNPTUD-C6';

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const userResult = await mongoose.connection.collection('users').deleteMany({
        username: /^user\d+$/
    });

    const cartResult = await mongoose.connection.collection('carts').deleteMany({});

    console.log(`🗑️  Đã xóa ${userResult.deletedCount} users`);
    console.log(`🗑️  Đã xóa ${cartResult.deletedCount} carts`);
    console.log('\n✅ Xong! Bây giờ chạy lại: node importUsers.js');

    await mongoose.disconnect();
}

main().catch(console.error);
