THREE.PlayerControls = function (anchor, scene, player, camera, domElement) {

	this.walking = false;
	this.occ = false;
	this.scene = scene;
	this.occLastZoom = 0;
	this.jumpRelease = true;
	this.jumping = false;
	this.falling = false;
	this.moving = false;
	this.turning = false;
	this.anchor = anchor;
	this.player = player;
	this.camera = camera;
	this.camera.position.set(.5, .25, .5);
	this.domElement = (domElement !== undefined) ? domElement : document;

	this.camera_anchor_gyro = new THREE.Gyroscope();
	this.camera_anchor_gyro.add(this.camera);
	this.anchor.add(this.camera_anchor_gyro);
	
	this.anchor.rotation.order = "YXZ";
	this.camera_anchor_gyro.rotation.order = "YXZ";
	this.camera.rotation.order = "YXZ";

	// API
	this.enabled = true;

	this.center = new THREE.Vector3(0, 0, 0);

	this.userZoom = true;
	this.userZoomSpeed = 2.0;

	this.userRotate = true;
	this.userRotateSpeed = 1.0;

	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	this.minDistance = 2;
	this.maxDistance = 30;

	this.keys = {
		LEFT: 65,
		UP: 87,
		RIGHT: 68,
		DOWN: 83,
		JUMP: 32,
	};

	this.maxSpeed = 0;
	this.acceleration = 0;

	this.rotationVector = new THREE.Vector3(0, 0, 0);

	// internals
	var scope = this;

	var EPS = 0.000001;
	var PIXELS_PER_ROUND = 1800;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var zoomStart = new THREE.Vector2();
	var zoomEnd = new THREE.Vector2();
	var zoomDelta = new THREE.Vector2();

	var phiDelta = 0;
	var thetaDelta = 0;
	var scale = 1;

	var lastPosition = new THREE.Vector3();

	var velocity = 0;

	var STATE = {
		NONE: -1,
		ROTATE: 0,
		ZOOM: 1
	};
	var state = STATE.NONE;
	var key_state = [];

	// events
	var changeEvent = {
		type: 'change'
	};

	// Create a particle group to add the emitter to.
	this.particleGroup = new SPE.Group({
	    // Give the particles in this group a texture
	    texture: THREE.ImageUtils.loadTexture('game/images/engine.png'),

	    // How long should the particles live for? Measured in seconds.
	    maxAge: 5
	});

	// Create a single emitter
	this.particleEmitter = new SPE.Emitter({
	    type: 'cube',
	    position: new THREE.Vector3(0, 0, 0),
	    acceleration: new THREE.Vector3(0, 0, 0),
	    velocity: new THREE.Vector3(0, 0, 0),
	    particlesPerSecond: 100,
	    sizeStart: 0.1,
	    sizeEnd: 0,
	    opacityStart: 1,
	    opacityEnd: 0,
	    colorStart: new THREE.Color(0x006fb6),
	    colorEnd: new THREE.Color('white')
	});

	// Add the emitter to the group.
	this.particleGroup.addEmitter( this.particleEmitter );

	// Add the particle group to the scene so it can be drawn.
	scene.add( this.particleGroup.mesh ); // Where `scene` is an instance of `THREE.Scene`.

	this.rotateLeft = function (angle) {
		thetaDelta -= angle;
	};

	this.rotateRight = function (angle) {
		thetaDelta += angle;
	};

	this.rotateUp = function (angle) {
		phiDelta -= angle;
	};

	this.rotateDown = function (angle) {
		phiDelta += angle;
	};

	this.zoomIn = function (zoomScale) {
		if (zoomScale === undefined) {
			zoomScale = getZoomScale();
		}
		scale /= zoomScale;
	};

	this.zoomOut = function (zoomScale) {
		if (zoomScale === undefined) {
			zoomScale = getZoomScale();
		}
		scale *= zoomScale;
	};

	this.getVelocity = function() {
		return velocity;
	}

	this.update = function (delta) {
		if (key_state.indexOf(this.keys.UP) > -1) {
			if(velocity + this.acceleration < this.maxSpeed) {
				velocity += this.acceleration;
			}else{
				velocity = this.maxSpeed;
			}
			this.player.rotation.set(0, 0, 0);

			this.moving = true;

			// forward
		} else if (key_state.indexOf(this.keys.DOWN) > -1) {
			if(velocity - this.acceleration >= 0) {
				velocity -= this.acceleration;
			}else{
				velocity = 0;
			}
			this.player.rotation.set(0, 0, 0);

			this.moving = true;

			//back
		} else if (this.moving) {
			this.player.rotation.set(0, 0, 0);
			if(velocity - this.acceleration/10 >= 0) {
				velocity -= this.acceleration/10;
			}else{
				velocity = 0;
			}
		}

		if(velocity == 0) {
			this.moving = false;
			this.particleEmitter.disable();
		}else{
			this.particleEmitter.enable();
		}

		//turn
		if (key_state.indexOf(this.keys.LEFT) > -1 && key_state.indexOf(this.keys.RIGHT) < 0) {
			if(this.rotationVector.y < Math.PI/2) {
				this.rotationVector.y += Math.PI/90;
			}
			this.turning = true;
			//turning
		} else if (key_state.indexOf(this.keys.RIGHT) > -1) {
			if(this.rotationVector.y > -Math.PI/2) {
				this.rotationVector.y -= Math.PI/90;
			}
			this.turning = true;
			//turning
		} else if (this.turning && this.rotationVector.y != 0) {
			this.rotationVector.y -= this.rotationVector.y / 45;
		} else if (this.turning) {
			this.turning = false;
		}

		// set rotation
		this.anchor.setAngularVelocity(this.rotationVector);

		// set the speed
		var rotation_matrix = new THREE.Matrix4().extractRotation(this.anchor.matrix);
		var force_vector = new THREE.Vector3(0, 0, velocity).applyMatrix4(rotation_matrix);
		this.anchor.setLinearVelocity(force_vector);


		var position = this.camera.position;
		var offset = position.clone().sub(this.center);

		// angle from z-axis around y-axis
		var theta = Math.atan2(offset.x, offset.z);

		// angle from y-axis
		var phi = Math.atan2(Math.sqrt(offset.x * offset.x + offset.z * offset.z), offset.y);

		theta += thetaDelta;
		phi += phiDelta;

		/*
		if ((this.moving || this.turning) && state != STATE.ROTATE) {
			var curr_rot = new THREE.Euler(0, 0, 0, "YXZ").setFromRotationMatrix(this.camera.matrixWorld).y;
			var dest_rot = new THREE.Euler(0, 0, 0, "YXZ").setFromRotationMatrix(this.anchor.matrixWorld).y;
			var dest_rot = dest_rot + (dest_rot > 0 ? -Math.PI : Math.PI);
			var step = shortestArc(curr_rot,dest_rot)*delta*2;
			this.camera_anchor_gyro.rotation.y += step;//Math.max(-delta, diff);
			
			// fix pitch (should be an option or it could get anoying)
			//phi = 9*Math.PI/24;
		}
		*/
		// restrict phi to be between desired limits
		phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

		// restrict phi to be betwee EPS and PI-EPS
		phi = Math.max(EPS, Math.min(Math.PI - EPS, phi));

		var radius;
		if (this.occ) {
			this.occLastZoom = Math.max(this.minDistance, Math.min(this.maxDistance, this.occLastZoom * scale));
			radius = this.occLastZoom;
		} else {
			radius = offset.length() * scale;
		}

		// restrict radius to be between desired limits
		radius = Math.max(this.minDistance, Math.min(this.maxDistance, radius));

		// check for objects infront of camera
		var projector = new THREE.Projector();
		var vector = new THREE.Vector3(0, 0, 1);
		projector.unprojectVector(vector, camera);
		var point = new THREE.Vector3(this.anchor.position.x + this.center.x, this.anchor.position.y + this.center.y, this.anchor.position.z + this.center.z);
		var vec = camera.position.clone().sub(vector).normalize()

		var checkray = new THREE.Raycaster(point, vec, this.minDistance, this.maxDistance);
		var checkcollisionResults = checkray.intersectObjects(this.scene.children.filter(function (child) {
			return child.occ;
		}));
		if (checkcollisionResults.length > 0) {
			var min = radius;
			for (var i = 0; i < checkcollisionResults.length; i++) {
				if (min > checkcollisionResults[i].distance) min = checkcollisionResults[i].distance;
			}
			if (min < radius) {
				if (!this.occ) {
					this.occ = true;
					this.occLastZoom = radius;
				}
				radius = min;
			} else {
				this.occ = false;
			}
		}

		offset.x = radius * Math.sin(phi) * Math.sin(theta);
		offset.y = radius * Math.cos(phi);
		offset.z = radius * Math.sin(phi) * Math.cos(theta);

		position.copy(this.center).add(offset);
		this.camera.lookAt(this.center);

		thetaDelta = 0;
		phiDelta = 0;
		scale = 1;

		if (lastPosition.distanceTo(this.camera.position) > 0) {
			this.dispatchEvent(changeEvent);
			lastPosition.copy(this.camera.position);
		}

		var engineOffset = new THREE.Vector3(0, 0, -0.03).applyMatrix4(rotation_matrix);
		this.particleEmitter.position.copy(this.anchor.position).add(engineOffset);
		this.particleEmitter.velocity = new THREE.Vector3(0, 0, velocity/4).applyMatrix4(rotation_matrix);

   		this.particleGroup.tick( delta );
	};

	function shortestArc(a, b)
	{
		if (Math.abs(b - a) < Math.PI)
			return b - a;
		if (b > a)
			return b - a - Math.PI * 2.0;
		return b - a + Math.PI * 2.0;
	}

	function getZoomScale() {
		return Math.pow(0.95, scope.userZoomSpeed);
	}

	function onMouseDown(event) {
		if (scope.enabled === false) return;
		if (scope.userRotate === false) return;

		event.preventDefault();

		if (state === STATE.NONE) {
			if (event.button === 0) state = STATE.ROTATE;
		}

		if (state === STATE.ROTATE) {
			rotateStart.set(event.clientX, event.clientY);
		}

		document.addEventListener('mousemove', onMouseMove, false);
		document.addEventListener('mouseup', onMouseUp, false);
	}

	function onMouseMove(event) {
		if (scope.enabled === false) return;
		event.preventDefault();

		if (state === STATE.ROTATE) {
			rotateEnd.set(event.clientX, event.clientY);
			rotateDelta.subVectors(rotateEnd, rotateStart);
			scope.rotateLeft(2 * Math.PI * rotateDelta.x / PIXELS_PER_ROUND * scope.userRotateSpeed);
			scope.rotateUp(2 * Math.PI * rotateDelta.y / PIXELS_PER_ROUND * scope.userRotateSpeed);
			rotateStart.copy(rotateEnd);
		} else if (state === STATE.ZOOM) {
			zoomEnd.set(event.clientX, event.clientY);
			zoomDelta.subVectors(zoomEnd, zoomStart);
			if (zoomDelta.y > 0) {
				scope.zoomIn();
			} else {
				scope.zoomOut();
			}
			zoomStart.copy(zoomEnd);
		}
	}

	function onMouseUp(event) {
		if (scope.enabled === false) return;
		if (scope.userRotate === false) return;

		document.removeEventListener('mousemove', onMouseMove, false);
		document.removeEventListener('mouseup', onMouseUp, false);

		state = STATE.NONE;
	}

	function onMouseWheel(event) {
		if (scope.enabled === false) return;
		if (scope.userZoom === false) return;

		var delta = 0;

		if (event.wheelDelta) { // WebKit / Opera / Explorer 9
			delta = event.wheelDelta;
		} else if (event.detail) { // Firefox
			delta = -event.detail;
		}

		if (delta > 0) {
			scope.zoomOut();
		} else {
			scope.zoomIn();
		}
	}

	function onKeyDown(event) {
		if (scope.enabled === false) return;
		switch (event.keyCode) {
			case scope.keys.UP:
				var index = key_state.indexOf(scope.keys.UP);
				if (index == -1) key_state.push(scope.keys.UP);
				break;
			case scope.keys.DOWN:
				var index = key_state.indexOf(scope.keys.DOWN);
				if (index == -1) key_state.push(scope.keys.DOWN);
				break;
			case scope.keys.LEFT:
				var index = key_state.indexOf(scope.keys.LEFT);
				if (index == -1) key_state.push(scope.keys.LEFT);
				break;
			case scope.keys.RIGHT:
				var index = key_state.indexOf(scope.keys.RIGHT);
				if (index == -1) key_state.push(scope.keys.RIGHT);
				break;
			case scope.keys.JUMP:
				var index = key_state.indexOf(scope.keys.JUMP);
				if (index == -1) key_state.push(scope.keys.JUMP);
				break;
		}
	}

	function onKeyUp(event) {
		switch (event.keyCode) {
			case scope.keys.UP:
				var index = key_state.indexOf(scope.keys.UP);
				if (index > -1) key_state.splice(index, 1);
				break;
			case scope.keys.DOWN:
				var index = key_state.indexOf(scope.keys.DOWN);
				if (index > -1) key_state.splice(index, 1);
				break;
			case scope.keys.LEFT:
				var index = key_state.indexOf(scope.keys.LEFT);
				if (index > -1) key_state.splice(index, 1);
				break;
			case scope.keys.RIGHT:
				var index = key_state.indexOf(scope.keys.RIGHT);
				if (index > -1) key_state.splice(index, 1);
				break;
			case scope.keys.JUMP:
				var index = key_state.indexOf(scope.keys.JUMP);
				if (index > -1) key_state.splice(index, 1);
				break;
		}
	}

	this.domElement.addEventListener('mousedown', onMouseDown, false);
	this.domElement.addEventListener('mousewheel', onMouseWheel, false);
	this.domElement.addEventListener('DOMMouseScroll', onMouseWheel, false); // firefox
	window.addEventListener('keydown', onKeyDown, false);
	window.addEventListener('keyup', onKeyUp, false);
};