

// see https://stackoverflow.com/a/19301306
class rng {
	constructor() {
		this.m_w = 123456789;
		this.m_z = 567891234;
		this.mask = 0xffffffff;
	}
	seed(i) {
	    this.m_w = (123456789 + i) & this.mask;
	    this.m_z = (567891234 - i) & this.mask;
	}
	// returns number 0 <= x < 1
	get() {
	    this.m_z = (36969 * (this.m_z & 65535) + (this.m_z >> 16)) & this.mask;
	    this.m_w = (18000 * (this.m_w & 65535) + (this.m_w >> 16)) & this.mask;
	    var result = ((this.m_z << 16) + (this.m_w & 65535)) >>> 0;
	    result /= 4294967296;
	    return result;
	}
}

// returns value of the cookie 'name' or undefined if cookie not existent
function getCookie(name) {
	var result = undefined;
	var cookies = document.cookie.split(";");
	for (var i = 0; i < cookies.length; i++) {
		var thiscookie = cookies[i].split("=");
		if (thiscookie.length === 2) {
			if (thiscookie[0].trim() === name) {
				result = thiscookie[1].trim();
				break;
			}
		}
	}
	return result;
}

// enables smooth opacity transition of html-element
function fadeto(element, op0, op1, msduration, somecallback) {
	var op = op0;
	var currentdate = new Date();
	var t0 = currentdate.getTime();

	var timer = setInterval(function () {
		var currentdate = new Date();
		var t1 = currentdate.getTime();
		op = op0 + (op1 - op0)*(t1-t0)/msduration;
		if (t1 >= t0 + msduration){
			op = op1;
			element.style.opacity = op;
			if (typeof(somecallback) === 'function') somecallback();
			clearInterval(timer);
		}
		element.style.opacity = op;
	}, 16);
}

// enables smooth transition in style of html-element
// transitionfunction takes a single argument that interpolates linearly between 0 and 1 for the desired duration
function animate(msduration, transitionfunction, somecallback) {
	var currentdate = new Date();
	var t0 = currentdate.getTime();

	var timer = setInterval(function () {
		var currentdate = new Date();
		var t1 = currentdate.getTime();
		transitionfunction((t1-t0)/msduration);
		if (t1 >= t0 + msduration){
			if (typeof(somecallback) === 'function') somecallback();
			clearInterval(timer);
			timer = undefined;
		}
	}, 16);

	return timer;
}

// function that loads image from server and can report progress
// https://stackoverflow.com/questions/14218607/javascript-loading-progress-of-an-image
function loadImage_wprogress(imageUrl, onprogress) {
	return new Promise((resolve, reject) => {
    var xhr = new XMLHttpRequest();
    var notifiedNotComputable = false;

    xhr.open('GET', imageUrl, true);
    xhr.responseType = 'arraybuffer';

    xhr.onprogress = function(ev) {
		if (ev.lengthComputable) {
			onprogress(parseInt((ev.loaded / ev.total) * 100));
		} else {
			if (!notifiedNotComputable) {
				notifiedNotComputable = true;
				onprogress(-1);
			}
		}
    }

    xhr.onloadend = function() {
		if (!xhr.status.toString().match(/^2/)) {
			reject(xhr);
		} else {
			if (!notifiedNotComputable) {
				onprogress(100);
			}

			var options = {}
			var headers = xhr.getAllResponseHeaders();
			var m = headers.match(/^Content-Type\:\s*(.*?)$/mi);

			if (m && m[1]) {
				options.type = m[1];
			}

			var blob = new Blob([this.response], options);

			resolve(window.URL.createObjectURL(blob));
		}
    }

    xhr.send();
  });
}