const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const session = require('express-session');
const bcrypt = require('bcrypt');


mongoose.connect('mongodb://localhost:27017/blood-donation-db')
    .then(() => {
        console.log("Mongoose Connection Open");
    })
    .catch(err => {
        console.log("Error");
        console.log(err);
    })
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.urlencoded({
    extended: true
}));
app.use(express.static("public"));
app.use(session({
    // cookie: { maxAge: 60000 },
    secret: 'notasecret',
    saveUninitialized: true,
    resave: true
}));


app.use((req, res, next) => {
    res.locals.currentUser = req.session.user_id;
    res.locals.url = req.url;
    next();
});


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
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
})
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
})
app.get('/emergency', requireLogin, (req, res) => {
    res.render('emergency');
})
app.post('/emergency', requireLogin, (req, res) => {
    const {
        bloodGroup,
        reason
    } = req.body;
    console.log(bloodGroup);
    console.log(reason);
    // add sending email feature
    res.send('Email is Sent to Admin and Other Doners with required Blood Group');
})
app.post('/requestblood', requireLogin, (req, res) => {
    const {
        bloodGroup,
        reason
    } = req.body;

    console.log(bloodGroup);
    console.log(reason);
    // add these things to other collection to show admin
    // res.send("Request Sent Admin will Contact Soon on You Email");
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

app.post('/doner', requireLogin, (req, res) => {
    const {
        numberofunits
    } = req.body;
    const uid = req.session.user_id;
    //update in db
    res.send("You can go to nearest camp to donate the blood");
})

app.get('/patient', requireLogin, (req, res) => {
    res.render('patient');
})
app.get('/blood', (req, res) => {
    res.render('blood');
})

// app.get('/compatible', (req, res)=>{
//     res.render('compatible');
// })

app.post('/blood', (req, res) => {
    let {
        bloodGroup1,
        bloodGroup2
    } = req.body;
    if (bloodGroup1 === bloodGroup2) {
        res.render('compatible', {
            bloodGroup1: bloodGroup1,
            bloodGroup2: bloodGroup2
        });
    } else {
        res.send("Not Compatible");
    }
})

app.post('/register', async (req, res) => {
    let {
        password,
        username,
        name,
        email,
        phoneNum,
        bloodGroup,
        isDoner
    } = req.body;
    const isAdmin = false;
    const donations = 0;
    if (isDoner == undefined) {
        isDoner = false;
    }
    const user = new User({
        username,
        password,
        name,
        email,
        phoneNum,
        bloodGroup,
        donations,
        isAdmin,
        isDoner
    })
    await user.save();
    req.session.user_id = user._id;
    res.redirect('/');
})
app.get('*', function (req, res) {
    res.render("error404");
});
app.listen(3000, () => {
    console.log("Serving at 3000");
})