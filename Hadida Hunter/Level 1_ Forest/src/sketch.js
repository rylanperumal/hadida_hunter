var controlsEnabled = false; // boolean to keep track of whether the user clicked the mouse or not
var prevTime = performance.now(); // keep track of time

// boolean variables to keep track of movement
var forward = false;
var backward = false;
var left = false;
var right = false;
var shooting = false;
var running = false;
var jumping = false;
var run_animation = true;
var restart = false; // adding a restart feature to the game

var gravity = 9.8; // downward acceleration due to the earth's gravity
var mass = 100; // mass of the object(in kgs)
// Velocity to and Direction vectors to handle simple physics of movement
var velocity = new THREE.Vector3();
var direction = new THREE.Vector3();

// basic scenegraph variables
var scene;
var camera; // main camera that the scene is rendered from
var controls;
var renderer;
var canvas; // canvas to which the scene is rendered used for tracking mouse position in the scene

// variables for picture in picture views
var screenScene;
var screenCamera;
var firstRenderTarget;
var finalRenderTarget;
var textureCamera;
//global variables for lighting
var dirLight
var hemiLight;
// player attributes
var player = {
  health: 100,
  height: 1.75,
  speed: 100,
  score: 0,
  kills: 0
};
var stats; // shows the stats which appear on the top left of the screen

var MAPSIZE = 10; // the size of a square map that is used for placement of objects in the world, the scene is a scaled up version of this
var UNITSIZE = 40; // unit size to track between the map and the world scale
var ASPECT = (window.innerWidth / window.innerHeight); // aspect ratio of the scene

var mixer; // need for animation of the hadida model that was loaded in the game
var hadidas = []; // array which keeps track of all the hadidas in the scene

var bullets = []; // array of bullets to keep track of their position and other variables
var boxray; // raycaster for the boxes that can be jumped on
var boxes = []; // stores the location of all the boxes that can be jumped on

var clock; // clock for time-oriented objects, gives a time dependent motion to the gun
var map; // global variable for the predefined map

var positionOfGun = new THREE.Vector3(); // containing the x, y, z location of the gun
var posFromCamera; // position of the gun from the camera

// literall object of objects which are preloaded to the screen, cloned objects go into this array to keep track of them
var meshes = {}; // all the models that have been loaded and drawn to the scene will be in this object
/*
 Javascript literall object for each model that has to be loaded.
 It is an object of an object, which contains the objects, each object has:
 the file path to their obj and mtl fill as well as an empty mesh variable
*/
var models = {
  oakGreen: {
    obj: "../objects/Trees/Oak_Green_01.obj",
    mtl: "../objects/Trees/Oak_Green_01.mtl",
    mesh: null
  },
  largeOakFall: {
    obj: "../objects/Trees/Large_Oak_Fall_01.obj",
    mtl: "../objects/Trees/Large_Oak_Fall_01.mtl",
    mesh: null
  },
  machineGun: {
    obj: "../objects/Weapons/machinegunLauncher.obj",
    mtl: "../objects/Weapons/machinegunLauncher.mtl",
    mesh: null,
    castShadow: false
  },
  tallRock: {
    obj: "../objects/Scene_nature/Tall_Rock_1_01.obj",
    mtl: "../objects/Scene_nature/Tall_Rock_1_01.mtl",
    mesh: null
  }
};

/*
  Now we set up the three.js world, basic setup of the threejs world in setup function
*/
function setup() {

  var container = document.getElementById('container');
  scene = new THREE.Scene(); // root of the sceen graph, all objects will be drawn to the scene, and user control will take place here
  createFirstRenderTarget(); // creating elements for the first render target
  createFinalRenderTarget(); // creating variables for the final render target which will drawn to the scene
  clock = new THREE.Clock(); // initializing a clock for real time display
  enableCameras(); // enabling the perspective camera and the orthographic camera in the scene
  boxray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10); //raycaster takes in (origin, direction, near far), can jump on boxes
  mixer = new THREE.AnimationMixer(scene); // for animation of the hadida
  stats = new Stats();
  container.appendChild(stats.dom); // show the number of frames that we are currently at
  HemisphereLight(); // enabling HemisphereLight
  DirectionalLight(); // enabling DirectionalLight
  runLoad(); // Setting up the loading screen this "scene" renders whilts al the required objects are loaded into the scene
  enableRenderer(); // activates the renderer
  enableWindowResize(); // addresses the windows resizing issue
  loadObjects(); // function which loads multiple objects

  loadMap(MAPSIZE); // loading the gameMap

}
setup();
/*
All drawing that must be rendered to the main world happens here
*/

function draw() {

  createFloor(); // makes a plane with texture and adds it to the scene, imitating the ground
  createSkyBox(); // adding the skybox to the scene
  createObjects(); // draws tree objects which are added to the scene
  addWeapons(); // adds the players weapons to the scene;
}

