const fs = require('fs');

exports.deleteFile = (path) => {
     fs.unlinkSync(path, err => {
          if(err) {
               throw err;
          }
     });
}