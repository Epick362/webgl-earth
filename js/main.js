// Created by Bjorn Sandvik - thematicmapping.org
var width  = window.innerWidth,
	height = window.innerHeight;

var solarSystemData = {
		"planets" : [
			{
				"name" : "mercury",
				"radius" : 4879,
				"rotation" : 36,
				"distance" : 570.9 / 5,
				"revolution" : 2.2
			},
			{
				"name" : "venus",
				"radius" : 12104,
				"rotation" : 6,
				"distance" : 620.2 / 5,
				"revolution" : 1.8
			},
			{
				"name" : "earth",
				"radius" : 12756,
				"rotation" : 6,
				"distance" : 679.6 / 5,
				"revolution" : 2,
				"clouds" : true
			},
			{
				"name" : "mars",
				"radius" : 6792,
				"rotation" : 6,
				"distance" : 730.9 / 5,
				"revolution" : 2.5
			},
			{
				"name" : "jupiter",
				"radius" : 142984,
				"rotation" : 6,
				"distance" : 778.6 / 5,
				"revolution" : 1.3
			},
			{
				"name" : "saturn",
				"radius" : 120536,
				"rotation" : 6,
				"distance" : 1433.5 / 5,
				"revolution" : 1.4
			},
			{
				"name" : "uranus",
				"radius" : 51118,
				"rotation" : 6,
				"distance" : 2872.5 / 5,
				"revolution" : 1
			},
			{
				"name" : "neptune",
				"radius" : 49528,
				"rotation" : 6,
				"distance" : 4495.1 / 5,
				"revolution" : 0.8
			}
		],
		"stars": [
			{
				"name" : "sun",
				"radius" : 7.35144e8,
				"spectral" : 1
			}
		]
	};

var gradientCanvas;
var gradientImage;

var webglEl = document.getElementById('webgl');

function start(e) {
	if (!Detector.webgl) {
		Detector.addGetWebGLMessage(webglEl);
		return;
	}

	gradientImage = document.createElement('img');
	gradientImage.onload = postStarGradientLoaded;
	gradientImage.src = 'images/star_color_modified.png';
}

function postStarGradientLoaded() {
	gradientCanvas = document.createElement('canvas');
	gradientCanvas.width = gradientImage.width;
	gradientCanvas.height = gradientImage.height;
	gradientCanvas.getContext('2d').drawImage( gradientImage, 0, 0, gradientImage.width, gradientImage.height );
	gradientCanvas.getColor = function( percentage ){
		return this.getContext('2d').getImageData(0, 1, 1, 1).data;
	}


	loadShaders( shaderList, function(e){
		//	we have the shaders loaded now...
		shaderList = e;

		initWorld();
	});	
}

function initWorld() {
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100000);
	camera.position.set(1.5, 1, 1.5);

	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(width, height);

	scene.add(new THREE.AmbientLight(0x444444));

	scene.add( makeSolarSystem(solarSystemData) );

	stars = createStars(100000, 64);
	scene.add(stars);

	stats = new Stats();
	stats.setMode(0); // 0: fps, 1: ms
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';	
	document.body.appendChild( stats.domElement );	

	axisHelper = new THREE.AxisHelper( 100 );
	//scene.add( axisHelper );

	controls = new THREE.TrackballControls(camera);
	controls.target.set(0, 0, 0);

	webglEl.appendChild(renderer.domElement);

	window.addEventListener('resize', onWindowResize, false );

	render();
}

function render() {
	renderer.clear();

	updateSolarSystem();
	controls.update();
	requestAnimationFrame(render);
	renderer.render(scene, camera);

	stats.update();
}


function onWindowResize() {

	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function createStars(radius, segments) {
	return new THREE.Mesh(
		new THREE.SphereGeometry(radius, segments, segments), 
		new THREE.MeshBasicMaterial({
			map:  THREE.ImageUtils.loadTexture('images/galaxy_starfield.png'), 
			side: THREE.BackSide
		})
	);
}
