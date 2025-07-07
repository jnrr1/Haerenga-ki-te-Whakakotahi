
const puzzlepiece_shadows_highlights_offset = 0.018;
const puzzlepiece_shadowcolor = "rgb(50, 50, 50)";
const puzzlepiece_highlightcolor = "rgb(200, 200, 200)";
class puzzlepiece {
	constructor(parentpuzzle0, i0, j0, motifurl) {
		this.parentpuzzle = parentpuzzle0;

		// indexed position in puzzle grid
		this.i = i0; // x-direction; left (0) -> right (this.parentpuzzle.layout[0])
		this.j = j0; // y-direction; top (0) -> bottom (this.parentpuzzle.layout[1])
		// actual position in game
		this.x = 0;
		this.y = 0;
		// position in completed puzzle with relation to the top left|bottom left|bottom right|top right corner (in piece's coordinates)
		this.x0 = [];
		this.y0 = [];
		// css z-index
		this.z = 0;
		// actual dimensions in game
		this.w = 0;
		this.h = 0;
		// orientation in game's frame; takes values 0..3 for having normal of left edge (piece's frame) oriented in left|bottom|right|top direction (game's frame)
		this.angle = 0;
		// used for determining the offset (game's frame) introduced by having the axis for rotation at the top left (piece's frame)
		this.angleoffset = [[0, 0], [], [], []];
		// used to implement animated rotation of pieces
		this.rotation_timer = undefined;
		this.animation_angle = 0;
		this.rotate_anim_current = 0;
		this.rotate_anim_start = 0;
		this.rotate_anim_end = 0;

		// paths along which the piece is cut, left bottom right top
		this.edges = [];
		// references to neighbors, left bottom right top (in pieces' coodinates); // value 'undefined' if no neighbor in some direction
		this.neighbors = [];
		// boolean values for whether piece is connected to respective neighbor, left bottom right top (in pieces' coodinates)
		this.connections = [false, false, false, false];

		// these define the clip-path, where inner has the fine details and outer constitutes a bounding box (tl|br)
		this.pathinner = [];
		this.pathouter = [];

		// wrap img in div which is at fitting size & has overflow:hidden
		// the img is then (later) clipped and shifted inside this div
		this.divcontainer = document.createElement('div');
		//this.divcontainer.style.background = "rgba(255,255,255,0.8)";
		this.divcontainer.style.overflow = "hidden";
		this.divcontainer.style.position = "absolute";
		this.divcontainer.style.width = "0%";
		this.divcontainer.style.height = "0%";
		this.divcontainer.style.transformOrigin = "top left";
		this.divcontainer.style.pointerEvents = "none";
		this.img = document.createElement('img');
		this.img.setAttribute('draggable', false);
		if (typeof(motifurl) === 'string') {
			this.img.src = motifurl;
		}
		this.img.style.position = "absolute";
		this.img.style.pointerEvents = "auto";
		this.divcontainer.append(this.img);

		// more elements for edge shadow/highlight
		// divs are clipped just like img-element and positioned with small offset
		this.shadows_highlights_offset = 0.0015;
		this.divedgeshadowcontainer;
		this.divedgeshadowcontainer_bg;
		this.divedgehighlightcontainer;
		this.divedgehighlightcontainer_bg;

		// similar to server-side implementation; used to find pieces that have to be moved alongside one another
		// contains references to all pieces that are in the partition of this piece
		this.partition = [];
	}
	setmotif(motifurl) {
		this.img.src = motifurl;
	}
	setuptestclip() {
		// this routine is used for debugging/testing purposes
		// define the units in which the pieces of the puzzle are counted
		var unitx = 1.0/this.parentpuzzle.layout[0];
		var unity = 1.0/this.parentpuzzle.layout[1];
		// define inner (visual) clipping path; this will later be the outline of an actual puzzle piece
		this.pathinner = [[this.i*unitx, this.j*unity],
		                  [this.i*unitx, (this.j + 1)*unity],
		                  [(this.i + 1)*unitx, (this.j + 1)*unity],
		                  [(this.i + 1)*unitx, this.j*unity]];
		// this is a bounding box to allow the inner path to protrude outwards
		this.pathouter = [[this.i*unitx-0.0, this.j*unity-0.0], [(this.i + 1)*unitx+0.0, (this.j + 1)*unity+0.0]];
		// set correct camera space position in complete puzzle
		// calculate the width and height of the piece in camera space
		// with margin (pathouter)
		this.w = (this.pathouter[1][0] - this.pathouter[0][0])*this.parentpuzzle.dimensions[0];
		this.h = (this.pathouter[1][1] - this.pathouter[0][1])*this.parentpuzzle.dimensions[1];
	}
	setupclip() {
		// concat the individual edge-info into full path
		this.pathinner = this.edges[0].concat(this.edges[1].concat(this.edges[2].concat(this.edges[3])));

		// find bounding box for divcontainer
		var xmin = this.pathinner[0][0], xmax = this.pathinner[0][0], ymin = this.pathinner[0][1], ymax = this.pathinner[0][1];
		for (const point of this.pathinner) {
			xmin = Math.min(xmin, point[0]);
			xmax = Math.max(xmax, point[0]);
			ymin = Math.min(ymin, point[1]);
			ymax = Math.max(ymax, point[1]);
		}
		this.pathouter = [[xmin, ymin], [xmax, ymax]];
	}
	applyclip() {
		// apply the previously defined clipping path
		if (this.pathinner.length > 0) {
			// set pixel space dimensions of div-container for this piece
			this.divcontainer.style.width = thiscamera.getlength_px(this.pathouter[1][0] - this.pathouter[0][0]) + "px";
			this.divcontainer.style.height = thiscamera.getlength_px((this.pathouter[1][1] - this.pathouter[0][1])) + "px";
			// convert pathinner to css-property
			var thisclip = "polygon(";
			if (this.parentpuzzle.aspectratio > 1.0) {
				// vertical motif
				for (var i = 0; i < this.pathinner.length; i++) {
					thisclip += 100*this.pathinner[i][0]*this.parentpuzzle.aspectratio + "% " + 100*this.pathinner[i][1] + "%, "
				}
				thisclip += 100*this.pathinner[0][0]*this.parentpuzzle.aspectratio + "% " + 100*this.pathinner[0][1] + "%)";
			} else {
				// horizontal motif
				for (var i = 0; i < this.pathinner.length; i++) {
					thisclip += 100*this.pathinner[i][0] + "% " + 100*this.pathinner[i][1]/this.parentpuzzle.aspectratio + "%, "
				}
				thisclip += 100*this.pathinner[0][0] + "% " + 100*this.pathinner[0][1]/this.parentpuzzle.aspectratio + "%)";
			}
			// and apply to element
			this.img.style.clipPath = thisclip;
			// offset img element inside div to have the clipped section centered in the div (so the piece will be seen at the desired position)
			this.img.style.left = thiscamera.getlength_px(-this.pathouter[0][0]) + "px";
			this.img.style.top = thiscamera.getlength_px(-this.pathouter[0][1]) + "px";

			this.generate_shadows_highlights();
		}
	}
	generate_shadows_highlights() {
		this.divedgeshadowcontainer = document.createElement('div');
		this.divedgeshadowcontainer.style.overflow = "hidden";
		this.divedgeshadowcontainer.style.position = "absolute";
		this.divedgeshadowcontainer.style.pointerEvents = "none";
		this.divedgeshadowcontainer.style.width = "0%";
		this.divedgeshadowcontainer.style.height = "0%";
		this.divedgeshadowcontainer.style.transformOrigin = "top left";

		this.divedgeshadowcontainer_bg = document.createElement('div');
		this.divedgeshadowcontainer_bg.style.position = "absolute";
		this.divedgeshadowcontainer_bg.style.pointerEvents = "none";
		this.divedgeshadowcontainer.append(this.divedgeshadowcontainer_bg);

		this.divedgeshadowcontainer_bg.style.backgroundColor = puzzlepiece_shadowcolor;
		// offset divedgeshadowcontainer_bg element inside divedgeshadowcontainer to have the clipped section centered in the div (so the shadow will be seen at the desired position)
		this.divedgeshadowcontainer_bg.style.width = this.parentpuzzle.dimensions_px[0] + "px";
		this.divedgeshadowcontainer_bg.style.height = this.parentpuzzle.dimensions_px[1] + "px";
		this.divedgeshadowcontainer_bg.style.left = thiscamera.getlength_px(-this.pathouter[0][0]) + "px";
		this.divedgeshadowcontainer_bg.style.top = thiscamera.getlength_px(-this.pathouter[0][1]) + "px";
		this.divedgeshadowcontainer.style.width = thiscamera.getlength_px(this.pathouter[1][0] - this.pathouter[0][0]) + "px";
		this.divedgeshadowcontainer.style.height = thiscamera.getlength_px((this.pathouter[1][1] - this.pathouter[0][1])) + "px";

		// clone elements for highlighted edges
		this.divedgehighlightcontainer = this.divedgeshadowcontainer.cloneNode();
		this.divedgehighlightcontainer_bg = this.divedgeshadowcontainer_bg.cloneNode();
		this.divedgehighlightcontainer_bg.style.backgroundColor = puzzlepiece_highlightcolor;
		this.divedgehighlightcontainer.append(this.divedgehighlightcontainer_bg);

		// shadow
		var thisclip = "polygon(";
		if (this.parentpuzzle.aspectratio > 1.0) {
			// vertical motif
			for (var i = 0; i < this.pathinner.length; i++) {
				thisclip += 100*this.pathinner[i][0]*this.parentpuzzle.aspectratio + "% " + 100*this.pathinner[i][1] + "%, "
			}
			thisclip += 100*this.pathinner[0][0]*this.parentpuzzle.aspectratio + "% " + 100*this.pathinner[0][1] + "%)";
		} else {
			// horizontal motif
			for (var i = 0; i < this.pathinner.length; i++) {
				thisclip += 100*this.pathinner[i][0] + "% " + 100*this.pathinner[i][1]/this.parentpuzzle.aspectratio + "%, "
			}
			thisclip += 100*this.pathinner[0][0] + "% " + 100*this.pathinner[0][1]/this.parentpuzzle.aspectratio + "%)";
		}

		this.divedgeshadowcontainer_bg.style.clipPath = thisclip;
		this.divedgehighlightcontainer_bg.style.clipPath = thisclip;

	}
}