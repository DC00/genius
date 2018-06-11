const mongoose = require('mongoose');

let schema = new mongoose.Schema({
	name: String,
	iq: Number,
	followers: Number,
	annotations: Number,
	url: String
});

let Artist = mongoose.model('Artist', schema);

module.exports = Artist;
