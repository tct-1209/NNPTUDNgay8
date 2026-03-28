const mongoose = require('mongoose');
const xlsx = require('xlsx');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const path = require('path');

const MONGO_URI = 'mongodb://localhost:27017/NNPTUD-C6';
const EXCEL_FILE = path.join(__dirname, 'user.xlsx');
const ROLE_USER_ID = '69aa8360450df994c1ce6c4c';

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    secure: false,
    auth: {
        user: "d6b53783133f92",
        pass: "4da101bbf724b4", // ← Thay bằng password thật từ Mailtrap
    },
});

async function sendMail(to, password) {
    await transporter.sendMail({
        from: '"Hệ thống Admin" <admin@hutech.edu.vn>',
        to: to,
        subject: "Thông tin tài khoản mới",
        text: `Mật khẩu đăng nhập của bạn là: ${password}`,
        html: `<h3>Chào mừng thành viên mới!</h3>
               <p>Mật khẩu đăng nhập hệ thống của bạn là: <b>${password}</b></p>`,
    });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true },
        password: { type: String, required: true },
        email: {
            type: String, required: true, unique: true,
            lowercase: true, match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
        },
        fullName: { type: String, default: "" },
        avatarUrl: { type: String, default: "https://i.sstatic.net/l60Hf.png" },
        status: { type: Boolean, default: false },
        role: { type: mongoose.Schema.Types.ObjectId, ref: "role", required: true },
        loginCount: { type: Number, default: 0 },
        lockTime: { type: Date },
        isDeleted: { type: Boolean, default: false },
        resetPasswordToken: String,
        resetPasswordTokenExp: Date
    },
    { timestamps: true }
);

userSchema.pre('save', function () {
    if (this.isModified("password")) {
        const salt = bcrypt.genSaltSync(10);
        this.password = bcrypt.hashSync(this.password, salt);
    }
});

const User = mongoose.models.user || mongoose.model("user", userSchema);

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" }
}, { timestamps: true });

const Cart = mongoose.models.carts || mongoose.model("carts", cartSchema);

function generatePassword() {
    return crypto.randomBytes(12).toString('base64').slice(0, 16);
}

async function main() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công\n');

    const workbook = xlsx.readFile(EXCEL_FILE);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    console.log(`📋 Tìm thấy ${rows.length} users trong file Excel\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const row of rows) {
        const { username, email } = row;

        if (!username || !email) {
            console.warn(`⚠️  Bỏ qua dòng thiếu dữ liệu:`, row);
            skipCount++;
            continue;
        }

        const existing = await User.findOne({ $or: [{ username }, { email }] });
        if (existing) {
            console.log(`⏭️  Bỏ qua (đã tồn tại): ${username} / ${email}`);
            skipCount++;
            continue;
        }

        try {
            const rawPassword = generatePassword();

            const newUser = new User({
                username,
                email,
                password: rawPassword,
                role: new mongoose.Types.ObjectId(ROLE_USER_ID)
            });

            await newUser.save();

            const newCart = new Cart({ user: newUser._id });
            await newCart.save();

            console.log(`✅ Lưu DB thành công: ${username} (${email}) | Password: ${rawPassword}`);
            successCount++;

            // Chờ 1.5s tránh Mailtrap rate limit (free plan giới hạn tốc độ gửi)
            await sleep(1500);

            try {
                await sendMail(email, rawPassword);
                console.log(`   📧 Gửi mail OK: ${email}`);
            } catch (mailErr) {
                console.warn(`   ⚠️  Gửi mail thất bại: ${mailErr.message}`);
            }

        } catch (err) {
            console.error(`❌ Lỗi khi import ${username}:`, err.message);
            errorCount++;
        }
    }

    console.log('\n========== KẾT QUẢ ==========');
    console.log(`✅ Thành công : ${successCount}`);
    console.log(`⏭️  Bỏ qua    : ${skipCount}`);
    console.log(`❌ Lỗi        : ${errorCount}`);
    console.log('==============================\n');

    await mongoose.disconnect();
    console.log('🔌 Đã ngắt kết nối MongoDB');
}

main().catch(err => {
    console.error('💥 Lỗi nghiêm trọng:', err);
    process.exit(1);
});
