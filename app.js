require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const User = require('./models/user');
const Request = require('./models/requested');
const session = require('cookie-session');
const bloodCompatibilityChecker = require('./bloodCompat.js');

mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log('Mongoose Connection Open');
  })
  .catch((err) => {
    console.log('Error : ', err);
  });

app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());
app.use(express.static('public'));
app.use(
  session({
    secret: process.env.SECRET,
    cookie: { maxAge: 24 * 60 * 60 * 1000 },
    saveUninitialized: true,
    resave: true,
  })
);
app.use((req, res, next) => {
  res.locals.currentUser = req.session.user_id;
  res.locals.url = req.url;
  next();
});

const requireLogin = (req, res, next) => {
  if (!req.session.user_id) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
};

function sendMail(data, emailAdd, subject) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL,
    to: emailAdd,
    subject: subject,
    html: data,
  };
  transporter.sendMail(mailOptions);
  transporter.close();
}

app.get('/', (req, res) => {
  if (req.session.user_id) {
    User.findById(req.session.user_id, (err, docs) => {
      fullname = docs.name;
      res.render('home', { fullname });
    });
  } else {
    res.render('home', { fullname: '' });
  }
});

app.get('/login', (req, res) => {
  res.render('login', { invalidAuth: false });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await User.findAndValidate(username, password);
  if (foundUser) {
    req.session.user_id = foundUser._id;
    const redirectUrl = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
  } else {
    res.render('login', { invalidAuth: true });
  }
});

app.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

app.get('/message', (req, res) => {
  res.render('message');
});

app.get('/emergency', requireLogin, (req, res) => {
  res.render('emergency');
});

app.post('/emergency', requireLogin, (req, res) => {
  const { bloodGroup, reason } = req.body;
  const emergency = true;
  const uid = req.session.user_id;
  User.findById(uid, (err, foundID) => {
    let username = foundID.username;
    const saveReq = async () => {
      const request = new Request({
        username,
        bloodGroup,
        reason,
        emergency,
      });
      const result = await request.save();
    };
    saveReq();
  });
  User.findById(uid, (err, docs) => {
    if (docs) {
      let data = `${docs.name} has requested a unit of ${bloodGroup} Blood Group. It's an emergency.<br>`;
      data += `Reason : ${reason}`;
      User.find({}, (err, docs) => {
        if (docs) {
          for (let i = 0; i < docs.length; i++) {
            if (docs[i].isAdmin === true) {
              let subject = `Emergency Blood Donation Request to ${docs[i].name}`;
              sendMail(data, docs[i].email, subject);
            }
          }
        }
      });
    }
  });
  const path_url = req.url;
  res.render('message', { path_url });
  // Email is Sent to Admin and Other Donors with required Blood Group
});

app.post('/requestblood', requireLogin, async (req, res) => {
  const { bloodGroup, reason } = req.body;
  const emergency = false;
  const uid = req.session.user_id;
  User.findById(uid, (err, foundID) => {
    let username = foundID.username;
    const saveReq = async () => {
      const request = new Request({
        username,
        bloodGroup,
        reason,
        emergency,
      });
      const result = await request.save();
    };
    saveReq();
  });
  const path_url = req.url;
  res.render('message', { path_url });
  // Request Sent Admin will Contact Soon on You Email
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.get('/donor', requireLogin, (req, res) => {
  const uid = req.session.user_id;
  User.findById(uid, function (err, foundID) {
    const isDonor = foundID.isDonor;
    if (isDonor) {
      res.render('donor');
    } else {
      const path_url = req.url;
      res.render('message', { path_url, invalidInput: 777 });
      // 777 is a number so that invalidInput is not undefined for post donor requests
      // You have to be a donor to access this page
    }
  });
});

app.get('/admin', requireLogin, (req, res) => {
  res.locals.userDocs = '';
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
            requestDocs: requestDocs,
          });
        });
      });
    } else {
      const path_url = req.url;
      res.render('message', { path_url });
      // You have to be a admin to access this page
    }
  });
});

