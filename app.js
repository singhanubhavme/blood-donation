const express = require('express');
const app = express();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv')
dotenv.config()
const User = require('./models/user');
const Request = require('./models/requested');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bloodCompatibilityChecker = require('./bloodCompat.js');
mongoose.connect(process.env.DB_URL)
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
    secret: process.env.SECRET,
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

function sendMail(data, emailAdd, subject) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        host: 'smtp.gmail.com',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD
        },
    });
    const mailOptions = {
        from: process.env.EMAIL,
        to: emailAdd,
        subject: subject,
        html: data
    };
    transporter.sendMail(mailOptions);
    transporter.close();
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
app.get('/message', (req, res) => {
    res.render('message');
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
    User.findById(uid, (err, docs) => {
        if (docs) {
            let data = `${docs.name} has requested an emergency blood of ${bloodGroup} Group.<br>`
            data += `Reason : ${reason}`;
            User.find({}, (err, docs) => {
                if (docs) {
                    for (let i = 0; i < docs.length; i++) {
                        if (docs[i].isAdmin === true) {
                            let subject = `Blood Donation Data for ${docs[i].name}`;
                            sendMail(data, docs[i].email, subject);
                        }
                    }
                }
            })
        }
    })
    const path_url = req.url;
    res.render('message', { path_url });
    // res.send('Email is Sent to Admin and Other Donors with required Blood Group');
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
    const path_url = req.url;
    res.render("message", { path_url });
    // res.send("Request Sent Admin will Contact Soon on You Email");
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
            const path_url = req.url;
            res.render("message", { path_url });
            // return res.send("You have to be a donor to access this page");
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
            const path_url = req.url;
            res.render("message", { path_url });
            // res.send("You have to be a admin to access this page");
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
        else {
            if (docs) {
                User.findOne({ username }, (err, docs) => {
                    if (docs) {
                        let subject = `Sorry!`;
                        let data = `Your Blood Request has been rejected, either we don't have required blood for now or we feel you are making a fake request.`;
                        sendMail(data, docs.email, subject);
                    }
                })
                res.redirect('/admin');
            }
        }
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
                        else {
                            User.findOne({ username }, (err, docs) => {
                                if (docs) {
                                    let subject = `Congrats!`;
                                    let data = `Your Blood Request has been accepted, you can go to your nearest camp for the requested blood group`;
                                    sendMail(data, docs.email, subject);
                                }
                            })
                            res.redirect('/admin');
                        }
                    });
                } else {
                    const path_url = req.url;
                    res.render("message", { path_url });
                    // res.send("blood unavailable");
                }
            } else {
                const path_url = req.url;
                res.render("message", { path_url });
                // res.send("blood unavailable");
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
        const path_url = req.url;
        res.render("message", { path_url });
        // res.send("You can go to nearest camp to donate the blood");
    }
})

app.get('/patient', requireLogin, (req, res) => {
    res.render('patient');
})
app.get('/blood', (req, res) => {
    res.render('blood');
})

app.post('/blood', (req, res) => {
    const {
        bloodGroup1,
        bloodGroup2
    } = req.body;
    const compatible = bloodCompatibilityChecker(bloodGroup1, bloodGroup2);
    let isCompatible = false;
    if (compatible) {
        isCompatible = true;
        res.render('compatible', {
            bloodGroup1, bloodGroup2, isCompatible
        });
    } else {
        res.render('compatible', {
            bloodGroup1, bloodGroup2, isCompatible
        });
    }
})

app.post('/make-admin', requireLogin, (req, res) => {
    const { username } = req.body;
    User.findOneAndUpdate({ username }, {
        $set: {
            isAdmin: true
        }
    }, (err, docs) => {
        let userPresent = false;
        if (docs) {
            userPresent = true;
            const path_url = req.url;
            res.render("message", { path_url, userPresent });
            // res.send("User Made Admin");
        } else {
            const path_url = req.url;
            res.render("message", { path_url, userPresent });
            // res.send("User Not Present");
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
            const path_url = req.url;
            res.render("message", { path_url });
            // res.send("User Already Registered");
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