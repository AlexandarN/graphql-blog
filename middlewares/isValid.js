const {check, body} = require('express-validator/check');

exports.checkPosts = [
     body('title')
          .trim()
          .isLength({min: 5}),
     body('content')
          .trim()
          .isLength({min: 5})
]

const User = require('../models/User');

exports.checkSignup = [
     check('email')
          .isEmail()
          .withMessage('Please enter a valid email!')
          .normalizeEmail({gmail_remove_dots: false})
          .custom((value, {req}) => {
               return User.findOne({email: value})
                    .then(user => {
                         if(user) {
                              return Promise.reject('User with this email already exists!');
                         }
                    })
          }),
     body('password', 'Enter password with at least 5 characters, containing only numbers and letters!')
          .trim()
          .isLength({min: 5, max: 20}),
     body('name')
          .trim()
          .not()
          .isEmpty()
]

exports.checkStatus = [
     body('status')
          .trim()
          .not()
          .isEmpty()
]