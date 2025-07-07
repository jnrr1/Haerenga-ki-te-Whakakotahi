
// this class is intended to determine the position of objects (puzzle pieces) in px if the coordinates are given in camera space
// it provides routines to translate between pixel- and camera-space
class camera {
	constructor(baseratio0) {
		//  number of px per unit in cameraspace
		this.baseratio = baseratio0;
		// position in cameraspace (top left corner)
		this.x = 0;
		this.y = 0;
		this.zoom = 1;
	}
	update_camera_position_fromdeltapx(deltax, deltay) {
		this.x = this.getx_cam(deltax);
		this.y = this.gety_cam(deltay);
	}
	getx_px(somecoordinate) {
		return (somecoordinate - this.x)*this.zoom*this.baseratio;
	}
	gety_px(somecoordinate) {
		return (somecoordinate - this.y)*this.zoom*this.baseratio;
	}
	getx_cam(somecoordinate) {
		return somecoordinate/this.zoom/this.baseratio + this.x;
	}
	gety_cam(somecoordinate) {
		return somecoordinate/this.zoom/this.baseratio + this.y;
	}
	getlength_px(somelength) {
		return somelength*this.zoom*this.baseratio;
	}
	getlength_cam(somelength) {
		return somelength/this.zoom/this.baseratio;
	}
	testtransformations() {
		return (this.getx_cam(400) - this.getx_cam(200))/this.getlength_cam(200); // 1
	}
	testtransformations2() {
		return (this.getx_px(2.5) - this.getx_px(1.25))/this.getlength_px(1.25); // 1
	}
}