/*
Now to setup a renderer,
The setSize(), function takes in the size of the window that needs to be rendered.
appendChild(), function adds the renderer to the tree.
*/
function enableRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  canvas = renderer.domElement;
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap;
  document.body.appendChild(renderer.domElement);
}

/*
Addressing the update viewport on resize issue,
- That is the when we resize the window the canvas does not get resized as well
- We need to detect when the viewport is being resized, then update the camera, renderer and projectionMatrix
window.addEventListener('event we are listening for', (when event occurs we want to call method) function ...);
*/
function enableWindowResize() {
  window.addEventListener('resize', function() {
    var width = window.innerWidth;
    var height = window.innerHeight;
    renderer.setSize(width, height); // render the new window size
    camera.aspect = width / height; // set the camera aspect ratio to the current width / height, on window resize
    camera.updateProjectionMatrix(); // updates the projectionMatrix of the camera
  });

}

/*
virtual camera in which the user will see the world through, can also have
an orthographic camera.
The perspective camera takes in the following parameters:
PerspectiveCamera(field of view in degrees, (aspect) ratio of the browser, near clipping plane, far clipping plane).
*/
function enableCameras() {
  camera = new THREE.PerspectiveCamera(75, ASPECT, 0.1, 5000);
  camera.position.y = player.height;

  // pointerlock controlsEnabled
  controls = new THREE.PointerLockControls(camera);
  scene.add(controls.getObject());


  // setting up camera for picture in picture views
  textureCamera = new THREE.PerspectiveCamera(70, ASPECT, 0.1, 5000); // camera from above which is used to render the wall of sight
  textureCamera.position.set(0, 100, 0);
  textureCamera.lookAt(scene.position);
  scene.add(textureCamera);

  // we also need an intermediate scene, to solve thr problem of the mirrored texture by mirroring it again,
  // consists of a camera looking at a plane with the mirrored texture on it.
  screenCamera = new THREE.OrthographicCamera( // left, right, top, bottom, near, far
    window.innerWidth / -2,
    window.innerWidth / 2,
    window.innerHeight / 2,
    window.innerHeight / -2, -10000,
    10000
  );
  screenCamera.position.z = 1;
  screenScene.add(screenCamera);
}

function createFirstRenderTarget() {
  // we also need an intermediate scene, to solve thr problem of the mirrored texture by mirroring it again,
  screenScene = new THREE.Scene(); // consists of a camera looking at a plane with the mirrored texture on it.

  // creating the geometry for the screen
  var screenGeometry = new THREE.PlaneBufferGeometry(window.innerWidth, window.innerHeight); // should be window.innerWidth, window.innerHeight

  firstRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
    format: THREE.RGBFormat
  });
  var screenMaterial = new THREE.MeshBasicMaterial({
    map: firstRenderTarget
  });
  var ren = new THREE.Mesh(screenGeometry, screenMaterial); // quad with texture, this result will be put into the final texture
  screenScene.add(ren);
}

function createFinalRenderTarget() {
  // final version of the camera texture in the scene
  var planeGeometry = new THREE.CubeGeometry(6, 6, 0.1, 0.1);
  finalRenderTarget = new THREE.WebGLRenderTarget(512, 512, {
    format: THREE.RBGFormat
  });
  var planeMaterial = new THREE.MeshBasicMaterial({
    map: finalRenderTarget
  });

  var plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.position.set(10, 3, -10);
  scene.add(plane);
}

/*
  Other scenes that need to be rendered
*/
// temp loading screen function still working on it
function runLoad() {
  loadingManager = new THREE.LoadingManager();
  loadingManager.onProgress = function(item, loaded, total) {
    // console.log(item, loaded, total); // logging which item is loaded
  };
  // function which calls on resourcesLoaded
  loadingManager.onLoad = function() {
    playMusic();
    draw(); // calling the draw function once all the object resources have been loaded
  };
}

