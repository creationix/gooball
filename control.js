"use strict";

var Fs = require('fs');
var Gamepad = require('gamepad');
var Spheron = require('spheron');
var X256 = require('x256');
var Charm = require('charm')(process.stdout);

function guessPort() {
  var names = Fs.readdirSync("/dev");
  for (var i = 0, l = names.length; i < l; i++) {
    var name = names[i];
    if (/^cu\.Sphero-[A-Z]{3}-[A-Z]{3}-[A-Z]{3}$/.test(name)) {
      return "/dev/" + name;
    }
  }
  throw new Error("No paired sphero found");
}

var sphero = Spheron.sphero();
var spheroPort = guessPort();
var open = false;

sphero.on('open', function() {
  open = true;
  console.log("\nConnected to sphero!");
  sphero.setStabilisation(true);
  sphero.setRGB(0x000033, false);

});


var red = 0, green = 0, blue = 0;

Gamepad.on("down", function (id, num) {
  if (num === 0) blue = 255;
  else if (num === 1) green = 255;
  else if (num === 2) red = 255;
  else if (num === 3) {
    red = 255;
    green = 128;
  }
  if (num < 4) setColor();

})
Gamepad.on("up", function (id, num) {
  if (num === 0) blue = 0;
  else if (num === 1) green = 0;
  else if (num === 2) red = 0;
  else if (num === 3) {
    red = 0;
    green = 0;
  }
});


var oldColor;
function setColor() {
  var color = red << 16 | green << 8 | blue;
  if (color === oldColor) return;
  oldColor = color;
  var hex = color.toString(16);
  hex = "000000".substring(hex.length) + hex;
  var average = ((red + green + blue) / 3)|0;
  var foreground;
  if (average < 128) foreground = X256(255,255,255);
  else foreground = X256(0,0,0);
  Charm.foreground(foreground).background(X256(red, green, blue)).write("\n" + hex);
  if (open) sphero.setRGB(color, false);
}

var angle = 0;
var velocity = 0;
var x = 0;
var y = 0;
var mx = 0, my = 0;

Gamepad.on("move", function (id, axis, value) {
  if (axis === 0) x = value;
  else if (axis === 1) y = value;
  else if (axis === 2) mx = value;
  else if (axis === 3) my = value;
  if (axis < 2) setDirection();
  else setRoll();
});

var heading = 0;

var tail = false;
function setDirection() {
  var speed = (Math.sqrt(x*x + y*y) * 255) | 0;
  if (speed < 200) {
    if (tail) {
      tail = false;
      if (open) sphero.setBackLED(0);
    }
    return;
  }
  if (!tail) {
    tail = true;
    if (open) sphero.setBackLED(255);
  }
  heading = getAngle(x, y);
  Charm.write("\nHeading " + heading + "°");
  if (open) {
    sphero.setHeading(0);
    sphero.roll(0, heading, 0);
  }
}

function setRoll() {
  var deg = getAngle(mx, my);
  var speed = (Math.sqrt(mx*mx + my*my) * 255) | 0;
  if (speed > 255) speed = 255;
  Charm.write("\nSpeed=" + speed + " heading=" + deg);
  if (open) sphero.roll(speed, (deg + heading) % 360, 1);
}

function getAngle(x, y) {
  var rad = Math.acos(-y / Math.sqrt(x * x + y * y));
  if (x < 0) rad = 2 * Math.PI - rad;
  return ((rad * 180 / Math.PI) % 360) | 0;
}

Gamepad.init();

// Create a game loop and poll for events
setInterval(Gamepad.processEvents, 500);
// Scan for new gamepads as a slower rate
setInterval(Gamepad.detectDevices, 2000);

sphero.resetTimeout(true);
sphero.requestAcknowledgement(false);
sphero.open(spheroPort);