app.post('/admin/reject', (req, res) => {
  const { username, bloodGroup } = req.body;
  Request.findOneAndDelete(
    {
      username,
      bloodGroup,
    },
    (err, docs) => {
      if (err) console.log(err);
      else {
        if (docs) {
          User.findOne({ username }, (err, docs) => {
            if (docs) {
              let subject = `Sorry!`;
              let data = `Your Blood Request has been rejected, either we don't have required blood for now or we feel you are making a fake request.`;
              sendMail(data, docs.email, subject);
            }
          });
          res.redirect('/admin');
        }
      }
    }
  );
});

app.post('/admin/accept', (req, res) => {
  const { username, bloodGroup } = req.body;
  User.findOne({ bloodGroup }, (err, docs) => {
    if (err) {
      console.log('Error : ', err);
    } else {
      if (docs) {
        if (docs.donations > 0) {
          User.findOne({ bloodGroup }, (err, docs) => {
            let previousDonations = parseInt(docs.donations);
            previousDonations--;
            User.findOneAndUpdate(
              { bloodGroup },
              {
                $set: {
                  donations: previousDonations,
                },
              },
              (err, docs) => {
                if (err) {
                  console.log(err);
                }
              }
            );
            Request.findOneAndDelete(
              {
                username,
                bloodGroup,
              },
              (err, docs) => {
                if (err) console.log(err);
                else {
                  User.findOne({ username }, (err, docs) => {
                    if (docs) {
                      let subject = `Congrats!`;
                      let data = `Your Blood Request has been accepted, you can go to your nearest camp for the requested blood group`;
                      sendMail(data, docs.email, subject);
                      res.redirect('/admin');
                    }
                  });
                }
              }
            );
          });
        } else {
          const path_url = req.url;
          res.render('message', { path_url });
          // blood unavailable
        }
      } else {
        const path_url = req.url;
        res.render('message', { path_url });
        // blood unavailable
      }
    }
  });
});

app.post('/donor', requireLogin, (req, res) => {
  let numberofunits = parseInt(req.body.numberofunits);
  if (numberofunits <= 0) {
    const path_url = req.url;
    res.render('message', { path_url, invalidInput: true });
    // Invalid Input
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
        uid,
        {
          $set: {
            donations: numberofunits,
          },
        },
        (err, docs) => {
          if (err) {
            console.log(err);
          }
        }
      );
    });
    const path_url = req.url;
    res.render('message', { path_url, invalidInput: false });
    // You can go to nearest camp to donate the blood
  }
});

app.get('/patient', requireLogin, (req, res) => {
  res.render('patient');
});

app.get('/blood', (req, res) => {
  res.render('blood');
});

app.post('/blood', (req, res) => {
  const { bloodGroup1, bloodGroup2 } = req.body;
  const compatible = bloodCompatibilityChecker(bloodGroup1, bloodGroup2);
  let isCompatible = false;
  if (compatible) {
    isCompatible = true;
    res.render('compatible', {
      bloodGroup1,
      bloodGroup2,
      isCompatible,
    });
  } else {
    res.render('compatible', {
      bloodGroup1,
      bloodGroup2,
      isCompatible,
    });
  }
});

app.post('/make-admin', requireLogin, (req, res) => {
  const { username } = req.body;
  User.findOneAndUpdate(
    { username },
    {
      $set: {
        isAdmin: true,
      },
    },
    (err, docs) => {
      let userPresent = false;
      if (docs) {
        userPresent = true;
        const path_url = req.url;
        res.render('message', { path_url, userPresent });
        // User Made Admin
      } else {
        const path_url = req.url;
        res.render('message', { path_url, userPresent });
        // User Not Present
      }
    }
  );
});

app.post('/register', async (req, res) => {
  let { password, username, name, email, phoneNum, bloodGroup, isDonor } =
    req.body;
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
  User.find(
    {
      username: username,
    },
    async (err, docs) => {
      if (docs.length) {
        const path_url = req.url;
        res.render('message', { path_url });
        // User Already Registered
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
          isDonor,
        });
        await user.save();
        req.session.user_id = user._id;
        res.redirect('/');
      }
    }
  );
});

app.get('*', (req, res) => {
  res.render('error404');
});

app.listen(process.env.PORT, () => {
  console.log('Serving at 3000');
});
