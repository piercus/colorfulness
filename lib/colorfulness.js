const cv = require('opencv');

//
//  Steps are
//  1. Build 2 histograms from images using calcHist
//  2. Transform each histogram to a 64 x 4 (hist, b, g, r) x 1 normalized signatures in BGR space
//  3. Compute the cost matrix (64 x 64 x 1), calculating the cost in LUV space
//  4. Run EMD algorithm
//

// / Useful flatten function for step 2

function flatten(array, accu) {
	if (!accu) {
		accu = [];
	}
	array.forEach(a => {
		if (Array.isArray(a)) {
			flatten(a, accu);
		} else {
			accu.push(a);
		}
	});
	return accu;
}

const colorfulness = function (options, cb) {
	let filename;

	if (typeof (options) === 'string') {
		filename = options;
		options = {};
	} else {
		filename = options.filename;
	}

	const bins = options.bins || 4;
	cv.readImage(filename, (err, im) => {
		if (err) {
			cb(err);
		}
		if (im.width() < 1 || im.height() < 1) {
			cb(new Error('Image has no size'));
		}

      // /////////////////
      //  1. Build 2 histograms from images using calcHist
      // ////////////////
		try {
			const size = [bins, bins, bins];
			const channels = [0, 1, 2];
			const range = [[0, 256], [0, 256], [0, 256]];
			const uniform = true;

        // / Compute 64 (=4^3) histograms:
			const firstImageHist64 = cv.histogram.calcHist(im, channels, size, range, uniform);

        // ////////////
        //  2. Transform each histogram to a 64 x 4 (hist, b, g, r) x 1 normalized signatures in BGR space
        // //////////////

			const step = 256 / bins;
			const halfStep = Math.round(step / 2);

			let sum1 = 0;

			firstImageHist64.map(bHist => {
				return bHist.map(bgHist => {
					return bgHist.map(bgrHist => {
						sum1 += bgrHist;
						return null;
					});
				});
			});

			const sig1 = flatten(firstImageHist64.map((bHist, bIndex) => {
				return bHist.map((bgHist, gIndex) => {
					return bgHist.map((bgrHist, rIndex) => {
						return {
							data: [
                  [bgrHist / sum1],
                  [(bIndex * step) + halfStep],
                  [(gIndex * step) + halfStep],
                  [(rIndex * step) + halfStep]
							]
						};
					});
				});
			})).map(a => {
          // Trick to avoid flattening and get a 64 x 4 x 1 image as needed
				return a.data;
			});

			const sig2 = flatten(firstImageHist64.map((bHist, bIndex) => {
				return bHist.map((bgHist, gIndex) => {
					return bgHist.map((bgrHist, rIndex) => {
						return {
							data: [
                  [1 / 64],
                  [(bIndex * step) + halfStep],
                  [(gIndex * step) + halfStep],
                  [(rIndex * step) + halfStep]
							]
						};
					});
				});
			})).map(a => {
          // Trick to avoid flattening and get a 64 x 4 x 1 image as needed
				return a.data;
			});

        // ///////////
        //  3. Compute the cost matrix (64 x 64 x 1), calculating the cost in LUV space
        // ///////////

        // middles is a 1 x 64 x 3 array of the middles positions in RGB used to change to LUV
			const middles = [flatten(firstImageHist64.map((bHist, bIndex) => {
				return bHist.map((bgHist, gIndex) => {
					return bgHist.map((bgrHist, rIndex) => {
						return {
							data: [
								(bIndex * step) + halfStep,
								(gIndex * step) + halfStep,
								(rIndex * step) + halfStep
							]
						};
					});
				});
			})).map(a => {
          // Trick to avoid flattening and get a 1 x 64 x 3 image as needed
				return a.data;
			})];

			const mat = cv.Matrix.fromArray(middles, cv.Constants.CV_8UC3);
			mat.cvtColor('CV_BGR2Luv');

        // LuvValues is a 1 x 64 x 3 array of the middles positions in LUV
			const luvMiddles = mat.toArray();

			const distance = function (luv1, luv2) {
				return Math.sqrt(((luv1[0] - luv2[0]) * (luv1[0] - luv2[0])) + ((luv1[1] - luv2[1]) * (luv1[1] - luv2[1])) + ((luv1[2] - luv2[2]) * (luv1[2] - luv2[2])));
			};
			let max = 0;
			let costs = luvMiddles[0].map(luvMiddle1 => {
				return luvMiddles[0].map(luvMiddle2 => {
					const d = distance(luvMiddle1, luvMiddle2);
					if (max < d) {
						max = d;
					}
					return [d];
				});
			});
			costs = costs.map(c1 => {
				return c1.map(c2 => {
					return c2.map(c => {
						return c / max;
					});
				});
			});

      //var str = "";
      //middles[0].map(function(a, i){str+="| cube "+i+" | `["+a+"]` | `["+luvMiddles[0][i]+"]` |\n"})
      //console.log(str)

      /*var str = ""
      str += "| | "+costs.map(function(a, i){
        return "cube "+i;
      }).join(" | ")+" | SUM |\n";

      str += "|---|"+costs.map(function(a, i){
        return "---";
      }).join("|")+"|---|\n";

      str += costs.map(function(a, i){
        var sum = 0;
        var str1 = "| cube "+i+" | "+a.map(function(b){
          sum+=b[0];
          return b[0].toFixed(2)
        }).join(" | ")+" | ";
        str1+=sum.toFixed(2)+" |";
        return str1;
      }).join("\n")

      console.log(str);*/

        // ////
        //  4. Run EMD algorithm
        // ///

			const matCosts = cv.Matrix.fromArray(costs, cv.Constants.CV_32FC1);
			const matSig1 = cv.Matrix.fromArray(sig1, cv.Constants.CV_32FC1);
			const matSig2 = cv.Matrix.fromArray(sig2, cv.Constants.CV_32FC1);

			const dist = cv.Constants.CV_DIST_USER;
			const emd = cv.histogram.emd(matSig1, matSig2, dist, matCosts);
			return cb(null, 1 - emd);
		} catch (err) {
			cb(err);
		}
	});
};

module.exports = colorfulness;
