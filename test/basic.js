const colorfulness = require('../index.js');

const files = ['test/files/car1.jpg', 'test/files/mona.png', 'test/files/stuff.png', 'test/files/neutral.png', 'test/files/amaro.png', 'test/files/FFFFFF.png', 'test/files/000000.png', 'test/files/00FFFF.png'];

const startTime = new Date();

Promise.all(files.map(filename => {
	return new Promise((resolve, reject) => {
		return colorfulness({
			filename,
			bins: 4
		}, (err, measure) => {
			if (err) {
				return reject(err);
			}
			return resolve({filename, measure});
		});
	});
})).then(results => {
	console.log('Results are : ', results);
	console.log('Time spent is : ', (new Date()) - startTime);
}).catch(err => {
	console.log('Error occured : ', err);
	throw (err);
});