// function which loads the audio file and plays it in the game
function playMusic() {
  var listener = new THREE.AudioListener();
  var sound = new THREE.Audio(listener);
  var audioLoader = new THREE.AudioLoader();
  audioLoader.load("../music/Earth, Wind & Fire - September.mp3", function(buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.play();
  });

}
/*
  All functions of objects and geometries drawn to scene go here
*/
// loading the hadida file, which is animated
function createhadida(name, pos, dir) {

  var hadida = new THREE.Object3D();
  // loading the js file
  var loader = new THREE.JSONLoader();
  loader.load('../objects/Monster/monster.js', function(geometry, materials) {
    var material = materials[0]; // accessing the required material for the hadida
    material.morphTargets = true; // per vertex animation
    material.color.setHex(0xFFAAAA); // setting the color of the hadida for some effect to the material
    var mesh = new THREE.Mesh(geometry, materials);
    mesh.scale.set(0.001, 0.001, 0.001); // setting the scale of the hadida
    mesh.matrixAutoUpdate = false; // stoping the matrixAutoUpdate as this will rescale the hadida
    mesh.updateMatrix();
    mesh.castShadow = true; // setting the cast shadow to true
    mesh.receiveShadow = true; // setting the receive shadow to true
    hadida.add(mesh); // adding the mesh to an object3D as this will allow for smoother movement in the scene

    // this model comes with preloaded animation so we are using that as well here
    mixer.clipAction(geometry.animations[0], mesh)
      .setDuration(1)
      .startAt(-Math.random())
      .play();
  });
  // setting the position of the hadida in the scene
  hadida.position.x = pos.x;
  hadida.position.y = pos.y;
  hadida.position.z = pos.z;
  hadida.name = name; // giving each hadida a name, which will help with tracking it through the scene graph
  hadida.direction = dir; // setting the direction for the hadidas to move in

  if (dir == 2) { // if dir is 1 then we are already in the desired direction, directions followed of compass logic
    hadida.rotation.y = Math.PI / 2;
  } else if (dir == 3) {
    hadida.rotation.y = Math.PI;
  } else if (dir == 4) {
    hadida.rotation.y = 3 * Math.PI / 2;

  }
  hadidas.push(hadida); // adding the hadida to the hadida array
  scene.add(hadida); // adding the hadida to the scene
}

function createFloor() { // creating the floor
  var floorSize = MAPSIZE * UNITSIZE;
  // applying a material to the floor
  var floorMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('white'),
  });
  // using a grass image to act as a grass texture to the floor, we enable texture wrapping as well as the texture normalMap
  var textureLoader = new THREE.TextureLoader();
  textureLoader.load("../img/grasslight-big.jpg", function(map) {
    map.wrapS = THREE.RepeatWrapping; // setting the wrapping in the s and t coords(texture coords)
    map.wrapT = THREE.RepeatWrapping;
    map.anisotrophy = 4; // number of variations
    map.repeat.set(10, 24); // setting the wrapping range
    floorMaterial.map = map; // setting which map we want to apply the texture to
    floorMaterial.needsUpdate = true;
  });
  textureLoader.load("../img/grasslight-big-nm.jpg", function(map) {
    map.wrapS = THREE.RepeatWrapping; // setting the wrapping in the texture coords
    map.wrapT = THREE.RepeatWrapping;
    map.anisotrophy = 4; // number of variations
    map.repeat.set(10, 24); // setting the wrapping range
    floorMaterial.normalMap = map; // map to which texture must be appiled
    floorMaterial.needsUpdate = true;
  });

  var floorGeometry = new THREE.PlaneBufferGeometry(floorSize, floorSize);
  var floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.receiveShadow = true; // setting the plane to receive shadows
  floor.rotation.x = -Math.PI / 2; // rotation the plane so it is horizontal
  scene.add(floor);
}

// creating a skybox, what does CubeTextureLoader do ?
function createSkyBox() { // figure out how to implement reflection through out the scene here
  var skybox = new THREE.CubeTextureLoader().load([
    '../img/skybox/px.jpg', // right
    '../img/skybox/nx.jpg', // left
    '../img/skybox/py.jpg', // top
    '../img/skybox/ny.jpg', // bottom
    '../img/skybox/pz.jpg', // back
    '../img/skybox/nz.jpg', // front

  ]);
  // setting the scenes background as the skybox
  scene.background = skybox;
}

