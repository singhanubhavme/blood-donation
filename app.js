const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const Request = require('./models/requested');
const session = require('express-session');
const bcrypt = require('bcrypt');

function bloodCompatibilityChecker(Donor, Recipient) {
    if (Recipient == "A+") {
        if (Donor == "A+" || Donor == "A-" || Donor == "O+" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "A-") {
        if (Donor == "A-" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "B+") {
        if (Donor == "B+" || Donor == "B-" || Donor == "O-" || Donor == "O+") {
            return true;
        }
    } else if (Recipient == "B-") {
        if (Donor == "B-" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "AB+") {
        if (Donor == "A+" || Donor == "A-" || Donor == "B+" || Donor == "B-" || Donor == "AB+" || Donor == "AB-" || Donor == "O+" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "AB-") {
        if (Donor == "AB-" || Donor == "A-" || Donor == "B-" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "O+") {
        if (Donor == "O+" || Donor == "O-") {
            return true;
        }
    } else if (Recipient == "O-") {
        if (Donor == "O-") {
            return true;
        }
    }
    return false;
}

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
    let emergency = true;
    const uid = req.session.user_id;
    User.findById(uid, (err, foundID) => {
        let username = foundID.username;
        const saveReq = async () => {
            const request = new Request({
                username,
                bloodGroup,
                reason,
                emergency
            })
            const result = await request.save();
        }
        saveReq();
    })
    //send email
    res.send('Email is Sent to Admin and Other Donors with required Blood Group');
})

app.post('/requestblood', requireLogin, async (req, res) => {
    const {
        bloodGroup,
        reason
    } = req.body;
    let emergency = false;
    const uid = req.session.user_id;
    User.findById(uid, (err, foundID) => {
        let username = foundID.username;
        const saveReq = async () => {
            const request = new Request({
                username,
                bloodGroup,
                reason,
                emergency
            })
            const result = await request.save();
        }
        saveReq();
    })
    res.send("Request Sent Admin will Contact Soon on You Email");
})

app.get('/register', (req, res) => {
    res.render('register');
})

app.get('/donor', requireLogin, (req, res) => {
    const uid = req.session.user_id;
    User.findById(uid, function (err, foundID) {
        const isDonor = foundID.isDonor;
        if (isDonor) {
            return res.render('donor');
        } else {
            return res.send("You have to be a donor to access this page");
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

app.post('/donor', requireLogin, (req, res) => {
    let numberofunits = parseInt(req.body.numberofunits);
    if (numberofunits <= 0) {
        return res.send("Invalid Input");
    } else {
        const uid = req.session.user_id;
        let previousDonations = 0;
        User.findById(uid, (err, docs) => {
            if (err) {
                console.log(err);
            }
            previousDonations = parseInt(docs.donations);
            numberofunits = numberofunits + parseInt(previousDonations);
            User.findByIdAndUpdate(
                uid, {
                    $set: {
                        donations: numberofunits
                    }
                }, (err, docs) => {
                    if (err) {
                        console.log(err);
                    }
                })
        })
        res.send("You can go to nearest camp to donate the blood");
    }
})

app.get('/patient', requireLogin, (req, res) => {
    res.render('patient');
})
app.get('/blood', (req, res) => {
    res.render('blood');
})

app.post('/blood', (req, res) => {
    let {
        bloodGroup1,
        bloodGroup2
    } = req.body;
    if (bloodCompatibilityChecker(bloodGroup1, bloodGroup2)) {
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
        isDonor
    } = req.body;
    const isAdmin = false;
    const donations = 0;
    if (isDonor == undefined) {
        isDonor = false;
    }
    User.find({
        username: username
    }, async (err, docs) => {
        if (docs.length) {
            res.send("User Already Registered");
        } else {
            const user = new User({
                username,
                password,
                name,
                email,
                phoneNum,
                bloodGroup,
                donations,
                isAdmin,
                isDonor
            })
            await user.save();
            req.session.user_id = user._id;
            res.redirect('/');
        }
    })

})
app.get('*', function (req, res) {
    res.render("error404");
});
app.listen(3000, () => {
    console.log("Serving at 3000");
})