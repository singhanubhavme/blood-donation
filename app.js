const express = require('express');
const app = express();
const mongoose = require('mongoose');
const User = require('./models/user');
const Request = require('./models/requested');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bloodCompatibilityChecker = require('./bloodCompat.js');
mongoose.connect('mongodb://localhost:27017/blood-donation-db')
    .then(() => {
        console.log("Mongoose Connection Open");
    })
    .catch(err => {
        console.log("Error : ", err);
    })
app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());
app.use(express.static("public"));
app.use(session({
    secret: 'notasecret',
    cookie: { maxAge: 60000 },
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
    // const {
    //     username,
    //     password
    // } = req.body;
    const username = "anubhav";
    const password = "anubhav";
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
    const emergency = true;
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
    const emergency = false;
    const completed = false;
    const uid = req.session.user_id;
    User.findById(uid, (err, foundID) => {
        let username = foundID.username;
        const saveReq = async () => {
            const request = new Request({
                username,
                bloodGroup,
                reason,
                emergency,
                completed
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
    res.locals.userDocs = "";
    const uid = req.session.user_id;
    User.findById(uid, function (err, foundID) {
        const isAdmin = foundID.isAdmin;
        if (isAdmin) {
            User.find({}, (err, userDocs) => {
                if (userDocs) {
                    res.locals.userDocs = userDocs;
                }
                Request.find({}, (errReq, requestDocs) => {
                    res.render('admin', {
                        requestDocs: requestDocs
                    });
                })
            })
        } else {
            res.send("You have to be a admin to access this page");
        }
    })
})


app.post('/admin/delete', requireLogin, (req, res) => {
    const {
        username,
        bloodGroup
    } = req.body;
    Request.findOneAndDelete({
        username,
        bloodGroup
    }, (err, docs) => {
        if (err) console.log(err);
        else
            res.redirect('/admin');
    });
})

app.post('/admin/accept', requireLogin, (req, res) => {
    const {
        username,
        bloodGroup
    } = req.body;
    User.findOne({ bloodGroup }, (err, docs) => {
        if (err) {
            console.log("Error : ", err);
        } else {
            if (docs) {
                if (docs.donations > 0) {
                    Request.findOneAndDelete({
                        username,
                        bloodGroup
                    }, (err, docs) => {
                        if (err) console.log(err);
                        else
                            res.redirect('/admin');
                    });
                } else {
                    res.send("blood unavailable");
                }
            } else {
                res.send("blood unavailable");
            }
        }
    })
    //update this and send back data name, phone number of donator also add evenyone's phone number
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

app.post('/make-admin', requireLogin, (req, res) => {
    const { username } = req.body;
    User.findOneAndUpdate({ username }, {
        $set: {
            isAdmin: true
        }
    }, (err, docs) => {
        if (docs) {
            res.send("User Made Admin");
        } else {
            res.send("User Not Present");
        }
    })
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
    let isAdmin = false;
    if (username === 'anubhav') {
        isAdmin = true;
    } else {
        isAdmin = false;
    }
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