// creating a grid of the world to creat a game environment, thought ? maybe add more maps to add objects to the screen, or increment objects position
function loadMap(size) { // this map is just tempory will change it up a bit, in terms of adding objects or the size of the map
  map = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 2, 2, 2, 2, 0, 1],
    [1, 0, 2, 2, 2, 2, 2, 2, 2, 1],
    [1, 0, 2, 0, 0, 0, 2, 2, 2, 1],
    [1, 2, 2, 2, 0, 2, 0, 2, 2, 1],
    [1, 0, 2, 2, 2, 2, 0, 2, 0, 1],
    [1, 2, 0, 2, 0, 2, 2, 0, 0, 1],
    [1, 0, 2, 2, 2, 2, 2, 2, 0, 1],
    [1, 0, 2, 2, 0, 2, 2, 2, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ];
}
// randomly adding objects to the scene based on map coords
function createObjects() {
  var unitSize = UNITSIZE;
  var units = MAPSIZE;
  for (var i = 0; i < units; i++) {
    for (var j = 0; j < units; j++) {
      var boxName = ("box").concat(i).concat(j);
      var hadidaName = ("hadida").concat(i).concat(j);
      var bx = (i - units / 2) * (unitSize / 2);
      var by = Math.ceil(Math.random() * 8);
      var bz = (j - units / 2) * (unitSize / 2);
      var boxPos = new THREE.Vector3(bx, by, bz);
      if (map[i][j] > 0) {
        // tree creation
        var treeName = ("tree").concat(i).concat(j); // giving a name to the trees
        var rockName = ("rock").concat(i).concat(j);
        meshes["treeName"] = models.oakGreen.mesh.clone(); // cloning the preloaded model
        // setting the x and y location of the threes in the scene
        meshes["treeName"].position.x = ((i - units / 2) * unitSize) + (Math.ceil(Math.random() * 8));
        meshes["treeName"].position.z = (j - units / 2) * unitSize + (Math.ceil(Math.random() * 8));
        meshes["treeName"].scale.set(2, 2, 2); // setting the scale of the trees
        scene.add(meshes["treeName"]); // adding the trees to the scene

        if (Math.random() < 0.2) {
          meshes["rockName"] = models.tallRock.mesh.clone();
          meshes["rockName"].position.x = ((i - units / 2) * unitSize) + (Math.floor(Math.random() * 7));
          meshes["rockName"].position.z = (j - units / 2) * unitSize + (Math.floor(Math.random() * -7));
          scene.add(meshes["rockName"]); // adding the trees to the scene
        }
      }
      if (map[i][j] == 1 || map[i][j] == 0) {
        var treeName = ("tree").concat(i).concat(j); // giving a name to the trees
        var tree2 = treeName.concat(2);
        meshes["tree2"] = models.oakGreen.mesh.clone();
        meshes["tree2"].position.x = ((i - units / 2) * unitSize) + (Math.ceil(Math.random() * 8));
        meshes["tree2"].position.z = (j - units / 2) * unitSize + (Math.ceil(Math.random() * 8));
        meshes["tree2"].scale.set(3, 3, 3); // setting the scale of the trees
        scene.add(meshes["tree2"]); // adding the trees to the scene
        meshes["treeName"] = models.largeOakFall.mesh.clone(); // cloning the preloaded model
        // setting the x and y location of the threes in the scene
        meshes["treeName"].position.x = (i - units / 4) * unitSize + (Math.ceil(Math.random() * 8));
        meshes["treeName"].position.z = (j - units / 4) * unitSize + (Math.ceil(Math.random() * 8));
        meshes["treeName"].scale.set(3, 3, 3); // setting the scale of the trees
        scene.add(meshes["treeName"]); // adding the trees to the scene
      }
      if (map[i][j] == 0) {
        // reflective box creation
        createSpawnCube(boxName, boxPos);
        // giving a hadidia a random direction to point in, isolating numbers 1-9 and then assigning direction based in compass coords
        var dir = Math.floor(Math.random() * 10);
        if (dir == 1 || dir == 5 || dir == 9) {
          dir = 1;
        } else if (dir == 2 || dir == 6) {
          dir = 2;
        } else if (dir == 3 || dir == 7) {
          dir = 3;
        } else if (dir == 4 || dir == 8) {
          dir = 4;
        } else {
          dir = 1;
        }
        createhadida(hadidaName, boxPos, dir); // initializing first spawn location
      }
    }
  }
}

function createSpawnCube(name, pos) {
  var box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial({
    color: new THREE.Color("white"),
    // envMap: bCamera.renderTarget
    envMap: scene.background
  }));
  scene.add(box); // adding the box to the scene
  // setting the x and z position of the box
  box.position.x = pos.x
  box.position.z = pos.z;
  box.position.y = pos.y; // random y position just for testing
  boxes.push(box); // adding the boxes to the box array
  box.name = name; // setting the name of the boxes added to the scene to make it easier to track
}

// function which creates a player weapon and adds it to the scene
function addWeapons() {
  var machineGun = models.machineGun.mesh.clone(); // cloning the loaded object
  machineGun.position.set(0, -0.5, -1); //setting the position of the gun, just basic orientation
  machineGun.scale.set(10, 10, 10); // setting the scale og the fun model loaded was a bit small
  machineGun.rotation.y = Math.PI; // facing the gun in the -z direction to point into the screen by the right hand rule
  meshes["machineGun"] = machineGun; // assigning the cloned and transformed gun objec to the object mesh where it is used to scene updating
  camera.add(machineGun); // adding the gun to the camera so that it is in sync with the movement of the camera
}

// function to create bullets, positions them and adds them to the scene
function createBullet() {
  var bullet = new THREE.Object3D();
  var bulletGeo = new THREE.SphereGeometry(0.05, 6, 6);
  var bulletMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('black')
  });
  var mesh = new THREE.Mesh(bulletGeo, bulletMat);

  // since we addin the bullet to the camera we need to set its position to the position of the gun from camera
  bullet.position.set(
    posFromCamera.x,
    posFromCamera.y,
    posFromCamera.z
  );

  // bullet and gun symphony !!!!!, multiplying by a small factor so that motion is in sync
  var rotateY = controls.getObject().rotation.y * 0.02;

  // velocity vector of the bullet, rotation conversion from x movement of the mouse to the rotation of the y axis
  bullet.velocity = new THREE.Vector3(Math.sin(rotateY), 0, -Math.cos(rotateY));
  // setting a timeout for the bullet being in the scene
  bullet.alive = true;
  setTimeout(
    function() {
      bullet.alive = false; // if the bullet reaches timeout then it is removed from the scene, in the update function
    }, 1000
  );
  bullet.add(mesh);
  bullets.push(bullet); // adding the bullet to the bullets array
  camera.add(bullet);

}
/*
 This function is for loading multiple objects at the same time this is meant to
 speed up the loading process.
*/

