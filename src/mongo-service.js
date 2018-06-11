// insert or update events
function upsert(eventObj) {
  if (mongoose.connection.readyState == 0) {
    mongoose.connect(DB_URL);
  }

  const conditions = {
    title: eventObj.title
  };
  const options = {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true
  };

  Event.findOneAndUpdate(conditions, eventObj, options).exec()
    .then(function(result) {
      console.log("successfully inserted")
    })
    .catch(function(err) {
      console.log(err.message)
    });
}
