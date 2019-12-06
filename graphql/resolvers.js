const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Post = require('../models/Post');
const fileManipulator = require('../middlewares/fileManipulator');

module.exports = {
     createUser: async function({userInput}, req) {
          const errors = [];
          if(!validator.isEmail(userInput.email)) {
               errors.push({message: 'Email is not valid!'});
          }
          if(validator.isEmpty(userInput.password) || !validator.isLength(userInput.password, {min: 5})) {
               errors.push({message: 'Password is too short!'});
          }
          if(errors.length > 0) {
               const error = new Error('Invalid input.');
               error.data = errors;
               error.code = 422;
               throw error;
          }
          const existingUser = await User.findOne({email: userInput.email});
          if(existingUser) {
               const error = new Error('User aldready exists!');
               throw error;
          }
          // Signup (create) user
          const hashedPassword = await bcrypt.hash(userInput.password, 12);
          const user = new User({
               email: userInput.email,
               name: userInput.name,
               password: hashedPassword
          });
          const createdUser = await user.save();
          return {...createdUser._doc, _id: createdUser._id.toString()};
     },

     login: async function({email, password}, req) {
          const user = await User.findOne({email: email});
          if(!user) {
               const error = new Error('User not found!');
               error.code = 404;
               throw error;
          }
          const doMatch = await bcrypt.compare(password, user.password);
          if(!doMatch) {
               const error = new Error('Passwords do not match!')
               error.code = 401;
               throw error;
          }
          const token = jwt.sign({
               email: user.email,
               userId: user._id.toString() },
               'supersecretkey',
               {expiresIn: '1h'} 
          );
          return {token: token, userId: user._id.toString()};
     },

     createPost: async function({postInput}, req) {
          // Check if user is logged in
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          // Check validity of input data
          const errors = [];
          if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
               errors.push({message: 'Title is invalid!'});
          }
          if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
               errors.push({message: 'Content is invalid!'});
          }
          if(errors.length > 0) {
               fileManipulator.deleteFile(postInput.imageUrl);
               const error = new errors('Invalid input.');
               error.data = errors;
               error.code = 422;
               throw error;
          }
          // Find logged in user
          const user = await User.findById(req.userId);
          if(!user) {
               const error = new Error('User not found!');
               error.code = 401;
               throw error;
          }
          // Create post in DB
          const post = new Post({
               title: postInput.title,
               content: postInput.content,
               imageUrl: postInput.imageUrl,
               creator: user
          });
          const createdPost = await post.save();
          // Add created post to logged in user's posts
          user.posts.push(createdPost);
          await user.save();
          // Send response data to FE
          return {
               ...createdPost._doc,
               _id: createdPost._id.toString(),
               createdAt: createdPost.createdAt.toISOString(),
               updatedAt: createdPost.updatedAt.toISOString()
               };
     },

     editPost: async function({postId, postInput}, req) {
          // Check if user is logged in
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          // Check validity of input data
          const errors = [];
          if(validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, {min: 5})) {
               errors.push({message: 'Title is invalid!'});
          }
          if(validator.isEmpty(postInput.content) || !validator.isLength(postInput.content, {min: 5})) {
               errors.push({message: 'Content is invalid!'});
          }
          if(errors.length > 0) {
               fileManipulator.deleteFile(postInput.imageUrl);
               const error = new errors('Invalid input.');
               error.data = errors;
               error.code = 422;
               throw error;
          }
          // Find post to be edited
          const post = await Post.findById(postId)
               .populate('creator');
          if(!post) {
               const error = new Error('Post not found!');
               error.code = 404;
               throw error;
          }
          // Check if post belongs to legged in user
          if(post.creator._id.toString() !== req.userId) {
               const error = new Error('You are not authorized!');
               error.code = 403;
               throw error;
          }
          // Edit post
          post.title = postInput.title;
          post.content = postInput.content;
          if(postInput.imageUrl !== 'undefined') {
               post.imageUrl = postInput.imageUrl;
          }
          const updatedPost = await post.save();
          // Send response to frontend
          return {
               ...updatedPost._doc,
               _id: updatedPost._id.toString(),
               createdAt: updatedPost.createdAt.toISOString(),
               updatedAt: updatedPost.updatedAt.toISOString() 
          }
     },

     deletePost: async function({postId}, req) {
          // Check if user is logged in
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          // Find post to be edited
          const post = await Post.findById(postId);
          if(!post) {
               const error = new Error('Post not found!');
               error.code = 404;
               throw error;
          }
          // Check if post belongs to legged in user
          if(post.creator.toString() !== req.userId) {
               const error = new Error('You are not authorized!');
               error.code = 403;
               throw error;
          }
          fileManipulator.deleteFile(post.imageUrl);
          await Post.findByIdAndRemove(postId);
          // Remove deleted post from logged in user's posts
          const user = await User.findById(req.userId);
          user.posts.pull(postId);
          await user.save();
          // Send response data to FE
          return true;
     },

     getPosts: async function({page}, req) {
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          if(!page) {
               page = 1;
          }
          const ITEMS_PER_PAGE = 3;
          const totalPosts = await Post.find().countDocuments();
          const posts = await Post.find()
               .sort({createdAt: -1})
               .skip((page - 1) * ITEMS_PER_PAGE)
               .limit(ITEMS_PER_PAGE)
               .populate('creator');
          return {posts: posts.map(p => {
               return {...p._doc,
                    _id: p._id.toString(),
                    createdAt: p.createdAt.toISOString(),
                    updatedAt: p.updatedAt.toISOString()};
               }),
               totalPosts: totalPosts};
     },

     getPost: async function({postId}, req) {
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          const post = await Post.findById(postId)
               .populate('creator');
          if(!post) {
               const error = new Error('Post not found!');
               error.code = 404;
               throw error;
          }
          return {...post._doc,
               _id: post._id.toString(),
               createdAt: post.createdAt.toISOString(),
               updatedAt: post.updatedAt.toISOString()};
     },

     getUser: async function(args, req) {
          // Check if user is logged in
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          // Find logged in user
          const user = await User.findById(req.userId);
          if(!user) {
               const error = new Error('User not found!');
               error.code = 401;
               throw error;
          }
          // Send response data to FE
          return {...user._doc,
               _id: user._id.toString()};
     },

     editUserStatus: async function({newStatus}, req) {
          // Check if user is logged in
          if(!req.isAuth) {
               const error = new Error('Not authenticated!');
               error.code = 401;
               throw error;
          }
          // Find logged in user
          const user = await User.findById(req.userId);
          if(!user) {
               const error = new Error('User not found!');
               error.code = 401;
               throw error;
          }
          // Change user status
          user.status = newStatus;
          await user.save();
          // Send response data to FE
          return {...user._doc,
               _id: user._id.toString()};
     }

}