function loadObjects() {

  // loading pre declared models that will be in the scene
  for (var _key in models) { // iterates through elements in the object literall variable
    (function(key) { // wrapping everything in a for loop in a function, this stops the key variable from changing during the loading process
      var mtlLoader = new THREE.MTLLoader(loadingManager); // setting up the material loader
      mtlLoader.load(models[key].mtl, function(materials) {
        materials.preload(); // preloading the material that needs to be added to the mesh

        var objLoader = new THREE.OBJLoader(loadingManager); // setting up the object loader which loads the objects geometry
        objLoader.setMaterials(materials); // applies the material to the geometry which has been preloaded before
        objLoader.load(models[key].obj, function(mesh) { // calling the load function which loads the current object file

          // wrapper funtion stops the key from changing during the object loading
          mesh.traverse(function(node) {
            if (node instanceof THREE.Mesh) { // if there is a mesh, then we then want to check if we want shadows to apply to the loaded object
              if ('castShadow' in models[key]) {
                node.castShadow = models[key].castShadow; // checking to see if the object is enabling castshadow, the default is set to true
              } else {
                node.castShadow = true;
              }
              if ('receiveShadow' in models[key]) {
                node.receiveShadow = models[key].receiveShadow; // checking to see if the objects is enabling receiveShadow, default set to true
              } else {
                node.receiveShadow = true;
              }
            }
          });
          models[key].mesh = mesh; // assigning the null mesh property to the current loaded mesh
        });
      });
    })(_key);
  }
}

/*
  All lighting functions used
*/

// why do I add both a directional light and a hemisphere light, what effect does it give to the scene

// creating hemisphere light and adding it to the scene
function HemisphereLight() {
  hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6); // setting the intenisty and colour of the hemispherlight
  hemiLight.color.setHSL(0.6, 1, 0.6); // giving the light a hsl value
  hemiLight.groundColor.setHSL(0.095, 1, 0.75); // setting the bottom color of the hemiphere light
  hemiLight.position.set(0, 50, 0); // setting the position of the hemisphere light
  scene.add(hemiLight);
}

// creating directional light and adding it to the scene
function DirectionalLight() {
  dirLight = new THREE.DirectionalLight(0xffffff, 1); // setting the colour and the intensity of the directional light

  dirLight.color.setHSL(0.1, 1, 0.95); // giving the light a hue, saturation and lightness value for the color of the light
  dirLight.position.set(-1, 1.75, 1); // setting it to be in the directoin of the postion of the sun from the skybox
  dirLight.position.multiplyScalar(30); // scaling up the postion of the light

  scene.add(dirLight); // adding the light to the scene

  dirLight.castShadow = true; // setting up the shadows for the map

  var d = 100;

  dirLight.shadow.camera.left = -d; // setting how far the direction light should be of the camera from left, right, top, bottom
  dirLight.shadow.camera.right = d;
  dirLight.shadow.camera.top = d;
  dirLight.shadow.camera.bottom = -d;

  dirLight.shadow.camera.far = 3500; // how far we want to see the shadow in the camera
  dirLight.shadow.bias = -0.0001; // giving a bias to the shadow
}

/*
  All game logic functions go here
*/

function iscolliding(bullet_position, object) { // function which checks for collisions between the bullet and the object.
  var vec = new THREE.Vector3(1, 1, 1);
  var obj = object.position;
  var b = bullet_position;

  var x = Math.abs(vec.x);
  var y = Math.abs(vec.y);
  var z = Math.abs(vec.z);

  // chechking for collision in the x, z, y
  if (b.x < obj.x + x && b.x > obj.x - x && b.z < obj.z + z && b.z > obj.z - z && b.y < obj.y + y && b.y > obj.y - y) {
    return true;
  } else {
    return false;
  }
}

function checkBorder(hadida) { // function which checks to see if hadida has escaped the world
  // since the world to the hadida is only in the x and z plane we are only checking those boundaries, world size = MAPSIZE * UNITSIZE = 400
  if (hadida.position.x >= 200) { // checking the positive x bound
    return true;
  } else if (hadida.position.x <= -200) { //  checking the negative x bound
    return true;
  } else if (hadida.position.z >= 200) { // checking the positive z bound
    return true;
  } else if (hadida.position.z <= -200) { // checking the negative z bound
    return true;
  } else {
    return false; // returning false otherwise
  }

}

