//jshint esversion:6
require("dotenv").config();
const express = require('express');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
// const saltRounds = 10;
const session = require('express-session');
const passportLocalMongoose = require('passport-local-mongoose');
const passport = require("passport");
const GoogleStrategy = require( 'passport-google-oauth2' ).Strategy;
const findOrCreate = require("mongoose-findOrCreate");
const FacebookStrategy = require("passport-facebook").Strategy;


const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: "our little secret.", 
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());  //initialized passport
app.use(passport.session());  //set passport to manage our session

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);  //tell userschema to use passportlocalmongoose as a plugin 
userSchema.plugin(findOrCreate);


const User = new mongoose.model('User', userSchema);

passport.use(User.createStrategy()); //using passport local mongoose to create a local user strategy
passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
 
passport.deserializeUser(function(id, done) {
User.findById(id, function(err, user) {
    done(err, user);
});
});

passport.use(new GoogleStrategy({
    clientID:  process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
      console.log(profile);

      User.findOrCreate({
        googleId: profile.id,
        username: profile.emails[0].value
    }, (err, user) => {
        return cb(err, user);
    });
}
));



app.get("/", (req, res) => {
    res.render("home");
});

app.route('/auth/google')

  .get(passport.authenticate('google', {

    scope: ['profile']

  }));

app.get( '/auth/google/secrets',
    passport.authenticate( 'google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
}));


app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.get("/secrets", function (req, res) {
    User.find({"secret": {$ne:null}}, function(err, foundUsers){
        if(err){
            console.log(err);
        } else {
            if(foundUsers) {
                res.render("secrets", {usersWithSecrets: foundUsers});
            }
        }
    });
});


app.get("/submit", function(req, res){
   if(req.isAuthenticated()){
       res.render("submit");
   } else{
       res.redirect("/login");
   }
});


app.post("/submit", function(req, res){
    const submittedSecret = req.body.submittedSecret;
    console.log(req.user.id);

    User.findById(req.user.id, function(err, foundUser){
        if(err) {
            console.log(err);
        } else {
            if(foundUser) {
                foundUser.secret = submittedSecret;
                foundUser.save(function() {
                    res.redirect("/secrets")
                });
            }
        }
    });
});

app.get("/logout", function(req, res) {
    req.logout();
    res.redirect("/");
});

app.post("/register", (req, res) => {


    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    })
   
});


passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ username: "",
      facebookId: profile.id
    }, function(err, user) {
      return cb(err, user);
    });
  }
));
     

app.get('/auth/facebook',

  passport.authenticate('facebook', { scope: 'public_profile'})

);
 
  app.get("/auth/facebook/secrets",
 
    passport.authenticate("facebook", { failureRedirect: "/login" }),
 
    function(req, res) {
 
      // Successful authentication, redirect home.
 
      res.redirect("/secrets");
 
    });


app.post("/login", passport.authenticate("local"), function(req, res){
    res.redirect("/secrets");
});



app.listen(3000, (req, res) => {
    console.log("server running on port 3000")
})