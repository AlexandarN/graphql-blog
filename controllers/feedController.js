const { validationResult } = require('express-validator/check'); 

const Post = require('../models/Post');
const User = require('../models/User');
const fileManipulator = require('../middlewares/fileManipulator');
const scktIO = require('../socket');

const ITEMS_PER_PAGE = 3;

exports.getPostsPage = async (req, res, next) => {
     const page = req.query.page || 1;
     let totalPosts;
     try {
          const totalPosts = await Post.find().countDocuments();
          const posts = await Post.find()
               .populate('creator')
               .sort({createdAt: -1})
               .skip((page - 1) * ITEMS_PER_PAGE)
               .limit(ITEMS_PER_PAGE);
          res.status(200).json({
               message: 'Posts fetched successfully!',			  
               posts: posts,
               totalItems: totalPosts
          });
     } catch (err) {
          if(!err.httpStatusCode) {
               err.httpStatusCode = 500;
          }
          next(err);
     }	      
}  

exports.createPost = async (req, res, next) => {
     const image = req.file;
     if(!image) {
          const error = new Error('No image attached!');
          error.httpStatusCode = 422;
          throw error; 
     }
     const imageUrl = image.path;
     try {
          const valErrors = validationResult(req);
          if(!valErrors.isEmpty()) {
               console.log(valErrors.array());
               fileManipulator.deleteFile(imageUrl);
               const error = new Error('Validation failed!');
               error.httpStatusCode = 422;
               throw error;
          }
          // Create post in DB
          const title = req.body.title;
          const content = req.body.content;
          const post = new Post ({
               title: title,
               content: content,
               imageUrl: imageUrl,
               creator: req.userId
          });
          await post.save();
          // Add created post to loggedin user's posts
          const user = await User.findById(req.userId);
          user.posts.push(post);
          await user.save();
          //Send response data to FE
          scktIO.getIO().emit('postEvent', {
               action: 'create', 
               post: {...post._doc, creator: {_id: user._id, name: user.name}} 
          });
          res.status(201).json({
               message: 'Post created succesfully!',
               post: post,
               creator: {_id: user._id, name: user.name}
          });
          } catch (err) {
               if(!err.httpStatusCode) {
                    err.httpStatusCode = 500;
               }
               next(err);
          }
}
       
exports.getPost = async (req, res, next) => {
     const postId = req.params.postId;	  
     try {  
	     const post = await Post.findById(postId);
			if(!post) {
				const error = new Error('Post not found!');
				error.httpStatusCode = 404;				            
                    throw error; 
               }     		        
			res.status(200).json({
				message: 'Post is fetched!',
                    post: post 
               });   
		} catch (err) {
			if(!err.httpStatusCode) {
                    err.httpStatusCode = 500; 
               }
               next(err); 
          }
}	                              

exports.putEditPost = async (req, res, next) => {
     const image = req.file;
     try {
          const valErrors = validationResult(req);
          if(!valErrors.isEmpty) {
               fileManipulator.deleteFile(image.path);
               const error = new Error('Validation failed!');
               error.httpStatusCode = 422;
               throw error;
          }
          const postId = req.params.postId;
          const post = await Post.findById(postId)
               .populate('creator');
          if(!post) {
               const error = new Error('Post not found!');
               error.httpStatusCode = 404;
               throw error;
          }
          if(post.creator._id.toString() !== req.userId) {
               const error = new Error('You are not authorized for this action!');
               error.httpStatusCode = 403;
               throw error;
          }
          post.title = req.body.title;
          post.content = req.body.content;
          if(image) {
               fileManipulator.deleteFile(post.imageUrl);
               post.imageUrl = image.path;
          }
          const result = await post.save()
          //Send response data to FE
          scktIO.getIO().emit('postEvent', {
               action: 'edit', 
               post: result
          });
               console.log(result);
               res.status(200).json({
                    message: 'Post updated successfully!',
                    post: result
               });
          } catch(err) {
			if(!err.httpStatusCode) {
                    err.httpStatusCode = 500; 
               }
               next(err); 
          }
}

exports.deletePost = async (req, res, next) => {
     const postId = req.params.postId;
     try {
          const post = await Post.findById(postId);
          if(!post) {
               const error = new Error('Post not found!');
               error.httpStatusCode = 404;
               throw error;
          }
          //Check if post belongs to logged in user
          if(post.creator.toString() !== req.userId) {
               const error = new Error('You are not authorized for this action!');
               error.httpStatusCode = 403;
               throw error;
          }
          fileManipulator.deleteFile(post.imageUrl);
          await Post.findByIdAndRemove(postId);
          // Remove deleted post from loggedin user's posts
          const user = await User.findById(req.userId);
          user.posts.pull(postId);
          await user.save();
          // Send response data to FE
          scktIO.getIO().emit('postEvent', {
               action: 'delete', 
               post: post
          });
               res.status(200).json({
                    message: 'Post deleted successfully!'
               });
          } catch(err) {
               if(!err.httpStatusCode) {
                    err.httpStatusCode = 500;
               }
               next(err);
          }
}