/*
  Now to setup an update method,
  This method will be called every frame, anything that needs to move or something
  that needs to be checked will happen in this method.
  i.e the game logic, to test we are going to rotate our cube every frame
*/
var update = function() {
  var timer = Date.now() * 0.0005;

  meshes["machineGun"].position.set(
    camera.position.x - Math.sin((camera.rotation.y) - Math.PI / 3) / 1.5,
    player.height - 2.5 + Math.sin(timer * 4 + camera.position.x + camera.position.z) * 0.05,
    camera.position.z - 0.5 - Math.cos((camera.rotation.y) - Math.PI / 6) / 1.5
  );
  posFromCamera = meshes["machineGun"].position; // to position bullet when createBullet() is called

  if (shooting) {
    createBullet(); // creating a bullet to be fired
    shooting = false; // only allowing one bullet per click
  }

  // looping through the bullets array and removing them from the scene, where necessary
  for (var i = 0; i < bullets.length; i++) {
    if (bullets[i] === undefined) {
      continue;
    }
    if (bullets[i].alive == false) {
      camera.remove(bullets[i]); // removing the camera from the bullets if alive is equal to false
      bullets.splice(i, 1);
      continue;
    }
    var bullet_worldPosition = new THREE.Vector3(); // vector which will store the world position of the bullet
    // worldPosition.getPositionFromMatrix(this.bullets[i].matrixWorld); // older way of applying the matrix transform
    bullet_worldPosition.setFromMatrixPosition(this.bullets[i].matrixWorld);
    for (var j = boxes.length - 1; j >= 0; j--) { // looping through the array backwards so that we dont run into any undefined indices
      if (iscolliding(bullet_worldPosition, boxes[j])) {
        scene.remove(boxes[j]); // implement names through out the scene so that we can remove elements
        boxes.splice(j, 1); // array.splice(index, 1);
        bullets[i].alive = false; // removing the bullet from the scene as well
        break; // we want to exit the loop once we detect a collision.
      }
    }
    for (var j = hadidas.length - 1; j >= 0; j--) { // iterating backwards through the hadidas array as we are removing items
      if (iscolliding(bullet_worldPosition, hadidas[j])) { // when bullet hits the hadida
        if (player.score == 0) { // accounting for the first score and kill update as they will both be 0;
          player.kills++;
          player.score = 100;
        } else {
          player.kills++;
          player.score = 200 * player.kills; // the score is 100 times the number of kills
        }
        $('#score').html(player.score); // updating the score in the scene
        scene.remove(hadidas[j]); // remove the hadida from the scene
        hadidas.splice(j, 1); // removing the hadida from the hadidas array
        // if the length is less the 5 we are getting closer to winning, hence making the the text green, setting the number of hadidas left in the scene
        var val = hadidas.length < 5 ? '<span style="color: green">' + hadidas.length + '</span>' : hadidas.length;
        $('#hadidas').html(val); // updating the number of hadidas in the scene
        bullets[i].alive = false; // once the bullet intersects with the hadida the bullet is "dead"
        break; // once there is a collision we want to exit the loop
      }

    }
    bullets[i].position.add(bullets[i].velocity); // moving the bullet in the scene by adding its velocity to the bullets position
  }
  // we want to move the hadidas in the scene based on their direction
  for (var i = hadidas.length - 1; i >= 0; i--) {
    var h = hadidas[i];
    // moving hadida based on the direction it faces, 1: N, 2: E, 3: S, 4: W(else)
    if (h.direction == 1) {
      h.position.x += 0.035;
    } else if (h.direction == 2) {
      h.position.z -= 0.035;
    } else if (h.direction == 3) {
      h.position.x -= 0.035;
    } else { // if h.direction == 4, only other case
      h.position.z += 0.035;
    }
    if (checkBorder(hadidas[i])) { // function which returns true if hadidas escape
      // displays a message when a hadida escapes
      $("#snackbar").html("A Hadida has escaped !");
      var x = document.getElementById("snackbar");
      x.className = "show";
      setTimeout(function() {
        x.className = x.className.replace("show", "");
      }, 3000);
      // if the hadidas escape the scene we want to remove them from the scene and the hadidas array
      scene.remove(hadidas[i]);
      hadidas.splice(i, 1);
      var val = hadidas.length < 5 ? '<span style="color: green">' + hadidas.length + '</span>' : hadidas.length;
      $('#hadidas').html(val); // updating the number of hadidas in the scene
      if (player.score >= 0) { // we also want to decrease the player score when this happens
        player.score = 0;
      }
      $('#score').html(player.score); // updating the score in the scene
      break; // once we remove one hadida we want to exit the loop
    }
  }

  // we want to keep track of the game in realtime
  var seconds = prevTime / 1000; // getting prevTime into milliseconds
  if ((seconds.toFixed(2) % 5) == 0) { // clamping the seconds variable so that we don't run this many times for one instance
    // displays a message everytime player loses life
    $("#snackbar").html("Poison is getting to you !!");
    var x = document.getElementById("snackbar");
    x.className = "show";
    setTimeout(function() {
      x.className = x.className.replace("show", "");
    }, 3000);

    $('#hurt').fadeIn(75); // setting the flash start time
    player.health -= 10; // +- every 5 seconds in real time player health will decrease
    if (player.health < 0) {
      player.health = 0;
    }
    // making the html view red, to add a little effect
    var val = player.health < 25 ? '<span style="color: darkRed">' + player.health + '</span>' : player.health;
    $('#health').html(val); // updating the html value of health
    $('#hurt').fadeOut(350); // setting the flash timeout
  }
}

