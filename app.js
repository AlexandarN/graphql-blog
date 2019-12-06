// IMPORTING NPM PACKAGEs	
const express = require('express'); 
const path = require('path');   
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const graphqlExpress = require('express-graphql');

// IMPORTING ROUTEs, CONTROLLERs and MODELs
const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const isAuth = require('./middlewares/isAuth');
const fileManipulator = require('./middlewares/fileManipulator');

// INITIATION of NPM PACKAGEs	
const app = express();
const MONGODB_URI = 'mongodb+srv://al_nikolic:Peradetlic1@cluster0-eyxah.mongodb.net/blog?retryWrites=true';

const fileStorage = multer.diskStorage({
     destination: (req, file, cb) => {
          cb(null, 'images');
     },
     filename: (req, file, cb) => {
          cb(null, new Date().toISOString() + '-' + file.originalname);
     }
});

const fileTypes = (req, file, cb) => {
     if(file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'image/jpeg') {
             cb(null, true);
        } else {
             cb(null, false);
        }
};

// MIDDLEWAREs
app.use(bodyParser.json());
app.use('/images', express.static(path.resolve('images')));
app.use(multer({storage: fileStorage, fileFilter: fileTypes}).single('image'));

// MIDDLEWARE for neutralization of CORS Error
app.use((req, res, next) => {
     res.setHeader('Access-Control-Allow-Origin', '*');
     res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
     if(req.method === 'OPTIONS') {
          return res.sendStatus(200);
     }
     next();
});

// Routes MIDDLEWAREs -> uvek idu na kraju middleware sekcije
app.use(isAuth);

app.put('/add-image', (req, res, next) => {
     if(!req.isAuth) {
          throw new Error('Not authenticated!');
     }
     if(!req.file) {
          return res.status(200).json({message: 'No file provided.'});
     }
     if(req.body.oldPath) {
          fileManipulator.deleteFile(req.body.oldPath);
     }
     return res.status(201).json({message: 'File stored.', filePath: req.file.path});
});

app.use('/graphql', graphqlExpress({
     schema: graphqlSchema,
     rootValue: graphqlResolver,
     graphiql: true,
     customFormatErrorFn(err) {
          if(!err.originalError) {
               return err;
          }
          const data = err.originalError.data;
          const message = err.message || 'An error occurred!';
          const code = err.originalError.code || 500;
          return {message: message, data: data, status: code};
     }
}));

// Error handling MIDDLEWARE                                         
app.use((error, req, res, next) => {
     console.log(error);
     const errorStatus = error.httpStatusCode || 500;
     const errorMessage = error.message;
     const errorData = error.data;
     res.status(errorStatus).json({message: errorMessage, data: errorData});
});

// DB CONNECTION to APP. SERVER (STARTING THE APPLICATION)
mongoose.connect(MONGODB_URI, {useNewUrlParser: true})
     .then(result => {
          app.listen(8080);
     })
     .catch(err => console.log(err));