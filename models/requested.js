const mongoose = require('mongoose');
const reqSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, "Username can't be blank"]
    },
    bloodGroup: {
        type: String
    },
    reason: {
        type: String
    },
    emergency : {
        type : Boolean
    },
    completed:{
        type: Boolean
    }
})

module.exports = mongoose.model('Request', reqSchema);