/*
  Now a render method, "draw scene"
  Everything that needs to be drawn will go into this method.
  Firstly render the scene and the camera
*/
var render = function() {

  // we want to add some functionallity for the user winning the game or the player losing the game
  if (hadidas.length <= 0) { // if there are no more hadidas in the scene then player has survied or won
    run_animation = false;
    $(renderer.domElement).fadeOut();
    $('#instructions').fadeIn();
    $('#instructions').css('color', 'white'); // setting the css elements of the message to be displayed to the player
    $('#instructions').css('font-size', '30px');
    $('#instructions').css('background-color', 'black');
    if (player.kills == 22) { // player has won the game
      $('#instructions').html("You have successfully terminated all Hadidas !!!! </br> Thank you for playing ! </br> Press Esc and Click to restart");
    } else { // player has survived but did not win the game
      $('#instructions').css('color', 'white');
      $('#instructions').html("You managed to survive but, some Hadidas have escaped :( </br> Thank you for playing ! </br> Press Esc and Click to restart.");
    }
    $('#instructions').one('click', function() { // games resart feature if user presses "R"
      location = location; // resetting is back to the initial instructions html window
    });
  }
  if (player.health <= 0) { // if health is 0 player has lost the game
    run_animation = false;
    $(renderer.domElement).fadeOut();
    $('#instructions').fadeIn();
    $('#instructions').css('color', 'white'); // setting the css elements of the message to be displayed to the player
    $('#instructions').css('font-size', '30px');
    $('#instructions').css('background-color', 'black');
    $('#instructions').html("You have died,  </br> Thank you for playing ! </br> Press Esc and Click to restart.");
    $('#instructions').one('click', function() { // games resart feature if user presses "R"
      location = location;
    });
  }
  if (restart == true) {
    run_animation = false;
    $(renderer.domElement).fadeOut();
    $('#instructions').fadeIn();
    $('#instructions').one('click', function() { // games resart feature if user presses "R"
      location = location;
    });
  }
  // putting the result of the textureCamera into the first texture
  renderer.render(scene, textureCamera, firstRenderTarget, true);
  // note: texture is mirrored, we solve the problem by rendering the texture again, (by mirroring it)

  // render another scene containing just the "ren", and then put the final result into the final texture
  renderer.render(screenScene, screenCamera, finalRenderTarget, true);

  // rendering the main scene
  renderer.render(scene, camera);
}


/*
  Game Loop, "run game loop(update, render, repeat)"
  Game development construct that specifies how the game will be flowing->
  updates, checking updates, processing and rendering.
*/
function GameLoop() {
  // this functions allows us to run this every single frame
  if (run_animation == true) { // if this is true then we run animation
    requestAnimationFrame(GameLoop);
  }


  var timer = Date.now() * 0.0005;
  var del = clock.getDelta();

  if (controlsEnabled === true) { // checks to see if the user clicked on the screen to start the game

    // raycaster for being on box or not
    boxray.ray.origin.copy(controls.getObject().position); // setting the origin of the raycaster to the position of the camera
    boxray.ray.origin.y -= 1; // was initially 10

    var intersects = boxray.intersectObjects(boxes); // checking to see what the raycaster intersects with

    var onObject = intersects.length > 0; // checking to see if there are any intersections

    var time = performance.now(); // getting the current time

    var delta = (time - prevTime) / 1000; // delta difference in time

    // calculating the speed of player movement within the scene
    if (running) {
      velocity.x -= velocity.x * player.speed / 3 * delta;
      velocity.z -= velocity.z * player.speed / 3 * delta;

    } else {
      velocity.x -= velocity.x * player.speed * delta;
      velocity.z -= velocity.z * player.speed * delta;
    }
    velocity.y -= gravity * mass * delta;

    // setting the direction of which the user intends to move
    direction.z = Number(forward) - Number(backward);
    direction.x = Number(left) - Number(right);
    direction.normalize(); // ensures movement in all directions is consistent

    // setting the velocity of the direction that is moved in
    if (forward || backward) {
      velocity.z -= direction.z * 400 * delta;
    }
    if (left || right) {
      velocity.x -= direction.x * 400 * delta;
    }
    if (onObject == true) {
      velocity.y = Math.max(0, velocity.y); // setting the y velocity if we are on a box
      jumping = true; // if we are on a box we can still jump
    }

    // moving the camera as the "player" moves, by translation in accordance to the velocity and realtime seconds
    controls.getObject().translateX(velocity.x * delta);
    controls.getObject().translateY(velocity.y * delta);
    controls.getObject().translateZ(velocity.z * delta);

    // making sure that we do go through the ground
    if (controls.getObject().position.y < 0) {
      velocity.y = 0;
      controls.getObject().position.y = 0;
      jumping = true;
    }
    prevTime = time; // updating the previous time
    update(); // call the update method first to handle any updates
    render(); // call the render method as this will render the scene and camera that has just been updated
    mixer.update(clock.getDelta()); // updating the monsters animation in realtime i.e seconds
  }
  stats.update(); // updaing the stats which shows frames per second
}
GameLoop(); // enables the game loop function



