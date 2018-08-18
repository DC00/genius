var creds = require('./creds.json');
var mongoose = require('mongoose');
var Artist = require('./artist.js');
var mongoDB = creds.DB_URL;
mongoose.connect(mongoDB);
mongoose.Promise = global.Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

exports.upsert = function(artists) {
  artists.map(artist => {
    // match on these conditions
    const conditions = {
      name: artist.name,
      url: artist.url
    };

    const options = {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    };

    Artist.findOneAndUpdate(conditions, artist, options).exec()
      .then((artist) => {
        console.log("Inserted: ");
        console.log(artist);
      })
      .catch((artist) => {
        console.log("Error inserting: ");
        console.log(artist);
      });
  })
}

exports.upsertOne = function(artist) {
  console.log("########### in upsertOne ###########3")
  console.log(artist.annotations)
  
  // not matching on name bc parsing iq problem
  const conditions = {
    url: artist.url
  };

  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  };

  Artist.findOneAndUpdate(conditions, artist, options).exec()
    .then((artist) => {
      console.log("Inserted: ");
      console.log(artist);
    })
    .catch((artist) => {
      console.log("Error inserting: ");
      console.log(artist);
    });
}


