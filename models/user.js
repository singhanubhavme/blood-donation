const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username can't be blank"]
    },
    password: {
        type: String,
        required: [true, "Password can't be blank"]
    },
    email: {
        type: String
    },
    phoneNum: {
        type: String
    },
    bloodGroup: {
        type: String
    },
    unitOfBlood: {
        type: String
    },
    isAdmin: {
        type: Boolean
    },
    isDoner: {
        type: Boolean
    }
})
userSchema.statics.findAndValidate = async function (username, password) {
    const foundUser = await this.findOne({
        username: username
    });
    if (!foundUser) {
        return false;
    }
    const isValid = await bcrypt.compare(password, foundUser.password);
    return isValid ? foundUser : false;
}
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }
    this.password = await bcrypt.hash(this.password, 12);
    next();
});
module.exports = mongoose.model('User', userSchema);