/*
  Creating a function to handle events for when the user presses a key,
  from the predefined list of keys and for when then user releases the
  pressed key. These key events are for user movement, using the keyboard.
*/
function movement() {

  // handle key pressed events
  var keyPressed = function(event) {
    // using a switch cases to handle the different keys
    switch (event.keyCode) {
      case 87: // w -> moving forward
        forward = true;
        break;
      case 83: // s -> moving backward
        backward = true;
        break;
      case 65: // a -> moving left
        left = true;
        break;
      case 68: // d -> moving right
        right = true;
        break;
      case 81: // q pressed for running
        running = true;
        break;
      case 82: // r is pressed to restart
        restart = true;
        break;
      case 32: // spacebar
        if (jumping == true) {
          velocity.y += 150;
        }
        jumping = false;
        break;
    }
  };
  // handle key released events
  var keyReleased = function(event) {
    // using a switch cases to handle the different keys
    switch (event.keyCode) {
      case 87: // w -> moving forward
        forward = false;
        break;
      case 83: // s -> moving backward
        backward = false;
      case 65: // a -> moving left
        left = false;
        break;
      case 68: // d -> moving right
        right = false;
        break;
      case 81: // q for running
        running = false;
        break;
      case 82: // r for restart
        restart = false;
        break;
    }
  };

  // Left click of the mouse for shooting, handling mouse events
  var mouseDown = function(event) { // mouseClick
    event.preventDefault();
    shooting = true;

  };

  // event listeners for when then user interacts with the prescribed controls
  document.addEventListener('mousedown', mouseDown, false);

  document.addEventListener('keydown', keyPressed, false);
  document.addEventListener('keyup', keyReleased, false);
}
movement(); // enables movement function for user input from the keyboard

/*
  MouseLock, this function gets the elements of blocker and instructions from index.html,
*/
function mouseLock() {

  // getting the html elements setup in index
  // var blocker = document.getElementById('blocker');
  var instructions = document.getElementById('instructions');

  // boolen variable which checks to see if the user clicks to start the game
  var haveMouseLock = 'pointerLockElement' in document || 'mozPointerLockElement' in document || 'webkitPointerLockElement' in document;
  if (haveMouseLock) { // if the user has clicked on the screen to play the game

    // get the body element of the html file
    var element = document.body;

    var mouselockchange = function(event) {
      if (document.pointerLockElement === element || document.mozPointerLockElement === element || document.webkitPointerLockElement === element) {
        controlsEnabled = true; // enabling the controls
        controls.enabled = true;
        // blocker.style.display = 'none'; // removing the blocker html elements
      } else {
        controls.enabled = false;
        // blocker.style.display = 'block'; // if the user doesn't click then block is still enabled or the, or if the user uses the esc
        instructions.style.display = '';
      }
    };

    var mouselockerror = function(event) {
      instructions.style.display = '';
    };

    // Hook pointer lock state change events
    document.addEventListener('pointerlockchange', mouselockchange, false);
    document.addEventListener('mozpointerlockchange', mouselockchange, false);
    document.addEventListener('webkitpointerlockchange', mouselockchange, false);

    document.addEventListener('pointerlockerror', mouselockerror, false);
    document.addEventListener('mozpointerlockerror', mouselockerror, false);
    document.addEventListener('webkitpointerlockerror', mouselockerror, false);

    // when the user clicks the mouse, addEventListener for mouse click
    instructions.addEventListener('click', function(event) {
      instructions.style.display = 'none';

      // Asking the brower to lock the pointer
      element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock || element.webkitRequestPointerLock;
      element.requestPointerLock();
    }, false);

  } else {
    // throws an error, if the webpage cannot be rendered
    instructions.innerHTML = 'Error Mouse Lock is not Working on your Browser';
  }
}
mouseLock();