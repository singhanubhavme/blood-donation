const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const session = require('express-session');
const bcrypt = require('bcrypt');
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.urlencoded({
    extended: true
}));
app.use(session({
    secret: 'notasecret',
    resave: true,
    saveUninitialized: true
}));
mongoose.connect('mongodb://localhost:27017/blood-donation-db')
    .then(() => {
        console.log("Mongoose Connection Open");
    })
    .catch(err => {
        console.log("Error");
        console.log(err);
    })

const requireLogin = (req, res, next) => {
    if (!req.session.user_id) {
        return res.redirect('/login');
    }
    next();
}
app.get('/', (req, res) => {
    res.render('home');
})

app.get('/login', (req, res) => {
    res.render('login');
})

app.post('/login', async (req, res) => {
    const {
        username,
        password
    } = req.body;
    const foundUser = await User.findAndValidate(username, password)
    if (foundUser) {
        req.session.user_id = foundUser._id;
        // res.redirect('/secret');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
})
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
})

app.get('/register', (req, res) => {
    res.render('register');
})

app.get('/doner', requireLogin, (req, res) => {
    const uid = req.session.user_id;
    User.findById(uid, function (err, foundID) {
        const isDoner = foundID.isDoner;
        if (isDoner) {
            return res.render('doner');
        } else {
            return res.send("You have to be a doner to access this page");
        }
    })
})

app.get('/admin', requireLogin, (req, res) => {
    const uid = req.session.user_id;
    User.findById(uid, function (err, foundID) {
        const isAdmin = foundID.isAdmin;
        if (isAdmin) {
            return res.render('admin');
        } else {
            return res.send("You have to be a admin to access this page");
        }
    })
})

app.get('/patient', requireLogin, (req, res)=>{
    res.render('patient');
})

app.post('/register', async (req, res) => {
    const {
        password,
        username,
        email,
        phoneNum,
        bloodGroup,
        unitOfBlood,
        isAdmin,
        isDoner
    } = req.body;
    const user = new User({
        username,
        password,
        email,
        phoneNum,
        bloodGroup,
        unitOfBlood,
        isAdmin,
        isDoner
    })
    await user.save();
    req.session.user_id = user._id;
    res.redirect('secret');
})
app.get('/secret', requireLogin, (req, res) => {
    res.render('secret');
})
app.listen(3000, () => {
    console.log("Serving at 3000");
})