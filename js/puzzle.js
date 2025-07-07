
// how many interpolation points are inserted (actually inserted are n_interpolation-1) along one edge of a tile
const base_interpolation = 100;
class puzzle {
	constructor(layout0, seed0, style0, motif0, dimensions0, parentdiv0) {
		// puzzle resolution in x and y
		this.layout = layout0;
		// seed for the random generation of the tiling
		this.seed = seed0;
		// object that contains info on puzzle style; style.edges=<flat|regular>
		this.style = style0;

		// counter for puzzle progress (completion)
		this.totaledges = 2*this.layout[0]*this.layout[1] - this.layout[0] - this.layout[1];

		// parent container for puzzle pieces
		this.parentdiv = parentdiv0;

		// save image dimension in camera and pixel space
		this.dimensions = dimensions0;
		this.dimensions_px = [];
		this.aspectratio = dimensions0[1]/dimensions0[0];

		// average size of puzzlepieces (used to determine the offset of shadow and highlight offsets)
		this.averagetilesize = this.dimensions[0]/this.layout[0];

		// variables for image
		this.motif = motif0;
		// get natural image dimenions
		this.img = document.createElement('img');
		this.img.addEventListener("load", (event) => {
			this.dimensions_px[0] = this.img.naturalWidth;
			this.dimensions_px[1] = this.img.naturalHeight;
		});
		this.img.src = this.motif;

		// setup data structures
		this.pieces = [];
		for (var i = 0; i < this.layout[0]; i++) {
			this.pieces[i] = [];
			for (var j = 0; j < this.layout[1]; j++) {
				this.pieces[i][j] = new puzzlepiece(this, i, j, this.motif);
			}
		}
		// setup neighbor references, left bottom right top (in pieces' coodinates); // value 'undefined' if no neighbor in given direction
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
				if (i === 0) {
					this.pieces[i][j].neighbors = [undefined, this.pieces[i][j+1], this.pieces[i+1][j], this.pieces[i][j-1]];
				} else if (i === this.layout[0] - 1) {
					this.pieces[i][j].neighbors = [this.pieces[i-1][j], this.pieces[i][j+1], undefined, this.pieces[i][j-1]];
				} else {
					this.pieces[i][j].neighbors = [this.pieces[i-1][j], this.pieces[i][j+1], this.pieces[i+1][j], this.pieces[i][j-1]];
				}
				// initialize connections (true if neighbor undefined)
				for (var k = 0; k < 4; k++) {
					this.pieces[i][j].connections[k] = typeof(this.pieces[i][j].neighbors[k]) === 'undefined';
				}
			}
		}
	}
	// this routine reads the server-provided tile shape information into the client-side puzzle object
	readPieceShapes(listofpieces) {
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
				this.pieces[i][j].w = listofpieces[i][j].w;
				this.pieces[i][j].h = listofpieces[i][j].h;
			//	this.pieces[i][j].edges = listofpieces[i][j].edges;
				this.pieces[i][j].connections = listofpieces[i][j].connections;
			}
		}
	}
	// this sets up the tiling of pieces
	// somerng is a random number generator
	// include this on client side for performance reasons (exact duplicate)
	make_puzzlepiece_tiling(somedifficulty, somerng) {
		switch(this.style.edges) {
			case "flat":
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].w = this.dimensions[0]/this.layout[0];
						this.pieces[i][j].h = this.dimensions[1]/this.layout[1];
						this.pieces[i][j].x = i/this.layout[0]*this.dimensions[0];
						this.pieces[i][j].y = j/this.layout[1]*this.dimensions[1];
						this.pieces[i][j].z = i + j*this.layout[0];
					}
				}
				break;
			case "flat_irregular":
				somerng.seed(this.seed);
				// get list of points for corners of puzzle pieces
				switch(somedifficulty) {
					case 3:
						this.grid = this.create_puzzle_grid(0.05, somerng);
						break;
					default:
						this.grid = this.create_puzzle_grid(0.2, somerng);
				}

				// helper function that swaps out the x- and y-coordinates in an array of points
				var transpose_slice = function(somearray) {
					var result = [];
					for (const entry of somearray) {
						result.push([entry[1], entry[0]]);
					}
					return result;
				}

				// helper function that performs the interpolation between two points (given in somearray [[x0, y0], [x1, y1]])
				// for now just linear interpolation
				var interpolate_slice = function(somearray) {
					// find number of points along edge
					var n_interpolation = base_interpolation;
					var result = [somearray[0]];
					for (var n = 1; n <= n_interpolation; n++) {
						// interpolate x-coordinate
						var p = n/n_interpolation;
						var thisx = (1-p)*somearray[0][0] + p*somearray[1][0];
						var thisy = (1-p)*somearray[0][1] + p*somearray[1][1];

						result.push([thisx, thisy]);
					}
					return result;
				}

				// helper function that reverses the the points in a slice
				var reverse_slice = function(somearray) {
					var result = [];
					for (var n = somearray.length-1; n >= 0; n--) {
						result.push(somearray[n]);
					}
					return result;
				}

				// interpolate smooth curves to use as slices of puzzle
				// slices.x contains indices 0 .. this.layout[0] indexed by segments 0 .. this.layout[1]-1
				// slices.y analogously
				// a slice is the sampled smooth interpolation of the previously calculated grid
				var slices = {'x': [], 'y': []};

				// fill out x-direction
				for (var i = 0; i <= this.layout[0]; i++) {
					slices.x[i] = [];
					for (var j = 0; j < this.layout[1]; j++) {
						slices.x[i][j] = transpose_slice(interpolate_slice(transpose_slice([this.grid[i][j], this.grid[i][j+1]])));
					}
				}
				// fill out y-direction
				for (var i = 0; i < this.layout[0]; i++) {
					slices.y[i] = [];
					for (var j = 0; j <= this.layout[1]; j++) {
						slices.y[i][j] = interpolate_slice([this.grid[i][j], this.grid[i+1][j]]);
					}
				}

				// save parts of slices to edges of puzzle pieces + calculated remaining parameters
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].edges[0] = slices.x[i][j];
						this.pieces[i][j].edges[1] = slices.y[i][j+1];
						this.pieces[i][j].edges[2] = reverse_slice(slices.x[i+1][j]);
						this.pieces[i][j].edges[3] = reverse_slice(slices.y[i][j]);
						// top right - top left
						this.pieces[i][j].w = this.grid[i+1][j][0] - this.grid[i][j][0];
						// bottom left - top left
						this.pieces[i][j].h = this.grid[i][j+1][1] - this.grid[i][j][1];
						// and position
						this.pieces[i][j].x = this.grid[i][j][0];
						this.pieces[i][j].y = this.grid[i][j][1];
						this.pieces[i][j].z = i + this.layout[0]*j;
					}
				}

				break;
			case "regular":
				somerng.seed(this.seed);
				// get list of points for corners of puzzle pieces
				switch(somedifficulty) {
					case 2:
						this.grid = this.create_puzzle_grid(0.05, somerng);
						break;
					case 1:
						this.grid = this.create_puzzle_grid(0.10, somerng);
						break;
					case 0:
						this.grid = this.create_puzzle_grid(0.15, somerng);
						break;
				}

				// helper function that swaps out the x- and y-coordinates in an array of points
				var transpose_slice = function(somearray) {
					var result = [];
					for (const entry of somearray) {
						result.push([entry[1], entry[0]]);
					}
					return result;
				}

				// helper function that performs the interpolation between two points (given in somearray [[x0, y0], [x1, y1]])
				// only linear interpolation
				var interpolate_slice_linear = function(somearray) {
					// how many interpolation points are inserted (actually inserted are n_interpolation-1)
					const n_interpolation = 1;
					var result = [somearray[0]];
					for (var n = 1; n <= n_interpolation; n++) {
						// interpolate x-coordinate
						var p = n/n_interpolation;
						var thisx = (1-p)*somearray[0][0] + p*somearray[1][0];
						var thisy = (1-p)*somearray[0][1] + p*somearray[1][1];

						result.push([thisx, thisy]);
					}
					return result;
				}

				// helper function that performs the interpolation between two points (given in somearray [[x0, y0], [x1, y1]]) including the generation of a knob/hole
				var interpolate_slice_complex = function(somearray, someparameters) {
					// how many interpolation points are inserted (actually inserted are n_interpolation-1)
					const n_interpolation = 100;
					var result = [somearray[0]];
					for (var n = 1; n <= n_interpolation; n++) {
						// helper function definitions
						// linear tangential component of interpolation
						var linear_x = function(p, startx, deltax, someparameters) {
							if (p < someparameters.fractionB) {
								return startx + p*deltax;
							}
							if (p < someparameters.fractionB + someparameters.fractionA) {
								return startx + someparameters.fractionB*deltax;
							}
							return startx + p*deltax - deltax*someparameters.fractionA;
						}
						// linear normal component of interpolation
						var linear_y = function(p, starty, deltay, someparameters) {
							return starty + p*deltay;
						}
						// complex tangential component of interpolation
						var knob_x = function(p, someparameters) {
							if (p < 0) {
								return 0;
							}
							if (p > 1) {
								return 1;
							}
							return p + someparameters.tangential_amplitude * Math.sin(4*Math.PI*p) + someparameters.tangential_irregularity * Math.sin(3*Math.PI*p);
						}
						// complex normal component of interpolation
						var knob_y = function(p, someparameters) {
							if (p < 0) {
								return 0;
							}
							if (p > 1) {
								return 0;
							}
							return someparameters.normal_amplitude * 0.5 *(1 - Math.cos(2*Math.PI*p));
						}

						// interpolate x-coordinate
						var p = n/n_interpolation;
						var deltax = somearray[1][0] - somearray[0][0];
						var deltay = somearray[1][1] - somearray[0][1];
						var thisx = linear_x(p, somearray[0][0], deltax, someparameters) + deltax * someparameters.fractionA * knob_x((p - someparameters.fractionB)/someparameters.fractionA, someparameters);
						var thisy = linear_y(p, somearray[0][1], deltay, someparameters) + someparameters.sign * deltax * knob_y((p - someparameters.fractionB)/someparameters.fractionA, someparameters);

						result.push([thisx, thisy]);
					}
					return result;
				}

				// helper function that reverses the the points in a slice
				var reverse_slice = function(somearray) {
					var result = [];
					for (var n = somearray.length-1; n >= 0; n--) {
						result.push(somearray[n]);
					}
					return result;
				}

				// helper that calculates a random value from a given range
				var get_random_value_from_range = function(x0, x1) {
					return x0 + somerng.get() * (x1-x0);
				}

				// helper that calculates a random set of shape parameters
				var get_shape_parameters = function() {
					var result = {};
					// which piece has knob and which has hole
					result.sign = 0;
					if (somerng.get() > 0.5)
						result.sign = 1;
					else
						result.sign = -1;
					switch(somedifficulty) {
						case 2:
							// on what fraction does the structure exist
							result.fractionA = 1.0/2.85;
							// where is the structure located
							result.fractionB = 1.0*(1-result.fractionA)/2.0;
							// tangential amplitude
							result.tangential_amplitude = 0.2;
							// normal amplitude
							result.normal_amplitude = 0.325;
							// tangential_irregularity
							result.tangential_irregularity = 0.0;
							break;
						case 1:
							// on what fraction does the structure exist
							result.fractionA = 1.0/get_random_value_from_range(2.66, 3.0);
							// where is the structure located
							result.fractionB = get_random_value_from_range(0.8, 1.2)*(1-result.fractionA)/2.0;
							// tangential amplitude
							result.tangential_amplitude = get_random_value_from_range(0.18, 0.22);
							// normal amplitude
							result.normal_amplitude = get_random_value_from_range(0.3, 0.35);
							// tangential_irregularity
							result.tangential_irregularity = get_random_value_from_range(-0.1, 0.1);
							break;
						case 0:
							// on what fraction does the structure exist
							result.fractionA = 1.0/get_random_value_from_range(2.25, 3.25);
							// where is the structure located
							result.fractionB = get_random_value_from_range(0.6, 1.4)*(1-result.fractionA)/2.0;
							// tangential amplitude
							result.tangential_amplitude = get_random_value_from_range(0.15, 0.25);
							// normal amplitude
							result.normal_amplitude = get_random_value_from_range(0.25, 0.4);
							// tangential_irregularity
							result.tangential_irregularity = get_random_value_from_range(-0.2, 0.2);
							break;
					}
					return result;
				};

				// interpolate smooth curves to use as slices of puzzle
				// slices.x contains indices 0 .. this.layout[0] indexed by segments 0 .. this.layout[1]-1
				// slices.y analogously
				// a slice is the sampled smooth interpolation of the previously calculated grid
				var slices = {'x': [], 'y': []};

				// fill out x-direction
				for (var i = 0; i <= this.layout[0]; i++) {
					slices.x[i] = [];
					for (var j = 0; j < this.layout[1]; j++) {
						// only make complex edge if inside of tiling (instead of at the border)
						if (i === 0 || i === this.layout[0]) {
							slices.x[i][j] = transpose_slice(interpolate_slice_linear(transpose_slice([this.grid[i][j], this.grid[i][j+1]])));
						} else {
							// determine shape parameters
							var parameters = get_shape_parameters();

							// make slice
							slices.x[i][j] = transpose_slice(interpolate_slice_complex(transpose_slice([this.grid[i][j], this.grid[i][j+1]]), parameters));
						}
					}
				}
				// fill out y-direction
				for (var i = 0; i < this.layout[0]; i++) {
					slices.y[i] = [];
					for (var j = 0; j <= this.layout[1]; j++) {
						// only make complex edge if inside of tiling (instead of at the border)
						if (j === 0 || j === this.layout[1]) {
							slices.y[i][j] = interpolate_slice_linear([this.grid[i][j], this.grid[i+1][j]]);
						} else {
							// determine shape parameters
							var parameters = get_shape_parameters();

							// make slice
							slices.y[i][j] = interpolate_slice_complex([this.grid[i][j], this.grid[i+1][j]], parameters);
						}
					}
				}

				// save parts of slices to edges of puzzle pieces + calculated remaining parameters
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].edges[0] = slices.x[i][j];
						this.pieces[i][j].edges[1] = slices.y[i][j+1];
						this.pieces[i][j].edges[2] = reverse_slice(slices.x[i+1][j]);
						this.pieces[i][j].edges[3] = reverse_slice(slices.y[i][j]);
						// top right - top left
						this.pieces[i][j].w = this.grid[i+1][j][0] - this.grid[i][j][0];
						// bottom left - top left
						this.pieces[i][j].h = this.grid[i][j+1][1] - this.grid[i][j][1];
						// and position
						this.pieces[i][j].x = this.grid[i][j][0];
						this.pieces[i][j].y = this.grid[i][j][1];
						this.pieces[i][j].z = i + this.layout[0]*j;
					}
				}

				break;
			default:
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].w = this.dimensions[0]/this.layout[0];
						this.pieces[i][j].h = this.dimensions[1]/this.layout[1];
						this.pieces[i][j].x = i/this.layout[0]*this.dimensions[0];
						this.pieces[i][j].y = j/this.layout[1]*this.dimensions[1];
						this.pieces[i][j].z = i + this.layout[0]*j;
					}
				}
		}
		// save positions of pieces within puzzle
		for (var j = 0; j < this.layout[1]; j++) {
			for (var i = 0; i < this.layout[0]; i++) {
				this.pieces[i][j].x0 = [this.pieces[i][j].edges[0][0][0], this.pieces[i][j].edges[1][0][0], this.pieces[i][j].edges[2][0][0], this.pieces[i][j].edges[3][0][0]];
				this.pieces[i][j].y0 = [this.pieces[i][j].edges[0][0][1], this.pieces[i][j].edges[1][0][1], this.pieces[i][j].edges[2][0][1], this.pieces[i][j].edges[3][0][1]];
			}
		}
	}
	// this creates a 2d-set of points for the corner points of puzzle pieces
	// somerange determines how far the regular points are perturbed and somerng is a random number generator
	create_puzzle_grid(somerange, somerng) {
		var result = []
		for (var i = 0; i <= this.layout[0]; i++) {
			result[i] = [];
			for (var j = 0; j <= this.layout[1]; j++) {
				// handle puzzle border having only 1d perturbation
				var thisrangex = somerange, thisrangey = somerange;
				if (i === 0 || i === this.layout[0]) {
					thisrangex = 0;
				}
				if (j === 0 || j === this.layout[1]) {
					thisrangey = 0;
				}
				result[i][j] = [(i + 2.0*thisrangex*(somerng.get() - 0.5))/this.layout[0]*this.dimensions[0],
			                  (j + 2.0*thisrangey*(somerng.get() - 0.5))/this.layout[1]*this.dimensions[1]];
			}
		}
		return result;
	}
	// this routine reads the server-provided positioning information into the client-side puzzle object
	readPieceCoordinates(listofpieces) {
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
				this.pieces[i][j].x = listofpieces[i][j].x;
				this.pieces[i][j].y = listofpieces[i][j].y;
				this.pieces[i][j].x0 = listofpieces[i][j].x0;
				this.pieces[i][j].y0 = listofpieces[i][j].y0;
				this.pieces[i][j].z = listofpieces[i][j].z;
				this.pieces[i][j].angle = listofpieces[i][j].angle;
			}
		}
	}
	generatePieceClippaths() {
		switch(this.style.edges) {
			case "flat":
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].setuptestclip();
						this.pieces[i][j].applyclip();
					}
				}
				break;
			case "flat_irregular":
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].setupclip();
						this.pieces[i][j].applyclip();
					}
				}
				break;
			case "regular":
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].setupclip();
						this.pieces[i][j].applyclip();
					}
				}
				break;
			default:
				for (var i = 0; i < this.layout[0]; i++) {
					for (var j = 0; j < this.layout[1]; j++) {
						this.pieces[i][j].setuptestclip();
						this.pieces[i][j].applyclip();
					}
				}
		}
		// use information on piece shape to prepare positioning of piece in different orientations
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
				// the top left corner of piece (game's frame) is kept at a constant position (pre-/post rotation)
				// hard to explain why it looks like this.. can be easily constructed from sketches (note that here translateX moves in x-direction in piece's frame not game's frame..)
				this.pieces[i][j].angleoffset[0] = [0, 0];
				this.pieces[i][j].angleoffset[1] = [(this.pieces[i][j].pathouter[0][0] - this.pieces[i][j].edges[1][0][0]) - (this.pieces[i][j].pathouter[0][1] - this.pieces[i][j].edges[0][0][1]), (this.pieces[i][j].pathouter[0][1] - this.pieces[i][j].edges[1][0][1]) + (this.pieces[i][j].pathouter[0][0] - this.pieces[i][j].edges[0][0][0])];
				this.pieces[i][j].angleoffset[2] = [(this.pieces[i][j].pathouter[0][0] - this.pieces[i][j].edges[2][0][0]) + (this.pieces[i][j].pathouter[0][0] - this.pieces[i][j].edges[0][0][0]), (this.pieces[i][j].pathouter[0][1] - this.pieces[i][j].edges[2][0][1]) + (this.pieces[i][j].pathouter[0][1] - this.pieces[i][j].edges[0][0][1])];
				this.pieces[i][j].angleoffset[3] = [(this.pieces[i][j].pathouter[0][0] - this.pieces[i][j].edges[3][0][0]) + (this.pieces[i][j].pathouter[0][1] - this.pieces[i][j].edges[0][0][1]), (this.pieces[i][j].pathouter[0][1] - this.pieces[i][j].edges[3][0][1]) - (this.pieces[i][j].pathouter[0][0] - this.pieces[i][j].edges[0][0][0])];
			}
		}
	}
	insertPieces() {
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
		 		this.parentdiv.append(this.pieces[i][j].divcontainer);
		 		this.parentdiv.append(this.pieces[i][j].divedgeshadowcontainer);
		 		this.parentdiv.append(this.pieces[i][j].divedgehighlightcontainer);
			}
		}
	}
	// updates the puzzle piece locations during camera pan/zoom
	updatePiecePositions() {
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
				// no interuption during animation..
				if (typeof(this.pieces[i][j].rotation_timer) !== 'undefined') continue;

				var piece = this.pieces[i][j];
				if (typeof(piece.rotation_timer) === 'undefined') {
					// position puzzle piece
					piece.divcontainer.style.left = thiscamera.getx_px(piece.x - (piece.x0[0] - piece.pathouter[0][0])) + "px";
					piece.divcontainer.style.top = thiscamera.gety_px((piece.y - (piece.y0[0] - piece.pathouter[0][1]))) + "px";
					piece.divcontainer.style.zIndex = piece.z;
					// position shadows & highlights of piece
					piece.divedgeshadowcontainer.style.left = thiscamera.getx_px(-puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.x - (piece.x0[0] - piece.pathouter[0][0])) + "px";
					piece.divedgeshadowcontainer.style.top = thiscamera.gety_px(( puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.y - (piece.y0[0] - piece.pathouter[0][1]))) + "px";
					piece.divedgeshadowcontainer.style.zIndex = piece.z-1;
					// position shadows & highlights of piece
					piece.divedgehighlightcontainer.style.left = thiscamera.getx_px( puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.x - (piece.x0[0] - piece.pathouter[0][0])) + "px";
					piece.divedgehighlightcontainer.style.top = thiscamera.gety_px((-puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.y - (piece.y0[0] - piece.pathouter[0][1]))) + "px";
					piece.divedgehighlightcontainer.style.zIndex = piece.z-1;
				} else {
					var cosangle = Math.cos(piece.animation_angle*Math.PI/2);
					var sinangle = Math.sin(piece.animation_angle*Math.PI/2);
					// get interpolated relative vector for correct positioning (changing corner of reference)
					var interpolatedx = piece.rotate_anim_current*(piece.x0[piece.rotate_anim_end%4] - thispuzzle.pieces[i][j].x0[piece.rotate_anim_end%4])
															+ (1-piece.rotate_anim_current)*(piece.x0[piece.rotate_anim_start%4] - thispuzzle.pieces[i][j].x0[piece.rotate_anim_start%4]);
					var interpolatedy = piece.rotate_anim_current*(piece.y0[piece.rotate_anim_end%4] - thispuzzle.pieces[i][j].y0[piece.rotate_anim_end%4])
															+ (1-piece.rotate_anim_current)*(piece.y0[piece.rotate_anim_start%4] - thispuzzle.pieces[i][j].y0[piece.rotate_anim_start%4]);
					// transform relative position
					var deltax = interpolatedx*cosangle - interpolatedy*sinangle;
					var deltay = interpolatedx*sinangle + interpolatedy*cosangle;

					// position piece accordingly
					piece.x = thispuzzle.pieces[i][j].x + deltax;
					piece.y = thispuzzle.pieces[i][j].y + deltay;

					// update div positioning
					piece.divcontainer.style.left = thiscamera.getx_px(piece.x - (piece.x0[0] - piece.pathouter[0][0])) + "px";
					piece.divcontainer.style.top = thiscamera.gety_px((piece.y - (piece.y0[0] - piece.pathouter[0][1]))) + "px";
					// position shadows & highlights of piece
					piece.divedgeshadowcontainer.style.left = thiscamera.getx_px(-puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.x - (piece.x0[0] - piece.pathouter[0][0])) + "px";
					piece.divedgeshadowcontainer.style.top = thiscamera.gety_px(( puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.y - (piece.y0[0] - piece.pathouter[0][1]))) + "px";
					// position shadows & highlights of piece
					piece.divedgehighlightcontainer.style.left = thiscamera.getx_px( puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.x - (piece.x0[0] - piece.pathouter[0][0])) + "px";
					piece.divedgehighlightcontainer.style.top = thiscamera.gety_px((-puzzlepiece_shadows_highlights_offset*this.averagetilesize + piece.y - (piece.y0[0] - piece.pathouter[0][1]))) + "px";
				}
			}
		}
	}
	// updates the puzzle piece angle, offset, and scale
	updatePieceTransformation() {
		for (var i = 0; i < this.layout[0]; i++) {
			for (var j = 0; j < this.layout[1]; j++) {
				// no interuption during animation..
				if (typeof(this.pieces[i][j].rotation_timer) !== 'undefined') continue;

				// calculate angle-specific offset
				var translateX_current = thiscamera.getlength_px(this.pieces[i][j].angleoffset[this.pieces[i][j].angle][0]);
				var translateY_current = thiscamera.getlength_px(this.pieces[i][j].angleoffset[this.pieces[i][j].angle][1]);

				var transformstring = "rotate(" + this.pieces[i][j].angle*90 + "deg) translateX(" + translateX_current + "px) translateY(" + translateY_current + "px) scale(" + thiscamera.zoom + ")";

				// apply that transformation
				this.pieces[i][j].divcontainer.style.transform = transformstring;
				this.pieces[i][j].divedgeshadowcontainer.style.transform = transformstring;
				this.pieces[i][j].divedgehighlightcontainer.style.transform = transformstring;
			}
		}
	}
}