const {validationResult} = require('express-validator/check');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');

exports.putSignup = async (req, res, next) => {
     const valErrors = validationResult(req);
     try {
          if(!valErrors.isEmpty()) {
               const error = new Error('Validation failed!');
               error.httpStatusCode = 422;
               error.data = valErrors.array();
               throw error;
          }
          // Signup (create) user
          const email = req.body.email;
          const name = req.body.name;
          const password = req.body.password;
          const hashedPassword = await bcrypt.hash(password, 12);
               const user = new User({
                    email: email,
                    name: name,
                    password: hashedPassword
               });
          const result = await user.save();
               console.log(result);
               res.status(201).json({
                    message: 'User created successfully!',
                    userId: result._id
               });
          } catch(err) {
               if(!err.httpStatusCode) {
                    err.httpStatusCode = 500;
               }
               next(err);
          }
}

exports.postLogin = async (req, res, next) => {
     // Login user
     const email = req.body.email;
     const password = req.body.password;
     try {
          const user = await User.findOne({email: email});
               if(!user) {
                    const error = new Error('User not found!');
                    error.httpStatusCode = 404;
                    throw error;
               }
          const doMatch = await bcrypt.compare(password, user.password);
               if(!doMatch) {
                    const error = new Error('Passwords do not match!');
                    error.httpStatusCode = 401;
                    throw error;
               }
               const token = jwt.sign({
                    email: user.email,
                    userId: user._id.toString()
                    },
                    'supersecretkey',
                    {expiresIn: '1h'}
               );
               res.status(200).json({
                    token: token,
                    userId: user._id.toString()
               });
          } catch(err) {
               if(!err.httpStatusCode) {
                    err.httpStatusCode = 500;
               }
               next(err);
          }
}

exports.getUserStatus = async (req, res, next) => {
     try {
          const user = await User.findById(req.userId);
               if(!user) {
                    const error = new Error('User not found!');
                    error.httpStatusCode = 404;
                    throw error;
               }
               res.status(200).json({
                    status: user.status
               });
          } catch(err) {
               if(!err.httpStatusCode) {
                    err.httpStatusCode = 500;
               }
               next(err);
          }
}

exports.patchEditUserStatus = async (req, res, next) => {
     const newStatus = req.body.status;
     try {
          const user = await User.findById(req.userId);
               if(!user) {
                    const error = new Error('User not found!');
                    error.httpStatusCode = 404;
                    throw error;
               }
               user.status = newStatus;
               await user.save();
               res.status(200).json({
                    message: 'User status updated!',
               });
          } catch(err) {
               if(!err.httpStatusCode) {
                    err.httpStatusCode = 500;
               }
               next(err);
          }
}
